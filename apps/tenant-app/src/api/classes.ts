import { apiClient } from "./client";
import type {
  ListClassesResponse,
  CreateClassRequest,
  UpdateClassRequest,
  Class,
  BulkDeleteRequest,
  BulkDeleteResponse,
} from "@/types/api";

export const classesApi = {
  list: () =>
    apiClient.get<ListClassesResponse>("/classes").then((r) => r.data),
  create: (data: CreateClassRequest) =>
    apiClient.post<{ class: Class }>("/classes", data).then((r) => r.data),
  update: (id: string, data: UpdateClassRequest) =>
    apiClient.put<{ class: Class }>(`/classes/${id}`, data).then((r) => r.data),
  delete: (id: string) =>
    apiClient.delete<void>(`/classes/${id}`).then((r) => r.data),
  bulkDelete: (data: BulkDeleteRequest) =>
    apiClient
      .delete<BulkDeleteResponse>("/classes/bulk", { data })
      .then((r) => r.data),
};
