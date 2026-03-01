import { saApiClient } from "./client";
import type {
  ListTenantsResponse,
  CreateTenantRequest,
  CreateTenantResponse,
  UpdateTenantRequest,
  UpdateTenantResponse,
  ListTenantFeaturesResponse,
  ToggleFeatureRequest,
  ToggleFeatureResponse,
} from "@/types/api";

export interface ListTenantsParams {
  status?: "active" | "inactive";
  search?: string;
}

export const tenantsApi = {
  list: (params: ListTenantsParams = {}) =>
    saApiClient
      .get<ListTenantsResponse>("/super-admin/tenants", { params })
      .then((r) => r.data),

  create: (data: CreateTenantRequest) =>
    saApiClient
      .post<CreateTenantResponse>("/super-admin/tenants", data)
      .then((r) => r.data),

  update: (tenantId: string, data: UpdateTenantRequest) =>
    saApiClient
      .put<UpdateTenantResponse>(`/super-admin/tenants/${tenantId}`, data)
      .then((r) => r.data),

  deactivate: (tenantId: string) =>
    saApiClient
      .put<UpdateTenantResponse>(`/super-admin/tenants/${tenantId}/deactivate`)
      .then((r) => r.data),

  listFeatures: (tenantId: string) =>
    saApiClient
      .get<ListTenantFeaturesResponse>(
        `/super-admin/tenants/${tenantId}/features`,
      )
      .then((r) => r.data),

  toggleFeature: (
    tenantId: string,
    featureKey: string,
    data: ToggleFeatureRequest,
  ) =>
    saApiClient
      .put<ToggleFeatureResponse>(
        `/super-admin/tenants/${tenantId}/features/${featureKey}`,
        data,
      )
      .then((r) => r.data),
};
