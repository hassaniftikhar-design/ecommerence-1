import { withAdmin } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { uploadProductImageServer } from '@/server/services/upload.service';

export const POST = withAdmin(async ({ request }) => {
  try {
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
});

