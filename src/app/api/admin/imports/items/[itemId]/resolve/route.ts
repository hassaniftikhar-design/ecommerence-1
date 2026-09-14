import { getCurrentUser, isAdmin } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { validateResolveImportItemInput } from '@/server/middlewares';
import { resolveImportItemServer } from '@/server/services/admin-import.service';

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
    const body = await request.json().catch(() => ({}));

    const validation = validateResolveImportItemInput(itemId, body);
    if (!validation.success) {
      return apiError(validation.message, validation.errors, validation.status);
    }

    const result = await resolveImportItemServer(validation.data);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message, result.data, result.status);
  } catch (error) {
    return apiError('Failed to resolve import item', [(error as Error).message], 500);
  }
}
