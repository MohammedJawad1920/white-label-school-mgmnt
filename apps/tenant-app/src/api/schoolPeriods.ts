import { apiClient } from "./client";
import type {
  ListSchoolPeriodsResponse,
  CreateSchoolPeriodRequest,
  CreateSchoolPeriodResponse,
  UpdateSchoolPeriodRequest,
  UpdateSchoolPeriodResponse,
} from "@/types/api";

export const schoolPeriodsApi = {
  list: () =>
    apiClient
      .get<ListSchoolPeriodsResponse>("/school-periods")
      .then((r) => r.data),
  create: (data: CreateSchoolPeriodRequest) =>
    apiClient
      .post<CreateSchoolPeriodResponse>("/school-periods", data)
      .then((r) => r.data),
  update: (id: string, data: UpdateSchoolPeriodRequest) =>
    apiClient
      .put<UpdateSchoolPeriodResponse>(`/school-periods/${id}`, data)
      .then((r) => r.data),
  delete: (id: string) =>
    apiClient.delete<void>(`/school-periods/${id}`).then((r) => r.data),
};
