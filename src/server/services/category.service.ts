import { prisma } from '@/lib/prisma';
import { validateCreateCategoryInput } from '@/server/middlewares';

export async function getCategoriesServer() {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' }
  });
  return categories;
}

export async function createCategoryServer(name: unknown) {
  const validation = validateCreateCategoryInput(name);
  if (!validation.success) {
    return validation;
  }

  const trimmedName = validation.data;

  const category = await prisma.category.upsert({
    where: { name: trimmedName },
    update: {},
    create: { name: trimmedName }
  });

  return { success: true as const, status: 201, category, message: 'Category created successfully' };
}
