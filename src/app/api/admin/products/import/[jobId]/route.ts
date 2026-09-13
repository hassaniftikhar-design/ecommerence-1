import { getCurrentUser, isAdmin } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { schedulerClient } from '@/services/scheduler/scheduler.client';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError('Forbidden: Only ADMIN users can inspect import job status', [], 403);
    }

    const { jobId } = await params;
    if (!jobId) {
      return apiError('Missing jobId parameter', [], 400);
    }

    const result = await schedulerClient.getImportJobStatus(jobId);

    if (!result.success || !result.data) {
      return apiError(result.error || 'Failed to fetch import job status', [], 404);
    }

    return apiSuccess('Import job status retrieved', result.data, 200);
  } catch (error) {
    return apiError('Failed to fetch job status', [(error as Error).message], 500);
  }
}
