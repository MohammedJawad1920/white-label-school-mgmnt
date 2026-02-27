import { apiClient } from "./client";
import type {
  ListUsersResponse,
  CreateUserRequest,
  CreateUserResponse,
  UpdateUserRolesRequest,
  UpdateUserRolesResponse,
  BulkDeleteRequest,
  BulkDeleteResponse,
} from "@/types/api";

export const usersApi = {
  list: (params?: { role?: string; search?: string }) =>
    apiClient.get<ListUsersResponse>("/users", { params }).then((r) => r.data),
  create: (data: CreateUserRequest) =>
    apiClient.post<CreateUserResponse>("/users", data).then((r) => r.data),
  updateRoles: (id: string, data: UpdateUserRolesRequest) =>
    apiClient
      .put<UpdateUserRolesResponse>(`/users/${id}/roles`, data)
      .then((r) => r.data),
  delete: (id: string) =>
    apiClient.delete<void>(`/users/${id}`).then((r) => r.data),
  bulkDelete: (data: BulkDeleteRequest) =>
    apiClient
      .delete<BulkDeleteResponse>("/users/bulk", { data })
      .then((r) => r.data),
};
