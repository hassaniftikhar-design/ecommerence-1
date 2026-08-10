import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server-auth";
import { apiSuccess, apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!userId) {
      return apiSuccess("Unauthenticated", { notifications: [], unreadCount: 0 });
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return apiSuccess("Notifications retrieved successfully", {
      notifications,
      unreadCount,
    });
  } catch (error) {
    return apiError("Failed to fetch notifications", [(error as Error).message], 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || user?.sub;

    if (!userId) {
      return apiError("Unauthorized", [], 401);
    }

    const body = await request.json();
    const { notificationId, markAll } = body as {
      notificationId?: string;
      markAll?: boolean;
    };

    if (markAll) {
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
    } else if (notificationId) {
      await prisma.notification.updateMany({
        where: { id: notificationId, userId },
        data: { isRead: true },
      });
    } else {
      return apiError("Missing notificationId or markAll flag", [], 400);
    }

    return apiSuccess("Notification status updated", {});
  } catch (error) {
    return apiError("Failed to update notification", [(error as Error).message], 500);
  }
}
