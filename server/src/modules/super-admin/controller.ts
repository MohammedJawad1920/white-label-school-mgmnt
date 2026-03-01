/**
 * SuperAdmin Controller
 *
 * Handles all /api/super-admin/* endpoints.
 * NEVER uses tenantContextMiddleware — these routes have no tenant context.
 *
 * Endpoints implemented:
 *   POST   /api/super-admin/auth/login
 *   GET    /api/super-admin/tenants
 *   POST   /api/super-admin/tenants            (v3.3: seeds 8 periods atomically)
 *   PUT    /api/super-admin/tenants/:id
 *   PUT    /api/super-admin/tenants/:id/deactivate
 *   GET    /api/super-admin/tenants/:id/features
 *   PUT    /api/super-admin/tenants/:id/features/:featureKey
 */

import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { pool, withTransaction } from "../../db/pool";
import { config } from "../../config/env";
import { send400, send401, send404, send409 } from "../../utils/errors";
import {
  SuperAdminRow,
  TenantRow,
  TenantFeatureRow,
  FeatureRow,
  FeatureKey,
  SuperAdminJwtPayload,
} from "../../types";

// ─── Default school periods seeded per tenant on creation (v3.3) ─────────────
const DEFAULT_PERIODS = [
  { number: 1, label: "Period 1", start: "08:00", end: "08:45" },
  { number: 2, label: "Period 2", start: "08:50", end: "09:35" },
  { number: 3, label: "Period 3", start: "09:40", end: "10:25" },
  { number: 4, label: "Period 4", start: "10:30", end: "11:15" },
  { number: 5, label: "Period 5", start: "11:20", end: "12:05" },
  { number: 6, label: "Period 6", start: "13:00", end: "13:45" },
  { number: 7, label: "Period 7", start: "13:50", end: "14:35" },
  { number: 8, label: "Period 8", start: "14:40", end: "15:25" },
] as const;

// ─── Helper: format TenantRow → API shape ────────────────────────────────────
function formatTenant(t: TenantRow) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    deactivatedAt: t.deactivated_at?.toISOString() ?? null,
    createdAt: t.created_at.toISOString(),
    updatedAt: t.updated_at.toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════
// POST /api/super-admin/auth/login
// ═══════════════════════════════════════════════════════════════════

