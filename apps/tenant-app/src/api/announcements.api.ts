import { apiClient } from "./client";
import type { Announcement, CreateAnnouncementRequest } from "@/types/api";

export interface AnnouncementFilters {
  limit?: number;
  offset?: number;
}

export const announcementsApi = {
  create: (data: CreateAnnouncementRequest) =>
    apiClient.post<Announcement>("/announcements", data).then((r) => r.data),

  list: (filters?: AnnouncementFilters) =>
    apiClient
      .get<{ announcements: Announcement[]; total: number }>("/announcements", {
        params: filters,
      })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Announcement>(`/announcements/${id}`).then((r) => r.data),

  update: (id: string, data: Partial<CreateAnnouncementRequest>) =>
    apiClient
      .put<Announcement>(`/announcements/${id}`, data)
      .then((r) => r.data),

  delete: (id: string) =>
    apiClient
      .delete<{ message: string }>(`/announcements/${id}`)
      .then((r) => r.data),
};
