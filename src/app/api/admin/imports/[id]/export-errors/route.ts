import { getCurrentUser, isAdmin } from '@/lib/server-auth';
import { validateImportJobIdInput } from '@/server/middlewares';
import { exportImportErrorsCsvServer } from '@/server/services/admin-import.service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return new Response('Forbidden', { status: 403 });
    }

    const { id } = await params;
    const validation = validateImportJobIdInput(id);
    if (!validation.success) {
      return new Response(validation.message, { status: validation.status });
    }

    const result = await exportImportErrorsCsvServer(validation.data);

    if (!result.success) {
      return new Response(result.message, { status: result.status });
    }

    return new Response(result.csvContent, {
      status: result.status,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${result.filename}"`
      }
    });
  } catch {
    return new Response('Failed to generate error export', { status: 500 });
  }
}

