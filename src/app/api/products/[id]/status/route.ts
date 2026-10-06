import { withAdmin } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { updateProductStatusServer } from '@/server/services/product.service';

export const PATCH = withAdmin<{ params: Promise<{ id: string }> }>(
  async ({ request, params }) => {
    try {
      const { id } = await params;
      const body = await request.json();

      if (typeof body.isActive !== 'boolean') {
        return apiError('Validation failed', ['isActive boolean field is required'], 400);
      }

      const result = await updateProductStatusServer(id, body.isActive);

      if (!result.success) {
        return apiError(result.message, result.errors, result.status);
      }

      return apiSuccess(result.message, { product: result.product }, result.status);
    } catch (error) {
      return apiError('Failed to update product status', [(error as Error).message], 500);
    }
  }
);

