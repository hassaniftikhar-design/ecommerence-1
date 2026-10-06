import { withAdmin } from '@/lib/server-auth';
import { validateImportJobIdInput } from '@/server/middlewares';
import { exportImportErrorsCsvServer } from '@/server/services/admin-import.service';

export const GET = withAdmin<{ params: Promise<{ id: string }> }>(
  async ({ params }) => {
    try {
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
);

