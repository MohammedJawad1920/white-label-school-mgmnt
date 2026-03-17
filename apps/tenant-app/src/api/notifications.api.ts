import { apiClient } from "./client";
import type { Notification } from "@/types/api";

export interface NotificationFilters {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

export const notificationsApi = {
  list: (filters?: NotificationFilters) =>
    apiClient
      .get<{
        notifications: Notification[];
        total: number;
        unreadCount: number;
      }>("/notifications", { params: filters })
      .then((r) => r.data),

  markRead: (id: string) =>
    apiClient
      .put<Notification>(`/notifications/${id}/read`)
      .then((r) => r.data),

  markAllRead: () =>
    apiClient
      .put<{ updatedCount: number }>("/notifications/read-all")
      .then((r) => r.data),

  subscribe: (subscription: {
    endpoint: string;
    p256dh: string;
    auth: string;
  }) =>
    apiClient
      .post<{ message: string }>("/push/subscribe", subscription)
      .then((r) => r.data),

  unsubscribe: (endpoint: string) =>
    apiClient
      .delete<{ message: string }>("/push/subscribe", { data: { endpoint } })
      .then((r) => r.data),
};
