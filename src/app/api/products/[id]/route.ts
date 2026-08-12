import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/server-auth";
import { updateProductSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/api-response";

const DEFAULT_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80";

function generateSku(): string {
  return `SKU-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await getCurrentUser(request);
    const userIsAdmin = Boolean(user && isAdmin(user));

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        options: {
          include: {
            values: true,
          },
        },
        variants: {
          include: {
            variantOptions: {
              include: {
                optionValue: {
                  include: {
                    option: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!product || (!userIsAdmin && !product.isActive)) {
      return apiError("Product not found or inactive", [], 404);
    }

    const variantsFormatted = product.variants.map((v) => {
      const attributes: Record<string, string> = {};
      const variantOptionsInfo = v.variantOptions.map((vo) => {
        const optionName = vo.optionValue.option.name;
        const value = vo.optionValue.value;
        attributes[optionName] = value;
        return { optionName, value };
      });

      return {
        id: v.id,
        productId: v.productId,
        sku: v.sku,
        price: Number(v.price),
        stock: v.stock,
        images: v.images,
        attributes,
        variantOptions: variantOptionsInfo,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      };
    });

    const prices = variantsFormatted.map((v) => v.price);
    const lowestPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const totalStock = variantsFormatted.reduce((acc, v) => acc + v.stock, 0);
    const primaryImage =
      variantsFormatted[0]?.images?.[0] || DEFAULT_PRODUCT_IMAGE;

    const formattedProduct = {
      id: product.id,
      name: product.name,
      isActive: product.isActive,
      inactiveAt: product.inactiveAt ? product.inactiveAt.toISOString() : null,
      category: product.category,
      createdBy: product.createdBy,
      options: product.options.map((opt) => ({
        id: opt.id,
        productId: opt.productId,
        name: opt.name,
        values: opt.values.map((val) => ({
          id: val.id,
          optionId: val.optionId,
          value: val.value,
        })),
      })),
      variants: variantsFormatted,
      price: lowestPrice,
      stock: totalStock,
      imageUrl: primaryImage,
      lowestPrice,
      totalStock,
      variantCount: variantsFormatted.length,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };

    return apiSuccess("Product retrieved successfully", {
      product: formattedProduct,
    });
  } catch (error) {
    return apiError("Failed to fetch product", [(error as Error).message], 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleUpdate(request, await params);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleUpdate(request, await params);
}

async function handleUpdate(request: Request, { id }: { id: string }) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError("Forbidden: Only ADMIN users can update products", [], 403);
    }

    const body = await request.json();

    if (body.createdById) {
      delete body.createdById;
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: { options: true, variants: true },
    });

    if (!existingProduct) {
      return apiError("Product not found", [], 404);
    }

    const parsed = updateProductSchema.safeParse(body);

    if (!parsed.success) {
      const issueErrors = parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
      return apiError("Validation failed", issueErrors, 400);
    }

    const {
      name,
      categoryId,
      categoryName,
      options,
      variants,
      price,
      stock,
      imageUrl,
    } = parsed.data;

    let targetCategoryId = categoryId;

    if (!targetCategoryId && categoryName) {
      const category = await prisma.category.upsert({
        where: { name: categoryName.trim() },
        update: {},
        create: { name: categoryName.trim() },
      });
      targetCategoryId = category.id;
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update Base Product Info
      await tx.product.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name: name.trim() } : {}),
          ...(targetCategoryId ? { categoryId: targetCategoryId } : {}),
        },
      });

      // 2. If options are explicitly provided, replace options & optionValues
      if (options !== undefined) {
        await tx.productOption.deleteMany({
          where: { productId: id },
        });

        const optionValueMap: Record<string, string> = {};

        for (const opt of options) {
          const createdOpt = await tx.productOption.create({
            data: {
              productId: id,
              name: opt.name.trim(),
            },
          });

          for (const valStr of opt.values) {
            const valTrimmed = valStr.trim();
            const createdVal = await tx.productOptionValue.create({
              data: {
                optionId: createdOpt.id,
                value: valTrimmed,
              },
            });
            optionValueMap[`${opt.name.trim()}:${valTrimmed}`] = createdVal.id;
          }
        }

        // Replace Variants if provided
        if (variants !== undefined && variants.length > 0) {
          await tx.productVariant.deleteMany({
            where: { productId: id },
          });

          for (const v of variants) {
            const variantSku = v.sku || generateSku();
            const createdVariant = await tx.productVariant.create({
              data: {
                productId: id,
                sku: variantSku,
                price: v.price,
                stock: v.stock,
                images: v.images && v.images.length > 0 ? v.images : [imageUrl || DEFAULT_PRODUCT_IMAGE],
              },
            });

            if (v.attributes) {
              for (const [attrName, attrValue] of Object.entries(v.attributes)) {
                const valId = optionValueMap[`${attrName.trim()}:${attrValue.trim()}`];
                if (valId) {
                  await tx.variantOption.create({
                    data: {
                      variantId: createdVariant.id,
                      optionValueId: valId,
                    },
                  });
                }
              }
            }
          }
        }
      } else if (variants !== undefined && variants.length > 0) {
        // Options not provided, but variants provided
        await tx.productVariant.deleteMany({
          where: { productId: id },
        });

        for (const v of variants) {
          const variantSku = v.sku || generateSku();
          await tx.productVariant.create({
            data: {
              productId: id,
              sku: variantSku,
              price: v.price,
              stock: v.stock,
              images: v.images && v.images.length > 0 ? v.images : [imageUrl || DEFAULT_PRODUCT_IMAGE],
            },
          });
        }
      } else if (price !== undefined || stock !== undefined || imageUrl !== undefined) {
        // Update first variant for single product updates
        const firstVariant = existingProduct.variants[0];
        if (firstVariant) {
          await tx.productVariant.update({
            where: { id: firstVariant.id },
            data: {
              ...(price !== undefined ? { price } : {}),
              ...(stock !== undefined ? { stock } : {}),
              ...(imageUrl !== undefined ? { images: [imageUrl || DEFAULT_PRODUCT_IMAGE] } : {}),
            },
          });
        }
      }
    });

    // Re-fetch updated full product
    const fullProduct = await prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        options: { include: { values: true } },
        variants: {
          include: {
            variantOptions: {
              include: { optionValue: { include: { option: true } } },
            },
          },
        },
      },
    });

    if (!fullProduct) {
      return apiError("Product updated but could not be retrieved", [], 500);
    }

    const variantsFormatted = fullProduct.variants.map((v) => {
      const attributes: Record<string, string> = {};
      const variantOptionsInfo = v.variantOptions.map((vo) => {
        const optionName = vo.optionValue.option.name;
        const value = vo.optionValue.value;
        attributes[optionName] = value;
        return { optionName, value };
      });
      return {
        id: v.id,
        productId: v.productId,
        sku: v.sku,
        price: Number(v.price),
        stock: v.stock,
        images: v.images,
        attributes,
        variantOptions: variantOptionsInfo,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      };
    });

    const prices = variantsFormatted.map((v) => v.price);
    const lowestPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const totalStock = variantsFormatted.reduce((acc, v) => acc + v.stock, 0);
    const primaryImage =
      variantsFormatted[0]?.images?.[0] || DEFAULT_PRODUCT_IMAGE;

    const formattedProduct = {
      id: fullProduct.id,
      name: fullProduct.name,
      category: fullProduct.category,
      createdBy: fullProduct.createdBy,
      options: fullProduct.options,
      variants: variantsFormatted,
      price: lowestPrice,
      stock: totalStock,
      imageUrl: primaryImage,
      lowestPrice,
      totalStock,
      variantCount: variantsFormatted.length,
      createdAt: fullProduct.createdAt.toISOString(),
      updatedAt: fullProduct.updatedAt.toISOString(),
    };

    return apiSuccess("Product updated successfully", {
      product: formattedProduct,
    });
  } catch (error) {
    return apiError("Failed to update product", [(error as Error).message], 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError("Forbidden: Only ADMIN users can deactivate products", [], 403);
    }

    const { id } = await params;

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return apiError("Product not found", [], 404);
    }

    await prisma.product.update({
      where: { id },
      data: {
        isActive: false,
        inactiveAt: new Date(),
      },
    });

    return apiSuccess("Product inactivated successfully");
  } catch (error) {
    return apiError("Failed to deactivate product", [(error as Error).message], 500);
  }
}
