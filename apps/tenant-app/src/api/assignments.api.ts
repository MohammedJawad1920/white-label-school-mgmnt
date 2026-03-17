import { apiClient } from "./client";
import type {
  Assignment,
  AssignmentSubmission,
  BulkMarkRequest,
} from "@/types/api";

export interface AssignmentFilters {
  classId?: string;
  sessionId?: string;
  subjectId?: string;
  status?: string;
}

export const assignmentsApi = {
  create: (data: {
    title: string;
    description?: string;
    assignmentType: string;
    classId: string;
    subjectId: string;
    sessionId: string;
    dueDate?: string;
    maxMarks?: number;
  }) => apiClient.post<Assignment>("/assignments", data).then((r) => r.data),

  list: (filters?: AssignmentFilters) =>
    apiClient
      .get<{ assignments: Assignment[] }>("/assignments", { params: filters })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Assignment>(`/assignments/${id}`).then((r) => r.data),

  update: (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      dueDate: string;
      maxMarks: number;
    }>,
  ) =>
    apiClient.put<Assignment>(`/assignments/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient
      .delete<{ message: string }>(`/assignments/${id}`)
      .then((r) => r.data),

  close: (id: string) =>
    apiClient.put<Assignment>(`/assignments/${id}/close`).then((r) => r.data),

  getSubmissions: (id: string) =>
    apiClient
      .get<{
        submissions: AssignmentSubmission[];
      }>(`/assignments/${id}/submissions`)
      .then((r) => r.data),

  bulkMark: (id: string, data: BulkMarkRequest) =>
    apiClient
      .put<{ updated: number }>(`/assignments/${id}/submissions`, data)
      .then((r) => r.data),
};
