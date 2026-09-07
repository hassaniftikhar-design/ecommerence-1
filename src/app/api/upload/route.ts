import { getCurrentUser, isAdmin } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { uploadProductImageServer } from '@/server/services/upload.service';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError('Forbidden: Only ADMIN users can upload images', [], 403);
    }

    const formData = await request.formData();
    const file = formData.get('file');

    const result = await uploadProductImageServer(file);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message, { url: result.url }, result.status);
  } catch (error) {
    return apiError('Failed to upload image', [(error as Error).message], 500);
  }
}

