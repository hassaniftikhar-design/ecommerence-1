import { prisma } from "@/lib/prisma";

export async function getNotificationsServer(userId: string) {
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

  return { notifications, unreadCount };
}

export async function markNotificationReadServer(
  userId: string,
  notificationId?: string,
  markAll?: boolean
) {
  if (markAll) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true as const, status: 200, message: "Notification status updated" };
  } else if (notificationId) {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
    return { success: true as const, status: 200, message: "Notification status updated" };
  } else {
    return {
      success: false as const,
      status: 400,
      errors: [],
      message: "Missing notificationId or markAll flag",
    };
  }
}
