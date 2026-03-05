/**
 * Centralized TanStack Query key factory — superadmin-app (GAP-04)
 *
 * Usage:
 *   useQuery({ queryKey: SA_QUERY_KEYS.tenants(), ... })
 *   qc.invalidateQueries({ queryKey: SA_QUERY_KEYS.tenants() })
 */

export const SA_QUERY_KEYS = {
  // ── Tenants ───────────────────────────────────────────────────────────────
  tenants: () => ["sa-tenants"] as const,
  tenant: (id: string) => ["sa-tenants", id] as const,

  // ── Features ──────────────────────────────────────────────────────────────
  features: () => ["sa-features"] as const,
  tenantFeatures: (tenantId: string) => ["sa-features", tenantId] as const,
} as const;
