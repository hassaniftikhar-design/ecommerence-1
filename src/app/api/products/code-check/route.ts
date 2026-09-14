import { getCurrentUser, isAdmin } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import {
  checkProductCodeAvailableServer,
  getNextAvailableProductCodeServer
} from '@/server/services/product.service';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user || !isAdmin(user)) {
      return apiError('Forbidden: Only ADMIN users can check product codes', [], 403);
    }

    const { searchParams } = new URL(request.url);
    const code = (searchParams.get('code') || '').trim();
    const title = (searchParams.get('title') || searchParams.get('prefix') || '').trim();
    const category = (searchParams.get('category') || '').trim();
    const excludeId = (searchParams.get('excludeId') || '').trim() || undefined;

    if (code) {
      const result = await checkProductCodeAvailableServer(code, excludeId);
      return apiSuccess('Product code checked successfully', result);
    }

    const nextAvailableCode = await getNextAvailableProductCodeServer(title, category, excludeId);
    return apiSuccess('Next available product code retrieved', {
      available: true,
      code: nextAvailableCode,
      nextAvailableCode
    });
  } catch (error) {
    return apiError('Failed to check product code', [(error as Error).message], 500);
  }
}
