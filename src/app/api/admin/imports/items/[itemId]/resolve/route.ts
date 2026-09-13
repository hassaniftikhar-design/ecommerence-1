import { getCurrentUser, isAdmin } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { schedulerClient } from '@/services/scheduler/scheduler.client';
import { prisma } from '@/lib/prisma';
import { cleanupImportStorage } from '@/lib/import-storage';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError('Forbidden: Only ADMIN users can resolve import items', [], 403);
    }

    const { itemId } = await params;
    if (!itemId) {
      return apiError('Missing import item ID', [], 400);
    }

    const body = await request.json().catch(() => ({}));
    const jobId = body?.jobId;
    const productId = body?.productId;

    if (!jobId) {
      return apiError('Missing jobId parameter', [], 400);
    }

    // 1. Update in database via scheduler client
    const res = await schedulerClient.resolveImportItem(jobId, itemId, productId);

    if (!res.success) {
      return apiError(res.error || 'Failed to resolve import item', [], 500);
    }

    // 2. If product_id exists, ensure product is active in DB
    if (productId) {
      await prisma.product.update({
        where: { id: productId },
        data: { isActive: true, inactiveAt: null }
      }).catch((err) => {
        console.warn(`Could not update product ${productId} active status:`, err);
      });
    }

    // 3. Check if all failed items for this job are resolved, and update notification
    const remainingUnresolved = await prisma.importItem.count({
      where: {
        job_id: jobId,
        status: 'FAILED',
        resolution_status: { not: 'RESOLVED' }
      }
    });

    if (remainingUnresolved === 0) {
      // Clean up physical files from disk now that all errors are resolved
      await cleanupImportStorage(jobId);

      const job = await prisma.importJob.findUnique({ where: { id: jobId } });
      const filename = job?.filename || 'products.csv';
      await prisma.notification.updateMany({
        where: {
          type: 'IMPORT_ERRORS',
          orderId: jobId
        },
        data: {
          title: 'Import Errors Resolved',
          message: `All product import errors for ${filename} have been resolved.`,
          isRead: true
        }
      });
    }

    return apiSuccess('Import item marked as resolved successfully', {
      itemId,
      productId,
      resolutionStatus: 'RESOLVED',
      remainingUnresolved
    }, 200);
  } catch (error) {
    return apiError('Failed to resolve import item', [(error as Error).message], 500);
  }
}
