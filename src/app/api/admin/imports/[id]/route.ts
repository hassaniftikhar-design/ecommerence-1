import { getCurrentUser, isAdmin } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { schedulerClient } from '@/services/scheduler/scheduler.client';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError('Forbidden: Only ADMIN users can access import status', [], 403);
    }

    const { id } = await params;
    if (!id) {
      return apiError('Missing import job ID', [], 400);
    }

    const res = await schedulerClient.getImportJobStatus(id);

    if (!res.success || !res.data) {
      return apiError(res.error || `Import job '${id}' not found`, [], 404);
    }

    return apiSuccess('Import job status retrieved successfully', res.data, 200);
  } catch (error) {
    return apiError('Failed to fetch import job status', [(error as Error).message], 500);
  }
}
