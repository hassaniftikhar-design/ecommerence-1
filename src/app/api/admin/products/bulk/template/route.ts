import { NextResponse } from 'next/server';

import { getCurrentUser, isAdmin } from '@/lib/server-auth';
import { apiError } from '@/lib/api-response';
import { generateBulkProductImportTemplateServer } from '@/server/services/admin-import.service';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError(
        'Forbidden: Only ADMIN users can download import templates',
        [],
        403
      );
    }

    const buffer = await generateBulkProductImportTemplateServer();

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="product_bulk_import_template.xlsx"'
      }
    });
  } catch (error) {
    return apiError(
      'Failed to generate template',
      [(error as Error).message],
      500
    );
  }
}