export async function superAdminLogin(
  req: Request,
  res: Response,
): Promise<void> {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    send400(res, "email and password are required");
    return;
  }

  if (password.length < 8) {
    send400(res, "password must be at least 8 characters");
    return;
  }

  const result = await pool.query<SuperAdminRow>(
    "SELECT id, name, email, password_hash FROM superadmins WHERE email = $1",
    [email.toLowerCase().trim()],
  );

  const sa = result.rows[0];

  // Use constant-time compare even on "not found" to prevent timing attacks
  const hashToCompare =
    sa?.password_hash ?? "$2b$10$invalidhashpaddingtopreventimingoracles";
  const valid = await bcrypt.compare(password, hashToCompare);

  if (!sa || !valid) {
    send401(res, "Invalid credentials");
    return;
  }

  const payload: SuperAdminJwtPayload = {
    superAdminId: sa.id,
    role: "SuperAdmin",
  };

  const token = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  } as jwt.SignOptions);

  res.status(200).json({
    token,
    superAdmin: {
      id: sa.id,
      name: sa.name,
      email: sa.email,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════
// GET /api/super-admin/tenants
// ═══════════════════════════════════════════════════════════════════

export async function listTenants(req: Request, res: Response): Promise<void> {
  const { status, search } = req.query as { status?: string; search?: string };

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (status) {
    if (status !== "active" && status !== "inactive") {
      send400(res, 'status must be "active" or "inactive"');
      return;
    }
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }

  if (search) {
    conditions.push(`(name ILIKE $${idx} OR slug ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query<TenantRow>(
    `SELECT id, name, slug, status, deactivated_at, created_at, updated_at
       FROM tenants ${where}
       ORDER BY created_at DESC`,
    params,
  );

  res.status(200).json({ tenants: result.rows.map(formatTenant) });
}

// ═══════════════════════════════════════════════════════════════════
// POST /api/super-admin/tenants
// v3.3: Creates tenant + 8 default school_periods atomically
// ═══════════════════════════════════════════════════════════════════

export async function createTenant(req: Request, res: Response): Promise<void> {
  const { id, name, slug } = req.body as {
    id?: string;
    name?: string;
    slug?: string;
  };

  // ── Validation ────────────────────────────────────────────────────
  if (!id || !name || !slug) {
    send400(res, "id, name, and slug are required");
    return;
  }
  if (id.length > 50 || !/^[a-zA-Z0-9-]+$/.test(id)) {
    send400(res, "id must be 1–50 alphanumeric/dash characters");
    return;
  }
  if (name.length > 255) {
    send400(res, "name must not exceed 255 characters");
    return;
  }
  if (slug.length > 100 || !/^[a-z0-9-]+$/.test(slug)) {
    send400(res, "slug must be 1–100 lowercase alphanumeric/dash characters");
    return;
  }

  // ── Atomic transaction: tenant + 8 periods + 2 feature rows ──────
  // WHY withTransaction: If the school_periods inserts fail after the
  // tenant is created, we'd have a tenant with no period config —
  // breaking every timetable operation. Either everything commits or
  // everything rolls back.
  try {
    const tenant = await withTransaction(async (client) => {
      // 1. Insert tenant
      const tenantResult = await client.query<TenantRow>(
        `INSERT INTO tenants (id, name, slug, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'active', NOW(), NOW())
         RETURNING id, name, slug, status, deactivated_at, created_at, updated_at`,
        [id, name.trim(), slug.trim()],
      );

      const newTenant = tenantResult.rows[0];
      if (!newTenant) throw new Error("Tenant insert returned no rows");

      // 2. Seed 8 default school_periods
      for (const p of DEFAULT_PERIODS) {
        await client.query(
          `INSERT INTO school_periods
             (id, tenant_id, period_number, label, start_time, end_time, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [`SP-${uuidv4()}`, newTenant.id, p.number, p.label, p.start, p.end],
        );
      }

      // 3. Seed tenant_features rows (both disabled by default)
      const featureKeys: FeatureKey[] = ["timetable", "attendance"];
      for (const key of featureKeys) {
        await client.query(
          `INSERT INTO tenant_features (id, tenant_id, feature_key, enabled, enabled_at)
           VALUES ($1, $2, $3, false, NULL)`,
          [`TF-${uuidv4()}`, newTenant.id, key],
        );
      }

      return newTenant;
    });

    res.status(201).json({ tenant: formatTenant(tenant) });
  } catch (err: unknown) {
    // PostgreSQL unique violation code = 23505
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "23505"
    ) {
      send409(res, "Tenant id or slug already exists", "DUPLICATE_TENANT");
      return;
    }
    throw err; // re-throw to globalErrorHandler
  }
}

// ═══════════════════════════════════════════════════════════════════
// PUT /api/super-admin/tenants/:tenantId
// ═══════════════════════════════════════════════════════════════════

