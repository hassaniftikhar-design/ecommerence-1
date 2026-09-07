import { apiSuccess, apiError } from '@/lib/api-response';
import { getCurrentUser } from '@/lib/server-auth';
import {
  getUserAddressServer,
  updateUserAddressServer
} from '@/server/services/user.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!user || !userId) {
      return apiError('Unauthorized: Please log in', [], 401);
    }

    const result = await getUserAddressServer(userId);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message, { address: result.address }, result.status);
  } catch (error) {
    return apiError('Failed to fetch address', [(error as Error).message], 500);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!user || !userId) {
      return apiError('Unauthorized: Please log in', [], 401);
    }

    const body = await request.json();
    const result = await updateUserAddressServer(userId, body);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message, { address: result.address }, result.status);
  } catch (error) {
    return apiError('Failed to update address', [(error as Error).message], 500);
  }
}

