import { getCurrentUser, isAdmin } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { schedulerClient } from '@/services/scheduler/scheduler.client';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError('Forbidden: Only ADMIN users can access import review', [], 403);
    }

    const { id } = await params;
    if (!id) {
      return apiError('Missing import job ID', [], 400);
    }

    const res = await schedulerClient.getImportJobStatus(id);

    if (!res.success || !res.data) {
      return apiError(res.error || `Import job '${id}' not found`, [], 404);
    }

    const job = res.data;
    const totalFailed = job.failed_items;
    const resolvedCount = job.errors.filter((e) => e.resolution_status === 'RESOLVED').length;
    const remainingCount = totalFailed - resolvedCount;

    return apiSuccess('Import review details retrieved successfully', {
      job: {
        id: job.id,
        filename: job.filename || 'products.csv',
        status: job.status,
        totalItems: job.total_items,
        processedItems: job.processed_items,
        successfulItems: job.successful_items,
        failedItems: job.failed_items,
        createdAt: job.created_at,
        completedAt: job.completed_at
      },
      summary: {
        totalFailed,
        resolvedCount,
        remainingCount
      },
      errors: job.errors
    }, 200);
  } catch (error) {
    return apiError('Failed to fetch import review details', [(error as Error).message], 500);
  }
}
