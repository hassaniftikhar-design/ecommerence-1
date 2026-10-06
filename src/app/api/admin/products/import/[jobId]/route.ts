import { withAdmin } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { validateImportJobIdInput } from '@/server/middlewares';
import { getImportJobStatusServer } from '@/server/services/admin-import.service';

export const GET = withAdmin<{ params: Promise<{ jobId: string }> }>(
  async ({ params }) => {
    try {
      const { jobId } = await params;
      const validation = validateImportJobIdInput(jobId);
      if (!validation.success) {
        return apiError(validation.message, validation.errors, validation.status);
      }

      const result = await getImportJobStatusServer(validation.data);

      if (!result.success) {
        return apiError(result.message, result.errors, result.status);
      }

      return apiSuccess('Import job status retrieved', result.data, result.status);
    } catch (error) {
      return apiError('Failed to fetch job status', [(error as Error).message], 500);
    }
  }
);

