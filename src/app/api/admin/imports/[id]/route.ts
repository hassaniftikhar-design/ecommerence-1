import { getCurrentUser, isAdmin } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { validateImportJobIdInput } from '@/server/middlewares';
import { getImportJobStatusServer } from '@/server/services/admin-import.service';

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
    const validation = validateImportJobIdInput(id);
    if (!validation.success) {
      return apiError(validation.message, validation.errors, validation.status);
    }

    const result = await getImportJobStatusServer(validation.data);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message, result.data, result.status);
  } catch (error) {
    return apiError('Failed to fetch import job status', [(error as Error).message], 500);
  }
}
