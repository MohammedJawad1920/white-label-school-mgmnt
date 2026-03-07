/**
 * SuperAdmin Controller
 *
 * Handles all /api/super-admin/* endpoints.
 * NEVER uses tenantContextMiddleware — these routes have no tenant context.
 *
 * Endpoints implemented:
 *   POST   /api/super-admin/auth/login
 *   GET    /api/super-admin/tenants
 *   POST   /api/super-admin/tenants            (v3.4: seeds 8 periods + first Admin atomically)
 *   PUT    /api/super-admin/tenants/:id
 *   PUT    /api/super-admin/tenants/:id/deactivate
 *   PUT    /api/super-admin/tenants/:id/reactivate   (v3.4: CR-07)
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
  UserRow,
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
    timezone: t.timezone,
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

// ═══════════════════════════════════════════════════════════════════// POST /api/super-admin/auth/logout
// D-04 fix: JWT is stateless (no server-side session); logout is a client-only
// operation (clear localStorage). This endpoint exists to satisfy the OpenAPI
// contract and allow clients to call a canonical logout URL.
// ═══════════════════════════════════════════════════════════════
export async function superAdminLogout(
  _req: Request,
  res: Response,
): Promise<void> {
  res.status(204).send();
}

// ═══════════════════════════════════════════════════════════════// GET /api/super-admin/tenants
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
    `SELECT id, name, slug, status, timezone, deactivated_at, created_at, updated_at
       FROM tenants ${where}
       ORDER BY created_at DESC`,
    params,
  );

  res.status(200).json({ tenants: result.rows.map(formatTenant) });
}

// ═══════════════════════════════════════════════════════════════════
// POST /api/super-admin/tenants
// v3.4 CR-06: Creates tenant + 8 default school_periods + first Admin
// admin block is REQUIRED. All four steps are atomic.
// ═══════════════════════════════════════════════════════════════════

export async function createTenant(req: Request, res: Response): Promise<void> {
  const { id, name, slug, timezone, admin } = req.body as {
    id?: string;
    name?: string;
    slug?: string;
    timezone?: string;
    admin?: { name?: string; email?: string; password?: string };
  };

  // CR-17: validate timezone if provided (basic IANA format check)
  if (
    timezone !== undefined &&
    (typeof timezone !== "string" || timezone.trim().length === 0)
  ) {
    send400(res, "timezone must be a non-empty IANA timezone string");
    return;
  }
  const resolvedTimezone = timezone?.trim() ?? "Asia/Kolkata";

  // ── Validate tenant fields ────────────────────────────────────────
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

  // ── Validate admin block (v3.4 CR-06 — REQUIRED) ─────────────────
  if (!admin || typeof admin !== "object") {
    send400(res, "admin block is required");
    return;
  }
  if (!admin.name || !admin.email || !admin.password) {
    send400(res, "admin.name, admin.email, and admin.password are required");
    return;
  }
  if (admin.password.length < 8) {
    send400(res, "admin.password must be at least 8 characters");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email)) {
    send400(res, "admin.email must be a valid email address");
    return;
  }

  // Hash admin password before entering the transaction
  const adminPasswordHash = await bcrypt.hash(
    admin.password,
    config.BCRYPT_ROUNDS,
  );
  const adminId = `U-${uuidv4()}`;

  // ── Atomic transaction: tenant + 8 periods + 2 feature rows + Admin user ─
  // WHY withTransaction: any failure in any step rolls everything back.
  // A tenant with no period config or no admin would be unusable.
  try {
    const { tenant, adminUser } = await withTransaction(async (client) => {
      // 1. Insert tenant
      const tenantResult = await client.query<TenantRow>(
        `INSERT INTO tenants (id, name, slug, status, timezone, created_at, updated_at)
         VALUES ($1, $2, $3, 'active', $4, NOW(), NOW())
         RETURNING id, name, slug, status, timezone, deactivated_at, created_at, updated_at`,
        [id, name.trim(), slug.trim(), resolvedTimezone],
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

      // 4. Create first Admin user (CR-06)
      // WHY inside transaction: if user creation fails (e.g. duplicate email)
      // the whole tenant + periods + features must roll back.

      // Pre-check: admin email must be globally unique across ALL tenants.
      // The DB unique index only covers (tenant_id, email) so a cross-tenant
      // duplicate would silently succeed — catch it here first.
      const emailCheck = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM users WHERE email = $1 AND deleted_at IS NULL`,
        [admin.email!.toLowerCase().trim()],
      );
      if (parseInt(emailCheck.rows[0]?.count ?? "0", 10) > 0) {
        throw Object.assign(new Error("ADMIN_EMAIL_TAKEN"), {
          isSentinel: true,
        });
      }

      let newAdmin: UserRow;
      try {
        const adminResult = await client.query<UserRow>(
          `INSERT INTO users
             (id, tenant_id, name, email, password_hash, roles, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, '["Admin"]'::jsonb, NOW(), NOW())
           RETURNING id, tenant_id, name, email, password_hash, roles,
                     deleted_at, created_at, updated_at`,
          [
            adminId,
            newTenant.id,
            admin.name!.trim(),
            admin.email!.toLowerCase().trim(),
            adminPasswordHash,
          ],
        );
        newAdmin = adminResult.rows[0]!;
      } catch (userErr: unknown) {
        if (
          userErr instanceof Error &&
          "code" in userErr &&
          (userErr as NodeJS.ErrnoException).code === "23505"
        ) {
          // Rethrow with sentinel message so outer catch can distinguish
          throw Object.assign(new Error("ADMIN_EMAIL_TAKEN"), {
            isSentinel: true,
          });
        }
        throw userErr;
      }

      return { tenant: newTenant, adminUser: newAdmin };
    });

    res.status(201).json({
      tenant: formatTenant(tenant),
      admin: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        roles: adminUser.roles,
      },
    });
  } catch (err: unknown) {
    // Admin email collision (sentinel thrown from inside transaction)
    if (err instanceof Error && err.message === "ADMIN_EMAIL_TAKEN") {
      send409(
        res,
        "Admin email already exists in this platform",
        "ADMIN_EMAIL_TAKEN",
      );
      return;
    }
    // Tenant id / slug collision
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
  const { name, slug, timezone } = req.body as {
    name?: string;
    slug?: string;
    timezone?: string;
  };

  if (!name && !slug && !timezone) {
    send400(res, "At least one of name, slug, or timezone is required");
    return;
  }
  if (slug && !/^[a-z0-9-]+$/.test(slug)) {
    send400(res, "slug must be lowercase alphanumeric/dash characters");
    return;
  }
  if (
    timezone !== undefined &&
    (typeof timezone !== "string" || timezone.trim().length === 0)
  ) {
    send400(res, "timezone must be a non-empty IANA timezone string");
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
  if (timezone) {
    setClauses.push(`timezone = $${idx++}`);
    params.push(timezone.trim());
  }

  params.push(tenantId);

  try {
    const result = await pool.query<TenantRow>(
      `UPDATE tenants SET ${setClauses.join(", ")}
       WHERE id = $${idx}
       RETURNING id, name, slug, status, timezone, deactivated_at, created_at, updated_at`,
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
// PUT /api/super-admin/tenants/:tenantId/reactivate  (v3.4 CR-07)
// ═══════════════════════════════════════════════════════════════════

export async function reactivateTenant(
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

  if (tenant.status === "active") {
    send409(res, "Tenant is already active", "ALREADY_ACTIVE");
    return;
  }

  const result = await pool.query<
    Pick<TenantRow, "id" | "status" | "deactivated_at">
  >(
    `UPDATE tenants
     SET status = 'active', deactivated_at = NULL, updated_at = NOW()
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

  // JOIN features + tenant_features to get name/description alongside enabled status
  const result = await pool.query<
    Pick<FeatureRow, "key" | "name" | "description"> &
      Pick<TenantFeatureRow, "id" | "tenant_id" | "enabled" | "enabled_at">
  >(
    `SELECT f.key, f.name, f.description,
            COALESCE(tf.id, '') AS id, $1::text AS tenant_id,
            COALESCE(tf.enabled, false) AS enabled, tf.enabled_at
     FROM features f
     LEFT JOIN tenant_features tf
       ON tf.tenant_id = $1 AND tf.feature_key = f.key
     ORDER BY f.id ASC`,
    [tenantId],
  );

  res.status(200).json({
    features: result.rows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      featureKey: r.key,
      featureName: r.name,
      featureDescription: r.description ?? "",
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

  // D-07 fix: return full Feature shape per OpenAPI (featureKey, featureName, featureDescription, enabled, enabledAt)
  const featureResult = await pool.query<{
    key: string;
    name: string;
    description: string | null;
    id: string;
    enabled: boolean;
    enabled_at: Date | null;
  }>(
    `SELECT f.key, f.name, f.description, tf.id, tf.enabled, tf.enabled_at
     FROM features f
     JOIN tenant_features tf ON tf.tenant_id = $1 AND tf.feature_key = f.key
     WHERE f.key = $2`,
    [tenantId, featureKey],
  );
  const feat = featureResult.rows[0]!;

  res.status(200).json({
    feature: {
      id: feat.id,
      tenantId,
      featureKey: feat.key,
      featureName: feat.name,
      featureDescription: feat.description ?? "",
      enabled: feat.enabled,
      enabledAt: feat.enabled_at?.toISOString() ?? null,
    },
  });
}
