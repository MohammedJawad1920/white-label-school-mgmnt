import { apiClient } from "./client";
import type {
  ListClassesResponse,
  CreateClassRequest,
  UpdateClassRequest,
  PromoteRequest,
  PromoteResult,
  GraduateResult,
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
  // v4.0 CR-21: body is a union — either { targetClassId } for promote or { action: "graduate" } for graduation
  promote: (sourceClassId: string, body: PromoteRequest) =>
    apiClient
      .put<
        PromoteResult | GraduateResult
      >(`/classes/${sourceClassId}/promote`, body)
      .then((r) => r.data),
};
