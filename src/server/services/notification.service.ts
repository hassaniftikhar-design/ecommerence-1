import { prisma } from '@/lib/prisma';
import { validateMarkNotificationReadInput } from '@/server/middlewares';

export async function getNotificationsServer(
  userId: string,
  page: number = 1,
  limit: number = 10,
  type?: string
) {
  const skip = (page - 1) * limit;
  const whereClause = {
    userId,
    ...(type ? { type } : {})
  };

  const [notifications, unreadCount, total] = await Promise.all([
    prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.notification.count({
      where: { ...whereClause, isRead: false }
    }),
    prisma.notification.count({
      where: whereClause
    })
  ]);

  const hasMore = skip + notifications.length < total;

  return { notifications, unreadCount, total, hasMore };
}

export async function markNotificationReadServer(
  userId: string,
  notificationId?: string,
  markAll?: boolean
) {
  const validation = validateMarkNotificationReadInput(notificationId, markAll);
  if (!validation.success) {
    return validation;
  }

  const { notificationId: validNotificationId, markAll: isMarkAll } = validation.data;

  if (isMarkAll) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
    return { success: true as const, status: 200, message: 'Notification status updated' };
  } else if (validNotificationId) {
    await prisma.notification.updateMany({
      where: { id: validNotificationId, userId },
      data: { isRead: true }
    });
    return { success: true as const, status: 200, message: 'Notification status updated' };
  }

  return {
    success: false as const,
    status: 400,
    errors: [],
    message: 'Missing notificationId or markAll flag'
  };
}
