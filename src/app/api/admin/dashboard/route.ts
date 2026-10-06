import { withAdmin } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { getAdminDashboardStatsServer } from '@/server/services/dashboard.service';

export const GET = withAdmin(async () => {
  try {
    const stats = await getAdminDashboardStatsServer();
    return apiSuccess('Dashboard statistics retrieved successfully', stats);
  } catch (error) {
    return apiError('Failed to retrieve dashboard statistics', [(error as Error).message], 500);
  }
});

