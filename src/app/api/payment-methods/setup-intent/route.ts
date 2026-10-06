import { apiSuccess, apiError } from '@/lib/api-response';
import { withAuth } from '@/lib/server-auth';
import { createSetupIntentServer } from '@/server/services/payment.service';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async ({ userId }) => {
  try {
    const result = await createSetupIntentServer(userId);

    if (!result.success) {
      return apiError(result.message, result.errors || [], result.status);
    }

    return apiSuccess(result.message, result.data, result.status);
  } catch (error) {
    return apiError('Failed to initialize payment setup', [
      (error as Error).message
    ], 500);
  }
});

