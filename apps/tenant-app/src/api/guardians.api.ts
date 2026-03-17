import { apiClient } from "./client";
import type {
  Guardian,
  CreateGuardianRequest,
  CreateGuardianResponse,
} from "@/types/api";

export const guardiansApi = {
  create: (data: CreateGuardianRequest) =>
    apiClient
      .post<CreateGuardianResponse>("/guardians", data)
      .then((r) => r.data),

  update: (
    id: string,
    data: Partial<Omit<CreateGuardianRequest, "studentId">>,
  ) => apiClient.put<Guardian>(`/guardians/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient
      .delete<{ message: string }>(`/guardians/${id}`)
      .then((r) => r.data),

  listForStudent: (studentId: string) =>
    apiClient
      .get<{ guardians: Guardian[] }>(`/students/${studentId}/guardians`)
      .then((r) => r.data),
};
