import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/server-auth";
import { updateProductSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
        imageUrl: true,
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!product) {
      return apiError("Product not found", [], 404);
    }

    const formattedProduct = {
      ...product,
      price: Number(product.price),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };

    return apiSuccess("Product retrieved successfully", { product: formattedProduct });
  } catch (error) {
    return apiError("Failed to fetch product", [(error as Error).message], 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError("Forbidden: Only ADMIN users can update products", [], 403);
    }

    const { id } = await params;
    const body = await request.json();

    // Do not allow overriding createdById
    if (body.createdById) {
      delete body.createdById;
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
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

    const { name, price, stock, imageUrl, categoryId, categoryName } = parsed.data;

    let targetCategoryId = categoryId;

    if (!targetCategoryId && categoryName) {
      const category = await prisma.category.upsert({
        where: { name: categoryName.trim() },
        update: {},
        create: { name: categoryName.trim() },
      });
      targetCategoryId = category.id;
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(price !== undefined ? { price } : {}),
        ...(stock !== undefined ? { stock } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(targetCategoryId ? { categoryId: targetCategoryId } : {}),
      },
      include: {
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    const formattedProduct = {
      ...updatedProduct,
      price: Number(updatedProduct.price),
      createdAt: updatedProduct.createdAt.toISOString(),
      updatedAt: updatedProduct.updatedAt.toISOString(),
    };

    return apiSuccess("Product updated successfully", { product: formattedProduct });
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
      return apiError("Forbidden: Only ADMIN users can delete products", [], 403);
    }

    const { id } = await params;

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return apiError("Product not found", [], 404);
    }

    await prisma.product.delete({
      where: { id },
    });

    return apiSuccess("Product deleted successfully");
  } catch (error) {
    return apiError("Failed to delete product", [(error as Error).message], 500);
  }
}
