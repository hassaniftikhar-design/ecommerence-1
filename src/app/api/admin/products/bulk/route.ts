import { getCurrentUser, isAdmin } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { schedulerClient } from '@/services/scheduler/scheduler.client';
import { saveUploadedImportFiles } from '@/lib/import-storage';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError('Forbidden: Only ADMIN users can import products', [], 403);
    }

    const adminUserId = (user.id || (user as any).sub)!;
    const contentType = request.headers.get('content-type') || '';

    // 1. Handle Multipart Form Data (Single file upload from modern admin UI)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const csvFile = (formData.get('file') || formData.get('csvFile')) as File | null;

      if (!csvFile || !(csvFile instanceof File)) {
        return apiError('Please provide a valid CSV or XLSX product file', [], 400);
      }

      if (!csvFile.name.toLowerCase().endsWith('.csv') && !csvFile.name.toLowerCase().endsWith('.xlsx')) {
        return apiError('Invalid file type. Only .csv and .xlsx files are supported.', [], 400);
      }

      // Collect any accompanying image files
      const imageEntries = formData.getAll('images') as File[];
      const fileEntries = formData.getAll('files') as File[];
      const rawImageFiles = [...imageEntries, ...fileEntries].filter(
        (f) => f instanceof File && /\.(jpe?g|png|webp|gif|svg)$/i.test(f.name)
      );

      const jobId = randomUUID();
      const saved = await saveUploadedImportFiles(jobId, csvFile, rawImageFiles);

      const result = await schedulerClient.enqueueBulkProductImportFile({
        jobId,
        createdById: adminUserId,
        filename: saved.filename,
        csvPath: saved.csvPath,
        imagesPath: saved.imagesPath
      });

      if (!result.success) {
        return apiError(result.error || 'Failed to queue bulk import job', [], 500);
      }

      return apiSuccess(
        'Product import has been queued for background processing',
        {
          jobId,
          taskId: result.taskId,
          filename: saved.filename,
          status: 'QUEUED'
        },
        202
      );
    }

    // 2. Handle JSON payload (Backward compatibility)
    const body = await request.json().catch(() => ({}));
    const products = body?.products;

    if (!Array.isArray(products) || products.length === 0) {
      return apiError('No products provided for bulk import', [], 400);
    }

    const result = await schedulerClient.enqueueBulkProductImport(products, adminUserId);

    if (!result.success) {
      return apiError(result.error || 'Failed to enqueue bulk import job', [], 500);
    }

    return apiSuccess(
      'Bulk product import job enqueued successfully',
      {
        taskId: result.taskId,
        totalCount: products.length,
        status: 'QUEUED'
      },
      202
    );
  } catch (error) {
    return apiError('Failed to process bulk import request', [(error as Error).message], 500);
  }
}