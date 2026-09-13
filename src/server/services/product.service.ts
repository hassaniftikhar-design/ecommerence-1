import { randomBytes } from 'crypto';

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { DEFAULT_PRODUCT_IMAGE, PRODUCT_FETCH_BATCH_SIZE } from '@/constants/generalconstants';
import {
  validateCreateProductInput,
  validateUpdateProductInput
} from '@/server/middlewares';

function generateSku(): string {
  return `SKU-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export interface RawVariantOption {
  optionValue: {
    value: string;
    option: {
      name: string;
    };
  };
}

export interface RawVariant {
  id: string;
  productId: string;
  sku: string;
  stock: number;
  images: string[];
  variantOptions?: RawVariantOption[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface RawProductOptionValue {
  id: string;
  optionId: string;
  value: string;
}

export interface RawProductOption {
  id: string;
  productId: string;
  name: string;
  values?: RawProductOptionValue[];
}

export interface RawProduct {
  id: string;
  name: string;
  price: Prisma.Decimal | number;
  isActive: boolean;
  inactiveAt?: Date | string | null;
  category?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string } | null;
  options?: RawProductOption[];
  variants?: RawVariant[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export function formatProductResponse(product: RawProduct) {
  let primaryImage = DEFAULT_PRODUCT_IMAGE;
  const variantWithDefault = (product.variants || []).find((v) => v.images && v.images.length > 1);
  if (variantWithDefault && variantWithDefault.images[1]) {
    primaryImage = variantWithDefault.images[1];
  } else {
    const firstImage = (product.variants || []).find((v) => v.images && v.images.length > 0)?.images[0];
    if (firstImage) {
      primaryImage = firstImage;
    }
  }

  const variantsFormatted = (product.variants || []).map((v) => {
    const attributes: Record<string, string> = {};
    const variantOptionsInfo = (v.variantOptions || []).map((vo) => {
      const optionName = vo.optionValue.option.name;
      const value = vo.optionValue.value;
      attributes[optionName] = value;
      return { optionName, value };
    });

    const variantImages = v.images && v.images.length > 0 ? v.images : [primaryImage];

    return {
      id: v.id,
      productId: v.productId,
      sku: v.sku,
      stock: v.stock,
      images: variantImages,
      attributes,
      variantOptions: variantOptionsInfo,
      createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : v.createdAt,
      updatedAt: v.updatedAt instanceof Date ? v.updatedAt.toISOString() : v.updatedAt
    };
  });

  const productPrice = Number(product.price);
  const totalStock = variantsFormatted.reduce((acc: number, v) => acc + v.stock, 0);

  return {
    id: product.id,
    name: product.name,
    isActive: product.isActive,
    inactiveAt: product.inactiveAt ? (product.inactiveAt instanceof Date ? product.inactiveAt.toISOString() : product.inactiveAt) : null,
    category: product.category,
    createdBy: product.createdBy,
    options: (product.options || []).map((opt) => ({
      id: opt.id,
      productId: opt.productId,
      name: opt.name,
      values: (opt.values || []).map((val) => ({
        id: val.id,
        optionId: val.optionId,
        value: val.value
      }))
    })),
    variants: variantsFormatted,
    price: productPrice,
    stock: totalStock,
    imageUrl: primaryImage,
    lowestPrice: productPrice,
    totalStock,
    variantCount: variantsFormatted.length,
    createdAt: product.createdAt instanceof Date ? product.createdAt.toISOString() : product.createdAt,
    updatedAt: product.updatedAt instanceof Date ? product.updatedAt.toISOString() : product.updatedAt
  };
}

export interface GetProductsServerParams {
  searchQuery?: string;
  categoryQuery?: string;
  sortQuery?: string;
  statusQuery?: string;
  pageNumber?: number;
  limitNumber?: number;
  isPaginatedCall?: boolean;
  userIsAdmin?: boolean;
}

export async function getProductsServer(params: GetProductsServerParams) {
  const {
    searchQuery = '',
    categoryQuery = '',
    sortQuery = 'newest',
    statusQuery = '',
    pageNumber = 1,
    limitNumber = PRODUCT_FETCH_BATCH_SIZE,
    isPaginatedCall = false,
    userIsAdmin = false
  } = params;

  const whereClause: Prisma.ProductWhereInput = {};

  if (!userIsAdmin) {
    whereClause.isActive = true;
  } else {
    if (statusQuery === 'active') {
      whereClause.isActive = true;
    } else if (statusQuery === 'inactive') {
      whereClause.isActive = false;
    }
  }

  if (searchQuery) {
    whereClause.OR = [
      { name: { contains: searchQuery, mode: 'insensitive' } },
      { category: { name: { contains: searchQuery, mode: 'insensitive' } } }
    ];
  }

  if (categoryQuery) {
    whereClause.category = { name: { equals: categoryQuery, mode: 'insensitive' } };
  }

  let orderByClause: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
  if (sortQuery === 'price-asc') {
    orderByClause = { price: 'asc' };
  } else if (sortQuery === 'price-desc') {
    orderByClause = { price: 'desc' };
  } else if (sortQuery === 'name-asc') {
    orderByClause = { name: 'asc' };
  } else if (sortQuery === 'name-desc') {
    orderByClause = { name: 'desc' };
  } else if (sortQuery === 'newest') {
    orderByClause = { createdAt: 'desc' };
  }

  const totalCount = await prisma.product.count({ where: whereClause });

  const products = await prisma.product.findMany({
    where: whereClause,
    include: {
      category: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      options: {
        include: {
          values: true
        }
      },
      variants: {
        include: {
          variantOptions: {
            include: {
              optionValue: {
                include: {
                  option: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: orderByClause,
    ...(isPaginatedCall
      ? {
        skip: (pageNumber - 1) * limitNumber,
        take: limitNumber
      }
      : {})
  });

  let formattedProducts = products.map(formatProductResponse);

  if (userIsAdmin && products.length > 0) {
    try {
      const productIds = products.map((p) => p.id);
      const unresolvedItems = await prisma.importItem.findMany({
        where: {
          product_id: { in: productIds },
          status: 'FAILED',
          resolution_status: { not: 'RESOLVED' }
        }
      });

      const importItemMap = new Map<string, { itemId: string; jobId: string; errorMessage: string; errorType: string }>();
      for (const it of unresolvedItems) {
        if (it.product_id) {
          importItemMap.set(it.product_id, {
            itemId: it.id,
            jobId: it.job_id,
            errorMessage: it.error_message || '',
            errorType: it.error_type || 'VALIDATION_ERROR'
          });
        }
      }

      formattedProducts = formattedProducts.map((fp) => {
        const errInfo = importItemMap.get(fp.id);
        if (errInfo) {
          return { ...fp, importError: errInfo };
        }
        return fp;
      });
    } catch (e) {
      console.warn('Failed to fetch unresolved import items for products:', e);
    }
  }

  const effectiveLimit = isPaginatedCall ? limitNumber : totalCount || 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / effectiveLimit));

  return {
    products: formattedProducts,
    page: isPaginatedCall ? pageNumber : 1,
    limit: isPaginatedCall ? limitNumber : totalCount,
    total: totalCount,
    hasMore: isPaginatedCall ? pageNumber * limitNumber < totalCount : false,
    pagination: {
      page: isPaginatedCall ? pageNumber : 1,
      limit: isPaginatedCall ? limitNumber : totalCount,
      totalItems: totalCount,
      totalPages: isPaginatedCall ? totalPages : 1,
      hasNextPage: isPaginatedCall ? pageNumber < totalPages : false,
      hasPrevPage: isPaginatedCall ? pageNumber > 1 : false
    }
  };
}

export async function getProductByIdServer(id: string, userIsAdmin: boolean) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      options: {
        include: {
          values: true
        }
      },
      variants: {
        include: {
          variantOptions: {
            include: {
              optionValue: {
                include: {
                  option: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!product || (!userIsAdmin && !product.isActive)) {
    return null;
  }

  const formatted = formatProductResponse(product);

  if (userIsAdmin) {
    try {
      const unresolvedItem = await prisma.importItem.findFirst({
        where: {
          product_id: id,
          status: 'FAILED',
          resolution_status: { not: 'RESOLVED' }
        }
      });

      if (unresolvedItem) {
        return {
          ...formatted,
          importError: {
            itemId: unresolvedItem.id,
            jobId: unresolvedItem.job_id,
            errorMessage: unresolvedItem.error_message || '',
            errorType: unresolvedItem.error_type || 'VALIDATION_ERROR'
          }
        };
      }
    } catch (e) {
      console.warn(`Failed to fetch unresolved import item for product ${id}:`, e);
    }
  }

  return formatted;
}

export async function createProductServer(body: unknown, adminUserId: string) {
  if (body && typeof body === 'object' && 'createdById' in body) {
    delete (body as Record<string, unknown>).createdById;
  }

  const validation = validateCreateProductInput(body);
  if (!validation.success) {
    return validation;
  }

  const {
    name,
    categoryId,
    categoryName,
    options = [],
    variants = [],
    price,
    stock,
    imageUrl
  } = validation.data;

  let category = null;
  if (categoryId) {
    category = await prisma.category.findUnique({ where: { id: categoryId } });
  } else if (categoryName) {
    category = await prisma.category.upsert({
      where: { name: categoryName.trim() },
      update: {},
      create: { name: categoryName.trim() }
    });
  }

  if (!category) {
    return { success: false as const, status: 400, errors: [], message: 'Category is required' };
  }

  const createdProduct = await prisma.$transaction(async (tx) => {
    const targetPrice = price || 0;

    const candidates = await tx.product.findMany({
      where: {
        name: { equals: name.trim(), mode: 'insensitive' },
        categoryId: category.id
      },
      include: {
        options: { include: { values: true } },
        variants: {
          include: {
            variantOptions: {
              include: { optionValue: { include: { option: true } } }
            }
          }
        }
      }
    });

    let product = candidates.find((p) => Number(p.price) === Number(targetPrice)) || null;

    if (!product) {
      product = await tx.product.create({
        data: {
          name: name.trim(),
          price: targetPrice,
          categoryId: category.id,
          createdById: adminUserId
        },
        include: {
          options: { include: { values: true } },
          variants: {
            include: {
              variantOptions: {
                include: { optionValue: { include: { option: true } } }
              }
            }
          }
        }
      });
    }

    const optionValueMap: Record<string, string> = {};
    for (const existingOpt of product.options) {
      for (const existingVal of existingOpt.values) {
        optionValueMap[`${existingOpt.name.trim()}:${existingVal.value.trim()}`] = existingVal.id;
      }
    }

    for (const opt of options) {
      const optName = opt.name.trim();
      let targetOpt = product.options.find(
        (o) => o.name.toLowerCase() === optName.toLowerCase()
      );

      if (!targetOpt) {
        const createdOpt = await tx.productOption.create({
          data: {
            productId: product.id,
            name: optName
          },
          include: { values: true }
        });
        targetOpt = createdOpt;
      }

      for (const valStr of opt.values) {
        const valTrimmed = valStr.trim();
        let targetVal = targetOpt.values.find(
          (v) => v.value.toLowerCase() === valTrimmed.toLowerCase()
        );

        if (!targetVal) {
          const createdVal = await tx.productOptionValue.create({
            data: {
              optionId: targetOpt.id,
              value: valTrimmed
            }
          });
          targetVal = createdVal;
        }
        optionValueMap[`${optName}:${valTrimmed}`] = targetVal.id;
      }
    }

    if (variants && variants.length > 0) {
      for (const v of variants) {
        const attrEntries = Object.entries(v.attributes || {});

        const existingVariantMatch = product.variants.find((existingV) => {
          if (attrEntries.length === 0 && existingV.variantOptions.length === 0) return true;
          if (attrEntries.length !== existingV.variantOptions.length) return false;
          return attrEntries.every(([attrName, attrValue]) => {
            return existingV.variantOptions.some(
              (vo) =>
                vo.optionValue.option.name.toLowerCase() === attrName.toLowerCase() &&
                vo.optionValue.value.toLowerCase() === attrValue.toLowerCase()
            );
          });
        });

        if (existingVariantMatch) {
          await tx.productVariant.update({
            where: { id: existingVariantMatch.id },
            data: {
              stock: existingVariantMatch.stock + v.stock,
              images: v.images && v.images.length > 0 ? v.images : existingVariantMatch.images
            }
          });
        } else {
          const variantSku = v.sku || generateSku();
          const createdVariant = await tx.productVariant.create({
            data: {
              productId: product.id,
              sku: variantSku,
              stock: v.stock,
              images: v.images && v.images.length > 0 ? v.images : [imageUrl || DEFAULT_PRODUCT_IMAGE]
            }
          });

          if (v.attributes) {
            for (const [attrName, attrValue] of Object.entries(v.attributes)) {
              const valId = optionValueMap[`${attrName.trim()}:${attrValue.trim()}`];
              if (valId) {
                await tx.variantOption.create({
                  data: {
                    variantId: createdVariant.id,
                    optionValueId: valId
                  }
                });
              }
            }
          }
        }
      }
    } else {
      const finalStock = stock || 0;
      const finalImage = imageUrl && imageUrl.trim() !== '' ? imageUrl.trim() : DEFAULT_PRODUCT_IMAGE;

      const firstVariant = product.variants[0];
      if (firstVariant) {
        await tx.productVariant.update({
          where: { id: firstVariant.id },
          data: {
            stock: firstVariant.stock + finalStock,
            images: [finalImage]
          }
        });
      } else {
        await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: generateSku(),
            stock: finalStock,
            images: [finalImage]
          }
        });
      }
    }

    return product;
  });

  const fullProduct = await prisma.product.findUnique({
    where: { id: createdProduct.id },
    include: {
      category: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      options: { include: { values: true } },
      variants: {
        include: {
          variantOptions: {
            include: { optionValue: { include: { option: true } } }
          }
        }
      }
    }
  });

  if (!fullProduct) {
    return { success: false as const, status: 500, errors: [], message: 'Product created but could not be re-fetched' };
  }

  return { success: true as const, status: 201, product: formatProductResponse(fullProduct) };
}

export async function updateProductServer(id: string, body: unknown) {
  if (body && typeof body === 'object' && 'createdById' in body) {
    delete (body as Record<string, unknown>).createdById;
  }

  const existingProduct = await prisma.product.findUnique({
    where: { id },
    include: { options: true, variants: true }
  });

  if (!existingProduct) {
    return { success: false as const, status: 404, errors: [], message: 'Product not found' };
  }

  const validation = validateUpdateProductInput(body);
  if (!validation.success) {
    return validation;
  }

  const {
    name,
    categoryId,
    categoryName,
    options,
    variants,
    price,
    stock,
    imageUrl
  } = validation.data;

  let targetCategoryId = categoryId;
  if (!targetCategoryId && categoryName) {
    const category = await prisma.category.upsert({
      where: { name: categoryName.trim() },
      update: {},
      create: { name: categoryName.trim() }
    });
    targetCategoryId = category.id;
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(targetCategoryId ? { categoryId: targetCategoryId } : {}),
        ...(price !== undefined ? { price } : {})
      }
    });

    if (options !== undefined) {
      await tx.productOption.deleteMany({
        where: { productId: id }
      });

      const optionValueMap: Record<string, string> = {};

      for (const opt of options) {
        const createdOpt = await tx.productOption.create({
          data: {
            productId: id,
            name: opt.name.trim()
          }
        });

        for (const valStr of opt.values) {
          const valTrimmed = valStr.trim();
          const createdVal = await tx.productOptionValue.create({
            data: {
              optionId: createdOpt.id,
              value: valTrimmed
            }
          });
          optionValueMap[`${opt.name.trim()}:${valTrimmed}`] = createdVal.id;
        }
      }

      if (variants !== undefined && variants.length > 0) {
        const oldVariants = existingProduct.variants;
        const newVariantIds: string[] = [];

        for (let i = 0; i < variants.length; i++) {
          const v = variants[i];
          if (!v) continue;
          const existingVar = oldVariants.find(
            (ov) => (v.id && ov.id === v.id) || (v.sku && ov.sku === v.sku)
          );
          let targetVariantId: string;

          if (existingVar) {
            await tx.productVariant.update({
              where: { id: existingVar.id },
              data: {
                stock: v.stock,
                images: v.images && v.images.length > 0 ? v.images : [imageUrl || DEFAULT_PRODUCT_IMAGE]
              }
            });
            await tx.variantOption.deleteMany({
              where: { variantId: existingVar.id }
            });
            targetVariantId = existingVar.id;
          } else {
            const variantSku = v.sku || generateSku();
            const createdVariant = await tx.productVariant.create({
              data: {
                productId: id,
                sku: variantSku,
                stock: v.stock,
                images: v.images && v.images.length > 0 ? v.images : [imageUrl || DEFAULT_PRODUCT_IMAGE]
              }
            });
            targetVariantId = createdVariant.id;
          }

          newVariantIds.push(targetVariantId);

          if (v.attributes) {
            for (const [attrName, attrValue] of Object.entries(v.attributes)) {
              const valId = optionValueMap[`${attrName.trim()}:${attrValue.trim()}`];
              if (valId) {
                await tx.variantOption.create({
                  data: {
                    variantId: targetVariantId,
                    optionValueId: valId
                  }
                });
              }
            }
          }
        }

        const unusedOldVariants = oldVariants.filter((ov) => !newVariantIds.includes(ov.id));
        for (const unusedVar of unusedOldVariants) {
          await tx.productVariant.delete({
            where: { id: unusedVar.id }
          });
        }
      }
    } else if (variants !== undefined && variants.length > 0) {
      const oldVariants = existingProduct.variants;
      const newVariantIds: string[] = [];

      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (!v) continue;
        const existingVar = oldVariants.find(
          (ov) => (v.id && ov.id === v.id) || (v.sku && ov.sku === v.sku)
        );
        let targetVariantId: string;

        if (existingVar) {
          await tx.productVariant.update({
            where: { id: existingVar.id },
            data: {
              stock: v.stock,
              images: v.images && v.images.length > 0 ? v.images : [imageUrl || DEFAULT_PRODUCT_IMAGE]
            }
          });
          targetVariantId = existingVar.id;
        } else {
          const variantSku = v.sku || generateSku();
          const createdVariant = await tx.productVariant.create({
            data: {
              productId: id,
              sku: variantSku,
              stock: v.stock,
              images: v.images && v.images.length > 0 ? v.images : [imageUrl || DEFAULT_PRODUCT_IMAGE]
            }
          });
          targetVariantId = createdVariant.id;
        }

        newVariantIds.push(targetVariantId);
      }

      const unusedOldVariants = oldVariants.filter((ov) => !newVariantIds.includes(ov.id));
      for (const unusedVar of unusedOldVariants) {
        await tx.productVariant.delete({
          where: { id: unusedVar.id }
        });
      }
    } else if (stock !== undefined || imageUrl !== undefined) {
      const firstVariant = existingProduct.variants[0];
      if (firstVariant) {
        await tx.productVariant.update({
          where: { id: firstVariant.id },
          data: {
            ...(stock !== undefined ? { stock } : {}),
            ...(imageUrl !== undefined ? { images: [imageUrl || DEFAULT_PRODUCT_IMAGE] } : {})
          }
        });
      }
    }
  });

  const fullProduct = await prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      options: { include: { values: true } },
      variants: {
        include: {
          variantOptions: {
            include: { optionValue: { include: { option: true } } }
          }
        }
      }
    }
  });

  if (!fullProduct) {
    return { success: false as const, status: 500, errors: [], message: 'Product updated but could not be retrieved' };
  }

  return { success: true as const, status: 200, product: formatProductResponse(fullProduct) };
}

export async function updateProductStatusServer(id: string, isActive: boolean) {
  const existingProduct = await prisma.product.findUnique({
    where: { id }
  });

  if (!existingProduct) {
    return { success: false as const, status: 404, errors: [], message: 'Product not found' };
  }

  const inactiveAt = isActive ? null : new Date();

  const updatedProduct = await prisma.product.update({
    where: { id },
    data: {
      isActive,
      inactiveAt
    },
    include: {
      category: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      options: {
        include: {
          values: true
        }
      },
      variants: {
        include: {
          variantOptions: {
            include: {
              optionValue: {
                include: {
                  option: true
                }
              }
            }
          }
        }
      }
    }
  });

  return {
    success: true as const,
    status: 200,
    product: formatProductResponse(updatedProduct),
    message: isActive
      ? 'Product restored and activated successfully'
      : 'Product inactivated successfully'
  };
}

export async function deactivateProductServer(id: string) {
  const existingProduct = await prisma.product.findUnique({
    where: { id }
  });

  if (!existingProduct) {
    return { success: false as const, status: 404, errors: [], message: 'Product not found' };
  }

  await prisma.product.update({
    where: { id },
    data: {
      isActive: false,
      inactiveAt: new Date()
    }
  });

  return { success: true as const, status: 200, message: 'Product inactivated successfully' };
}
