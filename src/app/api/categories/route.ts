import { prisma } from "@/lib/prisma";
import { getCurrentUser, isAdmin } from "@/lib/server-auth";
import { apiSuccess, apiError } from "@/lib/api-response";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });

    return apiSuccess("Categories retrieved successfully", { categories });
  } catch (error) {
    return apiError("Failed to fetch categories", [(error as Error).message], 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError("Forbidden: Only ADMIN users can create categories", [], 403);
    }

    const body = await request.json();
    const { name } = body as { name?: string };

    if (!name || !name.trim()) {
      return apiError("Category name is required", [], 400);
    }

    const trimmedName = name.trim();

    const category = await prisma.category.upsert({
      where: { name: trimmedName },
      update: {},
      create: { name: trimmedName },
    });

    return apiSuccess("Category created successfully", { category }, 201);
  } catch (error) {
    return apiError("Failed to create category", [(error as Error).message], 500);
  }
}
