import { prisma } from "@/lib/prisma";

export async function getCategoriesServer() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });
  return categories;
}

export async function createCategoryServer(name: string) {
  if (!name || !name.trim()) {
    return { success: false as const, status: 400, errors: [], message: "Category name is required" };
  }

  const trimmedName = name.trim();

  const category = await prisma.category.upsert({
    where: { name: trimmedName },
    update: {},
    create: { name: trimmedName },
  });

  return { success: true as const, status: 201, category, message: "Category created successfully" };
}
