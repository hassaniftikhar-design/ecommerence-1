import { getCurrentUser, isAdmin } from '@/lib/server-auth';
import { schedulerClient } from '@/services/scheduler/scheduler.client';

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
    if (!id) {
      return new Response('Missing import job ID', { status: 400 });
    }

    const res = await schedulerClient.getImportJobStatus(id);

    if (!res.success || !res.data) {
      return new Response('Import job not found', { status: 404 });
    }

    const errors = res.data.errors || [];
    const csvRows = [
      ['Row', 'Product Name', 'Error Type', 'Error Message', 'Resolution Status', 'Product ID'].join(',')
    ];

    for (const err of errors) {
      const rowNum = err.row_index;
      const name = `"${(err.product_name || 'Unnamed').replace(/"/g, '""')}"`;
      const errType = `"${(err.error_type || 'VALIDATION_ERROR').replace(/"/g, '""')}"`;
      const errMsg = `"${(err.error || 'Unknown error').replace(/"/g, '""')}"`;
      const status = `"${(err.resolution_status || 'PENDING').replace(/"/g, '""')}"`;
      const prodId = `"${(err.product_id || '').replace(/"/g, '""')}"`;

      csvRows.push([rowNum, name, errType, errMsg, status, prodId].join(','));
    }

    const csvContent = csvRows.join('\n');
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="import-errors-${id}.csv"`
      }
    });
  } catch (error) {
    return new Response('Failed to generate error export', { status: 500 });
  }
}
