/**
 * Features Controller (Tenant-level, read-only for Admin)
 *
 * Freeze §3.5 "Feature Management Endpoints":
 *   GET  /api/features              — List feature flags for current tenant (Admin read-only)
 *   PUT  /api/features/:featureKey  — REMOVED in v3.2, returns 403 for ALL callers
 *
 * WHY this module exists:
 * GET /api/features lets Admin see which modules are enabled for their school.
 * PUT was removed in v3.2 — feature toggling moved to SuperAdmin scope.
 * The PUT endpoint is kept to return a clear 403 instead of a confusing 404.
 */

import { Request, Response } from "express";
import { pool } from "../../db/pool";
import { FeatureRow, TenantFeatureRow } from "../../types";
import { send403 } from "../../utils/errors";

// ═══════════════════════════════════════════════════════════════════
// GET /api/features
// ═══════════════════════════════════════════════════════════════════

export async function listFeatures(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;

  const result = await pool.query<
    Pick<FeatureRow, "key" | "name"> &
      Pick<TenantFeatureRow, "enabled" | "enabled_at">
  >(
    `SELECT f.key, f.name, COALESCE(tf.enabled, false) AS enabled, tf.enabled_at
     FROM features f
     LEFT JOIN tenant_features tf
       ON tf.tenant_id = $1 AND tf.feature_key = f.key
     ORDER BY f.id ASC`,
    [tenantId],
  );

  res.status(200).json({
    features: result.rows.map((r) => ({
      key: r.key,
      name: r.name,
      enabled: r.enabled,
      enabledAt: r.enabled_at?.toISOString() ?? null,
    })),
  });
}

// ═══════════════════════════════════════════════════════════════════
// PUT /api/features/:featureKey — REMOVED in v3.2
// Returns 403 for ALL callers per Freeze §3.5
// ═══════════════════════════════════════════════════════════════════

export async function toggleFeatureDeprecated(
  _req: Request,
  res: Response,
): Promise<void> {
  send403(
    res,
    "Feature management is restricted to platform administrators",
    "FORBIDDEN",
  );
}
