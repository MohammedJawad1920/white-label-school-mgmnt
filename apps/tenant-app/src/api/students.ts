import { apiClient } from "./client";
import type {
  ListStudentsResponse,
  CreateStudentRequest,
  CreateStudentResponse,
  BulkDeleteRequest,
  BulkDeleteResponse,
} from "@/types/api";

export const studentsApi = {
  list: (params?: {
    classId?: string;
    batchId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) =>
    apiClient
      .get<ListStudentsResponse>("/students", { params })
      .then((r) => r.data),
  create: (data: CreateStudentRequest) =>
    apiClient
      .post<CreateStudentResponse>("/students", data)
      .then((r) => r.data),
  delete: (id: string) =>
    apiClient.delete<void>(`/students/${id}`).then((r) => r.data),
  bulkDelete: (data: BulkDeleteRequest) =>
    apiClient
      .delete<BulkDeleteResponse>("/students/bulk", { data })
      .then((r) => r.data),
};
