/**
 * types/api.ts — SuperAdmin app types.
 * All types match OpenAPI v3.3.0 exactly.
 * Tenant.status: 'active'|'inactive' (lowercase per OpenAPI enum)
 */

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

// ─── TENANTS ─────────────────────────────────────────────────────────────────
// status is lowercase per OpenAPI schema enum: [active, inactive]
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: "active" | "inactive";
  deactivatedAt: string | null;
  createdAt: string;
}
export interface ListTenantsResponse {
  tenants: Tenant[];
}
// POST /super-admin/tenants — v3.4 CR-06: admin block required
export interface CreateTenantRequest {
  id: string;
  name: string;
  slug: string;
  admin: {
    name: string;
    email: string;
    password: string;
  };
}
export interface CreateTenantResponse {
  tenant: Tenant;
  admin: {
    id: string;
    name: string;
    email: string;
    roles: string[];
  };
}
// PUT /super-admin/tenants/:id — name and/or slug
export interface UpdateTenantRequest {
  name?: string;
  slug?: string;
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
