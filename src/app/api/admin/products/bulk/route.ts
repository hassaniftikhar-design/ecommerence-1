import { withAdmin } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import {
  validateBulkImportFileInput,
  validateBulkImportJsonInput
} from '@/server/middlewares';
import {
  enqueueBulkProductImportFileServer,
  enqueueBulkProductImportJsonServer
} from '@/server/services/admin-import.service';

export const POST = withAdmin(async ({ request, userId }) => {
  try {
    const adminUserId = userId;
    const contentType = request.headers.get('content-type') || '';

    // 1. Handle Multipart Form Data
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const rawFile = (formData.get('file') || formData.get('csvFile')) as File | null;

      const fileValidation = validateBulkImportFileInput(rawFile);
      if (!fileValidation.success) {
        return apiError(fileValidation.message, fileValidation.errors, fileValidation.status);
      }

      // Collect any accompanying image files
      const imageEntries = formData.getAll('images') as File[];
      const fileEntries = formData.getAll('files') as File[];
      const rawImageFiles = [...imageEntries, ...fileEntries].filter(
        (f) => f instanceof File && /\.(jpe?g|png|webp|gif|svg)$/i.test(f.name)
      );

      const result = await enqueueBulkProductImportFileServer({
        adminUserId,
        csvFile: fileValidation.data,
        rawImageFiles
      });

      if (!result.success) {
        return apiError(result.message, result.errors, result.status);
      }

      return apiSuccess(result.message, result.data, result.status);
    }

    // 2. Handle JSON payload
    const body = await request.json().catch(() => ({}));
    const jsonValidation = validateBulkImportJsonInput(body?.products);

    if (!jsonValidation.success) {
      return apiError(jsonValidation.message, jsonValidation.errors, jsonValidation.status);
    }

    const result = await enqueueBulkProductImportJsonServer({
      adminUserId,
      products: jsonValidation.data
    });

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message, result.data, result.status);
  } catch (error) {
    return apiError('Failed to process bulk import request', [(error as Error).message], 500);
  }
});

