import { apiClient } from "./client";
import type {
  TenantLoginRequest,
  TenantLoginResponse,
  SwitchRoleRequest,
  SwitchRoleResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
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

  /** v5.0 M-011: change password; returns fresh JWT (mustChangePassword=false) */
  changePassword: (data: ChangePasswordRequest) =>
    apiClient
      .post<ChangePasswordResponse>("/auth/change-password", data)
      .then((r) => r.data),
};
