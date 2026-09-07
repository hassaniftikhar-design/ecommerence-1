import { apiSuccess, apiError } from '@/lib/api-response';
import { sendFacebookEmailOtpServer } from '@/server/services/facebook-auth.service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await sendFacebookEmailOtpServer(body);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message, undefined, result.status);
  } catch (error) {
    return apiError('An internal server error occurred', [(error as Error).message], 500);
  }
}
