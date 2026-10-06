import { apiSuccess, apiError } from '@/lib/api-response';
import { withAuth } from '@/lib/server-auth';
import {
  getUserAddressServer,
  updateUserAddressServer
} from '@/server/services/user.service';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async ({ userId }) => {
  try {
    const result = await getUserAddressServer(userId);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message, { address: result.address }, result.status);
  } catch (error) {
    return apiError('Failed to fetch address', [(error as Error).message], 500);
  }
});

export const PUT = withAuth(async ({ request, userId }) => {
  try {
    const body = await request.json();
    const result = await updateUserAddressServer(userId, body);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message, { address: result.address }, result.status);
  } catch (error) {
    return apiError('Failed to update address', [(error as Error).message], 500);
  }
});

