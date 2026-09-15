import { prisma } from '@/lib/prisma';
import { validateMarkNotificationReadInput } from '@/server/middlewares';
import { emitToUser } from '@/lib/socket/server';

export interface CreateNotificationParams {
  recipientId: string;
  type: string;
  title: string;
  message: string;
  orderId?: string | null;
}

/**
 * Creates a notification in the database, calculates the recipient's unread count,
 * and emits real-time events exclusively to the recipient's active sockets.
 */
export async function createAndEmitNotificationServer({
  recipientId,
  type,
  title,
  message,
  orderId
}: CreateNotificationParams) {
  if (!recipientId) {
    throw new Error('recipientId is required to create a notification');
  }

  const notification = await prisma.notification.create({
    data: {
      userId: recipientId,
      type,
      title,
      message,
      orderId: orderId || null,
      isRead: false
    }
  });

  const unreadCount = await prisma.notification.count({
    where: {
      userId: recipientId,
      isRead: false
    }
  });

  // Emit to all connected sockets belonging to this specific recipient
  emitToUser(recipientId, 'notification:new', notification);
  emitToUser(recipientId, 'notification:unread-count', { count: unreadCount });

  return notification;
}

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
  } else if (validNotificationId) {
    await prisma.notification.updateMany({
      where: { id: validNotificationId, userId },
      data: { isRead: true }
    });
  } else {
    return {
      success: false as const,
      status: 400,
      errors: [],
      message: 'Missing notificationId or markAll flag'
    };
  }

  // Recalculate recipient's unread count and synchronize all open tabs immediately
  const newUnreadCount = await prisma.notification.count({
    where: { userId, isRead: false }
  });

  emitToUser(userId, 'notification:unread-count', { count: newUnreadCount });

  return {
    success: true as const,
    status: 200,
    message: 'Notification status updated',
    unreadCount: newUnreadCount
  };
}

