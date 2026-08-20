import { NOTIFICATIONS_PER_PAGE } from "@/constants/generalconstants";
import type { NotificationsResponse } from "@/types/notification.types";

export async function getNotifications(
  page: number = 1,
  limit: number = NOTIFICATIONS_PER_PAGE
): Promise<NotificationsResponse> {
  const res = await fetch(`/api/notifications?page=${page}&limit=${limit}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    return { notifications: [], unreadCount: 0, hasMore: false, total: 0 };
  }

  const json = await res.json();
  return json.data || { notifications: [], unreadCount: 0, hasMore: false, total: 0 };
}

export async function markNotificationAsRead(id?: string, markAll: boolean = false): Promise<boolean> {
  const res = await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notificationId: id, markAll }),
  });

  return res.ok;
}
