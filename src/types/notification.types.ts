export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "ORDER_PLACED" | "ORDER_STATUS_UPDATED" | string;
  orderId?: string | null;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
  hasMore?: boolean;
  total?: number;
}
