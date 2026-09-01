import { getCurrentUser, isAdmin } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import {
  getCategoriesServer,
  createCategoryServer
} from '@/server/services/category.service';

export async function GET() {
  try {
    const categories = await getCategoriesServer();
    return apiSuccess('Categories retrieved successfully', { categories });
  } catch (error) {
    return apiError('Failed to fetch categories', [(error as Error).message], 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError('Forbidden: Only ADMIN users can create categories', [], 403);
    }

    const body = await request.json();
    const { name } = body as { name?: string };

    const result = await createCategoryServer(name || '');

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message, { category: result.category }, result.status);
  } catch (error) {
    return apiError('Failed to create category', [(error as Error).message], 500);
  }
}
