import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/server-auth";
import { apiSuccess, apiError } from "@/lib/api-response";

const DEFAULT_PRODUCT_IMAGE = "/placeholder-product.png";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError("Forbidden: Only ADMIN users can update product status", [], 403);
    }

    const { id } = await params;
    const body = await request.json();

    if (typeof body.isActive !== "boolean") {
      return apiError("Validation failed", ["isActive boolean field is required"], 400);
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return apiError("Product not found", [], 404);
    }

    const isActive = body.isActive;
    const inactiveAt = isActive ? null : new Date();

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        isActive,
        inactiveAt,
      },
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

    const variantsFormatted = updatedProduct.variants.map((v) => {
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
        stock: v.stock,
        images: v.images,
        attributes,
        variantOptions: variantOptionsInfo,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      };
    });

    const productPrice = Number(updatedProduct.price);
    const totalStock = variantsFormatted.reduce((acc, v) => acc + v.stock, 0);
    const primaryImage =
      variantsFormatted[0]?.images?.[0] || DEFAULT_PRODUCT_IMAGE;

    const formattedProduct = {
      id: updatedProduct.id,
      name: updatedProduct.name,
      isActive: updatedProduct.isActive,
      inactiveAt: updatedProduct.inactiveAt ? updatedProduct.inactiveAt.toISOString() : null,
      category: updatedProduct.category,
      createdBy: updatedProduct.createdBy,
      options: updatedProduct.options.map((opt) => ({
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
      price: productPrice,
      stock: totalStock,
      imageUrl: primaryImage,
      lowestPrice: productPrice,
      totalStock,
      variantCount: variantsFormatted.length,
      createdAt: updatedProduct.createdAt.toISOString(),
      updatedAt: updatedProduct.updatedAt.toISOString(),
    };

    const statusMessage = isActive
      ? "Product restored and activated successfully"
      : "Product inactivated successfully";

    return apiSuccess(statusMessage, { product: formattedProduct });
  } catch (error) {
    return apiError("Failed to update product status", [(error as Error).message], 500);
  }
}
