import { withAuth } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { changePasswordServer } from '@/server/services/auth.service';

export const POST = withAuth(async ({ request, userId }) => {
  try {
    const body = await request.json();
    const result = await changePasswordServer(userId, body);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message);
  } catch (error) {
    return apiError('An internal server error occurred', [(error as Error).message], 500);
  }
});

