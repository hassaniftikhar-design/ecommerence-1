import { apiSuccess, apiError } from '@/lib/api-response';
import {
  validateResetTokenServer,
  resetPasswordServer
} from '@/server/services/auth.service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token') || '';

    const result = await validateResetTokenServer(token);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message, result.data);
  } catch (error) {
    return apiError('An internal server error occurred', [(error as Error).message], 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await resetPasswordServer(body);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message);
  } catch (error) {
    return apiError('An internal server error occurred', [(error as Error).message], 500);
  }
}
