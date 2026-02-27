import { apiClient } from "./client";
import type {
  TenantLoginRequest,
  TenantLoginResponse,
  SwitchRoleRequest,
  SwitchRoleResponse,
} from "@/types/api";

export const authApi = {
  login: (data: TenantLoginRequest) =>
    apiClient
      .post<TenantLoginResponse>("/auth/login", data)
      .then((r) => r.data),

  logout: () => apiClient.post<void>("/auth/logout").then((r) => r.data),

  switchRole: (data: SwitchRoleRequest) =>
    apiClient
      .post<SwitchRoleResponse>("/auth/switch-role", data)
      .then((r) => r.data),
};
