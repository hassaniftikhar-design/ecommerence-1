import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/server-auth";
import { createProductSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/api-response";

const DEFAULT_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
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
      orderBy: { createdAt: "desc" },
    });

    const formattedProducts = products.map((product) => ({
      ...product,
      price: Number(product.price),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    }));

    return apiSuccess("Products retrieved successfully", { products: formattedProducts });
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

    const { name, price, stock, imageUrl, categoryId, categoryName } = parsed.data;

    const finalImageUrl = imageUrl && imageUrl.trim() !== "" ? imageUrl.trim() : DEFAULT_PRODUCT_IMAGE;

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

    const product = await prisma.product.create({
      data: {
        name,
        price,
        stock,
        imageUrl: finalImageUrl,
        categoryId: category.id,
        createdById: adminUserId,
      },
      include: {
        category: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    const formattedProduct = {
      ...product,
      price: Number(product.price),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };

    return apiSuccess("Product created successfully", { product: formattedProduct }, 201);
  } catch (error) {
    return apiError("Failed to create product", [(error as Error).message], 500);
  }
}
