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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const titleQuery = searchParams.get("q") || searchParams.get("search") || "";
    const categoryQuery = searchParams.get("category") || "";
    const sortQuery = searchParams.get("sort") || "newest";

    const whereClause: Record<string, unknown> = {};

    if (titleQuery.trim()) {
      whereClause.name = { contains: titleQuery.trim(), mode: "insensitive" };
    }

    if (categoryQuery.trim()) {
      whereClause.category = { name: { equals: categoryQuery.trim(), mode: "insensitive" } };
    }

    let orderByClause: Record<string, unknown> = { createdAt: "desc" };
    if (sortQuery === "name-asc") {
      orderByClause = { name: "asc" };
    }

    const products = await prisma.product.findMany({
      where: whereClause,
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
      orderBy: orderByClause,
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

    if (sortQuery === "price-asc") {
      formattedProducts.sort((a, b) => a.lowestPrice - b.lowestPrice);
    } else if (sortQuery === "price-desc") {
      formattedProducts.sort((a, b) => b.lowestPrice - a.lowestPrice);
    }

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
      const targetPrice = price || (variants && variants[0] ? variants[0].price : 0);

      // 1. Check if a product with the exact same name and price already exists
      const matchingProducts = await tx.product.findMany({
        where: {
          name: { equals: name.trim(), mode: "insensitive" },
        },
        include: {
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

      // Find product where at least one variant matches targetPrice
      let product = matchingProducts.find((p) => {
        if (p.variants.length === 0) return true;
        return p.variants.some((v) => Math.abs(Number(v.price) - targetPrice) < 0.01);
      });

      // Fallback: if no price match found, use existing product with matching name
      if (!product && matchingProducts.length > 0) {
        product = matchingProducts[0];
      }

      if (!product) {
        // Create new base product if none exists
        product = await tx.product.create({
          data: {
            name: name.trim(),
            categoryId: category.id,
            createdById: adminUserId,
          },
          include: {
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
      } else {
        // Update category if needed
        await tx.product.update({
          where: { id: product.id },
          data: { categoryId: category.id },
        });
      }

      // 2. Ensure Options and OptionValues exist on the product
      const optionValueMap: Record<string, string> = {}; // "Color:Black" => optionValueId

      // Map existing options and values
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
              name: optName,
            },
            include: { values: true },
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
                value: valTrimmed,
              },
            });
            targetVal = createdVal;
          }
          optionValueMap[`${optName}:${valTrimmed}`] = targetVal.id;
        }
      }

      // 3. Create or Merge ProductVariants
      if (variants && variants.length > 0) {
        for (const v of variants) {
          const attrEntries = Object.entries(v.attributes || {});
          
          // Try to find matching variant on existing product
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
            // Merge stock into existing variant
            await tx.productVariant.update({
              where: { id: existingVariantMatch.id },
              data: {
                stock: existingVariantMatch.stock + v.stock,
                price: v.price,
                images: v.images && v.images.length > 0 ? v.images : existingVariantMatch.images,
              },
            });
          } else {
            // Create new variant under existing product
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
        }
      } else {
        // Fallback for single variant product
        const finalPrice = price || 0;
        const finalStock = stock || 0;
        const finalImage = imageUrl && imageUrl.trim() !== "" ? imageUrl.trim() : DEFAULT_PRODUCT_IMAGE;

        const firstVariant = product.variants[0];
        if (firstVariant) {
          await tx.productVariant.update({
            where: { id: firstVariant.id },
            data: {
              stock: firstVariant.stock + finalStock,
              price: finalPrice,
              images: [finalImage],
            },
          });
        } else {
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
