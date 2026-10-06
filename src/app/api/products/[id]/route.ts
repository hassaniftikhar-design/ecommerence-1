import { getCurrentUser, isAdmin, withAdmin } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import {
  getProductByIdServer,
  updateProductServer,
  deactivateProductServer
} from '@/server/services/product.service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(request);
    const userIsAdmin = Boolean(user && isAdmin(user));

    const product = await getProductByIdServer(id, userIsAdmin);

    if (!product) {
      return apiError('Product not found or inactive', [], 404);
    }

    return apiSuccess('Product retrieved successfully', { product });
  } catch (error) {
    return apiError('Failed to fetch product', [(error as Error).message], 500);
  }
}

export const PUT = withAdmin<{ params: Promise<{ id: string }> }>(
  async ({ request, params }) => {
    return handleUpdate(request, await params);
  }
);

export const PATCH = withAdmin<{ params: Promise<{ id: string }> }>(
  async ({ request, params }) => {
    return handleUpdate(request, await params);
  }
);

async function handleUpdate(request: Request, { id }: { id: string }) {
  try {
    const body = await request.json();
    const result = await updateProductServer(id, body);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess('Product updated successfully', { product: result.product }, result.status);
  } catch (error) {
    return apiError('Failed to update product', [(error as Error).message], 500);
  }
}

export const DELETE = withAdmin<{ params: Promise<{ id: string }> }>(
  async ({ params }) => {
    try {
      const { id } = await params;
      const result = await deactivateProductServer(id);

      if (!result.success) {
        return apiError(result.message, result.errors, result.status);
      }

      return apiSuccess(result.message);
    } catch (error) {
      return apiError('Failed to deactivate product', [(error as Error).message], 500);
    }
  }
);

