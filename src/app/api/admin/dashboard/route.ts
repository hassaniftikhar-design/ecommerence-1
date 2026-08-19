import { getCurrentUser, isAdmin } from "@/lib/server-auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { getAdminDashboardStatsServer } from "@/server/services/dashboard.service";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !isAdmin(user)) {
      return apiError("Forbidden: Only ADMIN users can access dashboard details", [], 403);
    }

    const stats = await getAdminDashboardStatsServer();
    return apiSuccess("Dashboard statistics retrieved successfully", stats);
  } catch (error) {
    return apiError("Failed to retrieve dashboard statistics", [(error as Error).message], 500);
  }
}
