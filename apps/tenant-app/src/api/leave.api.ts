import { apiClient } from "./client";
import type { LeaveRequest, SubmitLeaveRequest } from "@/types/api";

export interface LeaveFilters {
  classId?: string;
  studentId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export const leaveApi = {
  submit: (data: SubmitLeaveRequest) =>
    apiClient.post<LeaveRequest>("/leave", data).then((r) => r.data),

  list: (filters?: LeaveFilters) =>
    apiClient
      .get<{
        leaves: LeaveRequest[];
        total: number;
      }>("/leave", { params: filters })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient.get<LeaveRequest>(`/leave/${id}`).then((r) => r.data),

  approve: (id: string) =>
    apiClient.put<LeaveRequest>(`/leave/${id}/approve`).then((r) => r.data),

  reject: (id: string, rejectionReason: string) =>
    apiClient
      .put<LeaveRequest>(`/leave/${id}/reject`, { rejectionReason })
      .then((r) => r.data),

  cancel: (id: string) =>
    apiClient.put<LeaveRequest>(`/leave/${id}/cancel`).then((r) => r.data),

  depart: (id: string) =>
    apiClient.put<LeaveRequest>(`/leave/${id}/depart`).then((r) => r.data),

  return: (id: string) =>
    apiClient.put<LeaveRequest>(`/leave/${id}/return`).then((r) => r.data),

  onCampus: () =>
    apiClient
      .get<{ leaves: LeaveRequest[] }>("/leave/on-campus")
      .then((r) => r.data),
};
