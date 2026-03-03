import { apiClient } from "./client";
import type {
  ListStudentsResponse,
  CreateStudentRequest,
  CreateStudentResponse,
  UpdateStudentRequest,
  UpdateStudentResponse,
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
  // v3.5 CR-13: update student (dob/admissionNumber change resets login credentials)
  update: (id: string, data: UpdateStudentRequest) =>
    apiClient
      .put<UpdateStudentResponse>(`/students/${id}`, data)
      .then((r) => r.data),
  delete: (id: string) =>
    apiClient.delete<void>(`/students/${id}`).then((r) => r.data),
  bulkDelete: (data: BulkDeleteRequest) =>
    apiClient
      .delete<BulkDeleteResponse>("/students/bulk", { data })
      .then((r) => r.data),
  // DEPRECATED in v3.5 — backend retained for migration only; removed from frontend UI
  // linkAccount: (studentId: string, data: LinkStudentAccountRequest) => ...
};
