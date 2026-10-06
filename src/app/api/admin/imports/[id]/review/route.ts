import { withAdmin } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { validateImportJobIdInput } from '@/server/middlewares';
import { getImportJobReviewServer } from '@/server/services/admin-import.service';

export const GET = withAdmin<{ params: Promise<{ id: string }> }>(
  async ({ params }) => {
    try {
      const { id } = await params;
      const validation = validateImportJobIdInput(id);
      if (!validation.success) {
        return apiError(validation.message, validation.errors, validation.status);
      }

      const result = await getImportJobReviewServer(validation.data);

      if (!result.success) {
        return apiError(result.message, result.errors, result.status);
      }

      return apiSuccess(result.message, result.data, result.status);
    } catch (error) {
      return apiError('Failed to fetch import review details', [(error as Error).message], 500);
    }
  }
);

