import { getCurrentUser } from '@/lib/server-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import {
  getNotificationsServer,
  markNotificationReadServer
} from '@/server/services/notification.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!userId) {
      return apiSuccess('Unauthenticated', { notifications: [], unreadCount: 0, hasMore: false, total: 0 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const data = await getNotificationsServer(userId, page, limit);
    return apiSuccess('Notifications retrieved successfully', data);
  } catch (error) {
    return apiError('Failed to fetch notifications', [(error as Error).message], 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!userId) {
      return apiError('Unauthorized', [], 401);
    }

    const body = await request.json();
    const { notificationId, markAll } = body as {
      notificationId?: string;
      markAll?: boolean;
    };

    const result = await markNotificationReadServer(userId, notificationId, markAll);

    if (!result.success) {
      return apiError(result.message, result.errors, result.status);
    }

    return apiSuccess(result.message, {});
  } catch (error) {
    return apiError('Failed to update notification', [(error as Error).message], 500);
  }
}
