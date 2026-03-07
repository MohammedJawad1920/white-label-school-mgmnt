import { apiClient } from "./client";
import type {
  ListSubjectsResponse,
  CreateSubjectRequest,
  UpdateSubjectRequest,
  Subject,
  BulkDeleteResponse,
} from "@/types/api";

export const subjectsApi = {
  list: () =>
    apiClient.get<ListSubjectsResponse>("/subjects").then((r) => r.data),
  create: (data: CreateSubjectRequest) =>
    apiClient.post<{ subject: Subject }>("/subjects", data).then((r) => r.data),
  update: (id: string, data: UpdateSubjectRequest) =>
    apiClient
      .put<{ subject: Subject }>(`/subjects/${id}`, data)
      .then((r) => r.data),
  delete: (id: string) =>
    apiClient.delete<void>(`/subjects/${id}`).then((r) => r.data),
  bulkDelete: (subjectIds: string[]) =>
    apiClient
      .post<BulkDeleteResponse>("/subjects/bulk", { subjectIds })
      .then((r) => r.data),
};