export async function updateTenant(req: Request, res: Response): Promise<void> {
  const { tenantId } = req.params as { tenantId: string };
  const { name, slug } = req.body as { name?: string; slug?: string };

  if (!name && !slug) {
    send400(res, "At least one of name or slug is required");
    return;
  }
  if (slug && !/^[a-z0-9-]+$/.test(slug)) {
    send400(res, "slug must be lowercase alphanumeric/dash characters");
    return;
  }

  // Check tenant exists
  const existing = await pool.query<Pick<TenantRow, "id">>(
    "SELECT id FROM tenants WHERE id = $1",
    [tenantId],
  );
  if ((existing.rowCount ?? 0) === 0) {
    send404(res, "Tenant does not exist");
    return;
  }

  const setClauses: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [];
  let idx = 1;

  if (name) {
    setClauses.push(`name = $${idx++}`);
    params.push(name.trim());
  }
  if (slug) {
    setClauses.push(`slug = $${idx++}`);
    params.push(slug.trim());
  }

  params.push(tenantId);

  try {
    const result = await pool.query<TenantRow>(
      `UPDATE tenants SET ${setClauses.join(", ")}
       WHERE id = $${idx}
       RETURNING id, name, slug, status, deactivated_at, created_at, updated_at`,
      params,
    );

    const updated = result.rows[0];
    if (!updated) {
      send404(res, "Tenant does not exist");
      return;
    }

    res.status(200).json({ tenant: formatTenant(updated) });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "23505"
    ) {
      send409(res, "Slug is already taken by another tenant", "SLUG_TAKEN");
      return;
    }
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PUT /api/super-admin/tenants/:tenantId/deactivate
// ═══════════════════════════════════════════════════════════════════

export async function deactivateTenant(
  req: Request,
  res: Response,
): Promise<void> {
  const { tenantId } = req.params as { tenantId: string };

  const existing = await pool.query<Pick<TenantRow, "id" | "status">>(
    "SELECT id, status FROM tenants WHERE id = $1",
    [tenantId],
  );

  const tenant = existing.rows[0];

  if (!tenant) {
    send404(res, "Tenant does not exist");
    return;
  }

  if (tenant.status === "inactive") {
    send409(res, "Tenant is already inactive", "ALREADY_INACTIVE");
    return;
  }

  const result = await pool.query<
    Pick<TenantRow, "id" | "status" | "deactivated_at">
  >(
    `UPDATE tenants
     SET status = 'inactive', deactivated_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING id, status, deactivated_at`,
    [tenantId],
  );

  const updated = result.rows[0];
  if (!updated) {
    send404(res, "Tenant does not exist");
    return;
  }

  res.status(200).json({
    tenant: {
      id: updated.id,
      status: updated.status,
      deactivatedAt: updated.deactivated_at?.toISOString() ?? null,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════
// GET /api/super-admin/tenants/:tenantId/features
// ═══════════════════════════════════════════════════════════════════

export async function getTenantFeatures(
  req: Request,
  res: Response,
): Promise<void> {
  const { tenantId } = req.params as { tenantId: string };

  // Verify tenant exists
  const tenantCheck = await pool.query<Pick<TenantRow, "id">>(
    "SELECT id FROM tenants WHERE id = $1",
    [tenantId],
  );
  if ((tenantCheck.rowCount ?? 0) === 0) {
    send404(res, "Tenant does not exist");
    return;
  }

  // JOIN features + tenant_features to get name alongside enabled status
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
// PUT /api/super-admin/tenants/:tenantId/features/:featureKey
// ═══════════════════════════════════════════════════════════════════

export async function toggleTenantFeature(
  req: Request,
  res: Response,
): Promise<void> {
  const { tenantId, featureKey } = req.params as {
    tenantId: string;
    featureKey: string;
  };
  const { enabled } = req.body as { enabled?: boolean };

  // ── Validation ────────────────────────────────────────────────────
  if (enabled === undefined || typeof enabled !== "boolean") {
    send400(res, "enabled (boolean) is required");
    return;
  }

  const validKeys: FeatureKey[] = ["timetable", "attendance"];
  if (!validKeys.includes(featureKey as FeatureKey)) {
    send404(res, `Feature key "${featureKey}" does not exist`);
    return;
  }

  // Verify tenant exists
  const tenantCheck = await pool.query<Pick<TenantRow, "id">>(
    "SELECT id FROM tenants WHERE id = $1",
    [tenantId],
  );
  if ((tenantCheck.rowCount ?? 0) === 0) {
    send404(res, "Tenant does not exist");
    return;
  }

  // ── Feature Dependency Rule (Freeze §4 — CRITICAL) ────────────────
  // Attendance REQUIRES timetable to be enabled first.
  // WHY enforced here and not just in featureGuard: featureGuard only
  // checks "is this feature on", not dependency ordering. This is a
  // write-time invariant that must be enforced on every enable action.
  if (featureKey === "attendance" && enabled === true) {
    const timetableCheck = await pool.query<{ enabled: boolean }>(
      `SELECT enabled FROM tenant_features
       WHERE tenant_id = $1 AND feature_key = 'timetable'`,
      [tenantId],
    );

    const timetableEnabled = timetableCheck.rows[0]?.enabled ?? false;

    if (!timetableEnabled) {
      res.status(400).json({
        error: {
          code: "FEATURE_DEPENDENCY",
          message: "Attendance requires Timetable to be enabled first",
          details: { required: "timetable", requested: "attendance" },
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }
  }

  // ── UPSERT tenant_features ─────────────────────────────────────────
  // WHY UPSERT: tenant_features rows are created at tenant-creation time,
  // so INSERT is rarely needed. But UPSERT is safer than assuming the row exists.
  const id = `TF-${uuidv4()}`;
  const enabledAt = enabled ? "NOW()" : "NULL";

  await pool.query(
    `INSERT INTO tenant_features (id, tenant_id, feature_key, enabled, enabled_at)
     VALUES ($1, $2, $3, $4, ${enabledAt})
     ON CONFLICT (tenant_id, feature_key)
     DO UPDATE SET enabled = $4, enabled_at = ${enabledAt}`,
    [id, tenantId, featureKey, enabled],
  );

  res.status(200).json({
    feature: {
      key: featureKey,
      enabled,
    },
  });
}
