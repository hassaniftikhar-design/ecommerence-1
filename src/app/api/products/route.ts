import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/server-auth";
import { createProductSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/api-response";

const DEFAULT_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80";

function generateSku(): string {
  return `SKU-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function GET() {
  try {
    const products = await prisma.product.findMany({
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
      orderBy: { createdAt: "desc" },
    });

    const formattedProducts = products.map((product) => {
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

      return {
        id: product.id,
        name: product.name,
        description: product.description,
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
        // Computed backwards-compatibility fields
        price: lowestPrice,
        stock: totalStock,
        imageUrl: primaryImage,
        lowestPrice,
        totalStock,
        variantCount: variantsFormatted.length,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      };
    });

    return apiSuccess("Products retrieved successfully", {
      products: formattedProducts,
    });
  } catch (error) {
    return apiError("Failed to fetch products", [(error as Error).message], 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError("Forbidden: Only ADMIN users can create products", [], 403);
    }

    const body = await request.json();

    if (body.createdById) {
      delete body.createdById;
    }

    const parsed = createProductSchema.safeParse(body);

    if (!parsed.success) {
      const issueErrors = parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
      return apiError("Validation failed", issueErrors, 400);
    }

    const {
      name,
      description,
      categoryId,
      categoryName,
      options = [],
      variants = [],
      price,
      stock,
      imageUrl,
    } = parsed.data;

    let category = null;

    if (categoryId) {
      category = await prisma.category.findUnique({ where: { id: categoryId } });
    } else if (categoryName) {
      category = await prisma.category.upsert({
        where: { name: categoryName.trim() },
        update: {},
        create: { name: categoryName.trim() },
      });
    }

    if (!category) {
      return apiError("Category is required", [], 400);
    }

    const adminUserId = (user.id || user.sub)!;

    const createdProduct = await prisma.$transaction(async (tx) => {
      // 1. Create Base Product
      const product = await tx.product.create({
        data: {
          name: name.trim(),
          description: description ? description.trim() : null,
          categoryId: category.id,
          createdById: adminUserId,
        },
      });

      // 2. Create Options and OptionValues
      const optionValueMap: Record<string, string> = {}; // "Color:Black" => optionValueId

      for (const opt of options) {
        const createdOpt = await tx.productOption.create({
          data: {
            productId: product.id,
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

      // 3. Create ProductVariants and VariantOptions
      if (variants && variants.length > 0) {
        for (const v of variants) {
          const variantSku = v.sku || generateSku();
          const createdVariant = await tx.productVariant.create({
            data: {
              productId: product.id,
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
      } else {
        // Fallback for single variant product (backward compatibility)
        const finalPrice = price || 0;
        const finalStock = stock || 0;
        const finalImage = imageUrl && imageUrl.trim() !== "" ? imageUrl.trim() : DEFAULT_PRODUCT_IMAGE;

        await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: generateSku(),
            price: finalPrice,
            stock: finalStock,
            images: [finalImage],
          },
        });
      }

      return product;
    });

    // Fetch complete product to return
    const fullProduct = await prisma.product.findUnique({
      where: { id: createdProduct.id },
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
      return apiError("Product created but could not be re-fetched", [], 500);
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
      description: fullProduct.description,
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

    return apiSuccess(
      "Product created successfully",
      { product: formattedProduct },
      201
    );
  } catch (error) {
    return apiError("Failed to create product", [(error as Error).message], 500);
  }
}
