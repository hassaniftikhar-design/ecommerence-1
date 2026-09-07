import { apiSuccess, apiError } from '@/lib/api-response';
import { verifyFacebookEmailOtpServer } from '@/server/services/facebook-auth.service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await verifyFacebookEmailOtpServer(body);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message, { user: result.user }, result.status);
  } catch (error) {
    return apiError('An internal server error occurred', [(error as Error).message], 500);
  }
}
