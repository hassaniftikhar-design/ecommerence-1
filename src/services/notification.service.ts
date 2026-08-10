import type { NotificationsResponse } from "@/types/notification.types";

export async function getNotifications(): Promise<NotificationsResponse> {
  const res = await fetch("/api/notifications", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    return { notifications: [], unreadCount: 0 };
  }

  const json = await res.json();
  return json.data || { notifications: [], unreadCount: 0 };
}

export async function markNotificationAsRead(id?: string, markAll: boolean = false): Promise<boolean> {
  const res = await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notificationId: id, markAll }),
  });

  return res.ok;
}
