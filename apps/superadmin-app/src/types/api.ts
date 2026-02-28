// ─── ERROR ───────────────────────────────────────────────────────────────────
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
  };
}

// ─── SUPER ADMIN AUTH ─────────────────────────────────────────────────────────
export interface SuperAdmin {
  id: string;
  email: string;
  name: string;
}
export interface SALoginRequest {
  email: string;
  password: string;
}
export interface SALoginResponse {
  token: string;
  superAdmin: SuperAdmin;
}

// ─── TENANTS ──────────────────────────────────────────────────────────────────
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: "Active" | "Inactive";
  createdAt: string;
  schoolPeriodsConfigured: boolean;
}
export interface ListTenantsResponse {
  tenants: Tenant[];
}
export interface CreateTenantRequest {
  name: string;
  slug: string;
  adminEmail: string;
  adminPassword: string;
  adminName: string;
}
export interface CreateTenantResponse {
  tenant: Tenant;
}
export interface UpdateTenantRequest {
  name?: string;
  status?: "Active" | "Inactive";
}
export interface UpdateTenantResponse {
  tenant: Tenant;
}

// ─── FEATURES ────────────────────────────────────────────────────────────────
export type FeatureKey = "timetable" | "attendance";
export interface TenantFeature {
  key: FeatureKey;
  name: string;
  enabled: boolean;
  enabledAt: string | null;
}
export interface ListTenantFeaturesResponse {
  features: TenantFeature[];
}
export interface ToggleFeatureRequest {
  enabled: boolean;
}
export interface ToggleFeatureResponse {
  feature: TenantFeature;
}
