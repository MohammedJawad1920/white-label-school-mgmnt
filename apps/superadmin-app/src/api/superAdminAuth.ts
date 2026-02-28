import { saApiClient } from "./client";
import type { SALoginRequest, SALoginResponse } from "@/types/api";

export const superAdminAuthApi = {
  login: (data: SALoginRequest) =>
    saApiClient
      .post<SALoginResponse>("/super-admin/auth/login", data)
      .then((r) => r.data),

  logout: () =>
    saApiClient.post<void>("/super-admin/auth/logout").then((r) => r.data),
};
