import { randomBytes } from 'crypto';

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { DEFAULT_PRODUCT_IMAGE, PRODUCT_FETCH_BATCH_SIZE } from '@/constants/generalconstants';
import {
  generateProductCode,
  generateDefaultSku,
  normalizeSku,
  extractProductCodePrefix,
  formatProductCode
} from '@/lib/sku-util';
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
  productCode?: string | null;
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
    productCode: product.productCode || null,
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
      { category: { name: { contains: searchQuery, mode: 'insensitive' } } },
      { productCode: { contains: searchQuery, mode: 'insensitive' } },
      { variants: { some: { sku: { contains: searchQuery, mode: 'insensitive' } } } }
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
    productCode: inputProductCode,
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

  let finalProductCode = (inputProductCode || '').trim().toUpperCase();
  if (!finalProductCode) {
    finalProductCode = await getNextAvailableProductCodeServer(name, category.name);
  } else {
    // Check if manually provided product code already exists in DB
    const existingCodeProduct = await prisma.product.findFirst({
      where: { productCode: { equals: finalProductCode, mode: 'insensitive' } }
    });
    if (existingCodeProduct) {
      return {
        success: false as const,
        status: 400,
        errors: ['DUPLICATE_PRODUCT_CODE'],
        message: `Product code '${finalProductCode}' is already in use by product '${existingCodeProduct.name}'. Please use a unique product code.`
      };
    }
  }

  // Pre-validate SKUs and normalize
  const normalizedVariants = (variants || []).map((v) => {
    const color = v.attributes?.Color || v.attributes?.color;
    const size = v.attributes?.Size || v.attributes?.size;
    const assignedSku = normalizeSku(v.sku) || generateDefaultSku(finalProductCode, color, size);
    return {
      ...v,
      sku: assignedSku
    };
  });

  const targetSkus = normalizedVariants.length > 0
    ? normalizedVariants.map((v) => v.sku)
    : [generateDefaultSku(finalProductCode)];

  // Check for duplicate SKUs within the request
  const seenRequestSkus = new Set<string>();
  for (const sku of targetSkus) {
    if (seenRequestSkus.has(sku)) {
      return {
        success: false as const,
        status: 400,
        errors: ['DUPLICATE_SKU'],
        message: `Duplicate SKU '${sku}' found in variant list. Each variant must have a unique SKU.`
      };
    }
    seenRequestSkus.add(sku);
  }

  // Check for duplicate SKUs against existing database records
  const existingDbVariant = await prisma.productVariant.findFirst({
    where: { sku: { in: targetSkus, mode: 'insensitive' } }
  });

  if (existingDbVariant) {
    return {
      success: false as const,
      status: 400,
      errors: ['DUPLICATE_SKU'],
      message: `SKU '${existingDbVariant.sku}' is already in use by another product or variant. Please use a unique SKU.`
    };
  }

  try {
    const createdProduct = await prisma.$transaction(async (tx) => {
      const targetPrice = price || 0;

      // Ensure product code is unique
      let uniqueProductCode = finalProductCode;
      const codeExists = await tx.product.findUnique({ where: { productCode: uniqueProductCode } });
      if (codeExists) {
        uniqueProductCode = await getNextAvailableProductCodeServer(finalProductCode, category.name);
      }

      const product = await tx.product.create({
        data: {
          productCode: uniqueProductCode,
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

      const optionValueMap: Record<string, string> = {};
      for (const opt of options) {
        const optName = opt.name.trim();
        const createdOpt = await tx.productOption.create({
          data: {
            productId: product.id,
            name: optName
          },
          include: { values: true }
        });

        for (const valStr of opt.values) {
          const valTrimmed = valStr.trim();
          const createdVal = await tx.productOptionValue.create({
            data: {
              optionId: createdOpt.id,
              value: valTrimmed
            }
          });
          optionValueMap[`${optName}:${valTrimmed}`] = createdVal.id;
        }
      }

      if (normalizedVariants && normalizedVariants.length > 0) {
        for (const v of normalizedVariants) {
          const createdVariant = await tx.productVariant.create({
            data: {
              productId: product.id,
              sku: v.sku,
              stock: v.stock,
              images: v.images && v.images.length > 0 ? v.images : [imageUrl || DEFAULT_PRODUCT_IMAGE]
            }
          });

          if (v.attributes) {
            for (const [attrName, attrValue] of Object.entries(v.attributes)) {
              const valStr = String(attrValue ?? '').trim();
              const valId = optionValueMap[`${attrName.trim()}:${valStr}`];
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
      } else {
        const finalStock = stock || 0;
        const finalImage = imageUrl && imageUrl.trim() !== '' ? imageUrl.trim() : DEFAULT_PRODUCT_IMAGE;

        await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: targetSkus[0] || generateDefaultSku(uniqueProductCode),
            stock: finalStock,
            images: [finalImage]
          }
        });
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
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : String(error.meta?.target || '');
      const isSku = target.includes('sku') || String(error.message || '').toLowerCase().includes('sku');
      const errSku = targetSkus[0] || 'specified SKU';
      return {
        success: false as const,
        status: 400,
        errors: ['DUPLICATE_SKU'],
        message: isSku
          ? `SKU '${errSku}' is already in use by another product or variant. Please use a unique SKU.`
          : 'A unique constraint violation occurred while saving the product.'
      };
    }
    return {
      success: false as const,
      status: 500,
      errors: [(error as Error).message],
      message: (error as Error).message || 'Failed to create product'
    };
  }
}
export async function updateProductServer(id: string, body: unknown) {
  if (body && typeof body === 'object' && 'createdById' in body) {
    delete (body as Record<string, unknown>).createdById;
  }

  const existingProduct = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
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

  if (!existingProduct) {
    return { success: false as const, status: 404, errors: [], message: 'Product not found' };
  }

  const validation = validateUpdateProductInput(body);
  if (!validation.success) {
    return validation;
  }

  const {
    name,
    productCode: inputProductCode,
    categoryId,
    categoryName,
    options,
    variants,
    price,
    stock,
    imageUrl
  } = validation.data;

  let targetCategoryId = categoryId;
  let categoryNameResolved = existingProduct.category?.name || '';
  if (!targetCategoryId && categoryName) {
    const category = await prisma.category.upsert({
      where: { name: categoryName.trim() },
      update: {},
      create: { name: categoryName.trim() }
    });
    targetCategoryId = category.id;
    categoryNameResolved = category.name;
  }

  const targetName = name !== undefined ? name.trim() : existingProduct.name;
  let finalProductCode = (inputProductCode || '').trim().toUpperCase();
  if (!finalProductCode) {
    finalProductCode = existingProduct.productCode || (await getNextAvailableProductCodeServer(targetName, categoryNameResolved, id));
  } else {
    // Check if new product code collides with another product
    const existingCodeProduct = await prisma.product.findFirst({
      where: {
        productCode: { equals: finalProductCode, mode: 'insensitive' },
        id: { not: id }
      }
    });
    if (existingCodeProduct) {
      return {
        success: false as const,
        status: 400,
        errors: ['DUPLICATE_PRODUCT_CODE'],
        message: `Product code '${finalProductCode}' is already in use by product '${existingCodeProduct.name}'. Please use a unique product code.`
      };
    }
  }

  // Pre-process variants and their SKUs if variants array is provided
  let normalizedVariants: any[] | undefined = undefined;
  const targetSkus: string[] = [];

  if (variants !== undefined && variants.length > 0) {
    normalizedVariants = variants.map((v) => {
      // Find matching existing variant by ID or SKU
      const existingVar = existingProduct.variants.find(
        (ov) => (v.id && ov.id === v.id) || (v.sku && normalizeSku(ov.sku) === normalizeSku(v.sku))
      );

      const color = v.attributes?.Color || v.attributes?.color;
      const size = v.attributes?.Size || v.attributes?.size;

      let assignedSku = normalizeSku(v.sku);
      if (!assignedSku && existingVar?.sku) {
        assignedSku = normalizeSku(existingVar.sku);
      }
      if (!assignedSku) {
        assignedSku = generateDefaultSku(finalProductCode, color, size);
      }

      return {
        ...v,
        matchedExistingId: existingVar?.id,
        sku: assignedSku
      };
    });

    for (const v of normalizedVariants) {
      targetSkus.push(v.sku);
    }

    // Check internal duplicates in request
    const seenRequestSkus = new Set<string>();
    for (const sku of targetSkus) {
      if (seenRequestSkus.has(sku)) {
        return {
          success: false as const,
          status: 400,
          errors: ['DUPLICATE_SKU'],
          message: `Duplicate SKU '${sku}' found in variant list. Each variant must have a unique SKU.`
        };
      }
      seenRequestSkus.add(sku);
    }

    // Check collision against database on OTHER products
    const existingDbVariant = await prisma.productVariant.findFirst({
      where: {
        sku: { in: targetSkus, mode: 'insensitive' },
        productId: { not: id }
      }
    });

    if (existingDbVariant) {
      return {
        success: false as const,
        status: 400,
        errors: ['DUPLICATE_SKU'],
        message: `SKU '${existingDbVariant.sku}' is already in use by another product or variant. Please use a unique SKU.`
      };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Update basic product details
      await tx.product.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name: targetName } : {}),
          ...(finalProductCode ? { productCode: finalProductCode } : {}),
          ...(targetCategoryId ? { categoryId: targetCategoryId } : {}),
          ...(price !== undefined ? { price } : {})
        }
      });

      if (options !== undefined) {
        // Replace options
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

        if (normalizedVariants && normalizedVariants.length > 0) {
          const oldVariants = existingProduct.variants;
          const newVariantIds: string[] = [];

          for (const v of normalizedVariants) {
            let targetVariantId: string;

            if (v.matchedExistingId) {
              await tx.productVariant.update({
                where: { id: v.matchedExistingId },
                data: {
                  sku: v.sku,
                  stock: v.stock,
                  images: v.images && v.images.length > 0 ? v.images : [imageUrl || DEFAULT_PRODUCT_IMAGE]
                }
              });
              await tx.variantOption.deleteMany({
                where: { variantId: v.matchedExistingId }
              });
              targetVariantId = v.matchedExistingId;
            } else {
              const createdVariant = await tx.productVariant.create({
                data: {
                  productId: id,
                  sku: v.sku,
                  stock: v.stock,
                  images: v.images && v.images.length > 0 ? v.images : [imageUrl || DEFAULT_PRODUCT_IMAGE]
                }
              });
              targetVariantId = createdVariant.id;
            }

            newVariantIds.push(targetVariantId);

            if (v.attributes) {
              for (const [attrName, attrValue] of Object.entries(v.attributes)) {
                const valStr = String(attrValue ?? '').trim();
                const valId = optionValueMap[`${attrName.trim()}:${valStr}`];
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
      } else if (normalizedVariants && normalizedVariants.length > 0) {
        const oldVariants = existingProduct.variants;
        const newVariantIds: string[] = [];

        for (const v of normalizedVariants) {
          let targetVariantId: string;

          if (v.matchedExistingId) {
            await tx.productVariant.update({
              where: { id: v.matchedExistingId },
              data: {
                sku: v.sku,
                stock: v.stock,
                images: v.images && v.images.length > 0 ? v.images : [imageUrl || DEFAULT_PRODUCT_IMAGE]
              }
            });
            targetVariantId = v.matchedExistingId;
          } else {
            const createdVariant = await tx.productVariant.create({
              data: {
                productId: id,
                sku: v.sku,
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
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : String(error.meta?.target || '');
      const isSku = target.includes('sku') || String(error.message || '').toLowerCase().includes('sku');
      const errSku = targetSkus[0] || 'specified SKU';
      return {
        success: false as const,
        status: 400,
        errors: ['DUPLICATE_SKU'],
        message: isSku
          ? `SKU '${errSku}' is already in use by another product or variant. Please use a unique SKU.`
          : 'A unique constraint violation occurred while updating the product.'
      };
    }
    return {
      success: false as const,
      status: 500,
      errors: [(error as Error).message],
      message: (error as Error).message || 'Failed to update product'
    };
  }
}

/**
 * Backfills missing productCode and variant SKUs for legacy database records.
 */
export async function backfillMissingProductCodesAndSkusServer(): Promise<{ updatedProducts: number; updatedVariants: number }> {
  const products = await prisma.product.findMany({
    include: {
      category: true,
      variants: {
        include: {
          variantOptions: {
            include: { optionValue: { include: { option: true } } }
          }
        }
      }
    }
  });

  let updatedProducts = 0;
  let updatedVariants = 0;

  for (const product of products) {
    let productCode = product.productCode;
    if (!productCode) {
      productCode = generateProductCode(product.name, product.category?.name || 'General');
      // Ensure uniqueness
      const existing = await prisma.product.findUnique({ where: { productCode } });
      if (existing && existing.id !== product.id) {
        productCode = `${productCode}-${Math.floor(100 + Math.random() * 900)}`;
      }
      await prisma.product.update({
        where: { id: product.id },
        data: { productCode }
      });
      updatedProducts++;
    }

    for (const v of product.variants) {
      if (!v.sku || v.sku.startsWith('SKU-')) {
        let color: string | undefined;
        let size: string | undefined;
        for (const vo of v.variantOptions) {
          const optName = vo.optionValue.option.name.toLowerCase();
          if (optName === 'color') color = vo.optionValue.value;
          if (optName === 'size') size = vo.optionValue.value;
        }

        const newSku = generateDefaultSku(productCode, color, size);
        // Check uniqueness before updating
        const skuExists = await prisma.productVariant.findUnique({ where: { sku: newSku } });
        const finalSku = skuExists && skuExists.id !== v.id
          ? `${newSku}-${Math.floor(10 + Math.random() * 90)}`
          : newSku;

        await prisma.productVariant.update({
          where: { id: v.id },
          data: { sku: finalSku }
        });
        updatedVariants++;
      }
    }
  }

  return { updatedProducts, updatedVariants };
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

/**
 * Calculates the next available product code for a given prefix or title in the database.
 * e.g., if "COUN-001" and "COUN-002" exist, it returns "COUN-003".
 */
export async function getNextAvailableProductCodeServer(
  prefixOrTitle?: string,
  categoryName?: string,
  excludeProductId?: string
): Promise<string> {
  const prefix = extractProductCodePrefix(prefixOrTitle, categoryName);

  const existingProducts = await prisma.product.findMany({
    where: {
      productCode: {
        startsWith: `${prefix}-`,
        mode: 'insensitive'
      },
      ...(excludeProductId ? { id: { not: excludeProductId } } : {})
    },
    select: {
      productCode: true
    }
  });

  const usedNumbers = new Set<number>();
  for (const p of existingProducts) {
    if (p.productCode) {
      const match = p.productCode.match(/^[A-Z0-9]+-([0-9]+)$/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > 0) {
          usedNumbers.add(num);
        }
      }
    }
  }

  let nextSeq = 1;
  while (usedNumbers.has(nextSeq)) {
    nextSeq++;
  }

  return formatProductCode(prefix, nextSeq);
}

/**
 * Checks if a specific product code is available in the database.
 */
export async function checkProductCodeAvailableServer(
  productCode: string,
  excludeProductId?: string
): Promise<{ available: boolean; code: string; nextAvailableCode: string }> {
  const cleanCode = (productCode || '').trim().toUpperCase();
  if (!cleanCode) {
    return { available: false, code: '', nextAvailableCode: 'PROD-001' };
  }

  const existing = await prisma.product.findFirst({
    where: {
      productCode: { equals: cleanCode, mode: 'insensitive' },
      ...(excludeProductId ? { id: { not: excludeProductId } } : {})
    },
    select: { id: true, productCode: true }
  });

  const prefix = extractProductCodePrefix(cleanCode);
  const nextAvailableCode = await getNextAvailableProductCodeServer(prefix, undefined, excludeProductId);

  return {
    available: !existing,
    code: cleanCode,
    nextAvailableCode
  };
}

