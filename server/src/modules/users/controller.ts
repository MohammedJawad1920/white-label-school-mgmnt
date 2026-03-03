/**
 * Users Controller
 *
 * GET    /api/users           — list (Admin + Teacher)
 * POST   /api/users           — create (Admin only)
 * PUT    /api/users/:id/roles — update roles (Admin only, CANNOT target self)
 * DELETE /api/users/:id       — soft delete (Admin only)
 * DELETE /api/users/bulk      — bulk soft delete (Admin only, max 100)
 *
 * Self-target guard on PUT /roles:
 * An Admin cannot update their own roles. This prevents accidental
 * self-demotion that would lock them out of admin operations.
 * Freeze §3: "PUT /api/users/{id}/roles caller cannot target their own id"
 *
 * Soft delete pattern:
 * All reads include WHERE deleted_at IS NULL.
 * Deletes SET deleted_at = NOW() — never hard delete.
 * The partial unique index idx_users_email_active allows email reuse
 * after soft-delete (same tenant, different user record).
 */

import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { pool, withTransaction } from "../../db/pool";
import { config } from "../../config/env";
import { send400, send403, send404, send409 } from "../../utils/errors";
import { bulkSoftDelete } from "../../utils/bulkDelete";
import { UserRow, UserRole, BulkDeleteRequest } from "../../types";

function formatUser(u: UserRow) {
  return {
    id: u.id,
    tenantId: u.tenant_id,
    name: u.name,
    email: u.email,
    roles: u.roles,
    createdAt: u.created_at.toISOString(),
    updatedAt: u.updated_at.toISOString(),
  };
}

// GET /api/users
export async function listUsers(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { role, search } = req.query as { role?: string; search?: string };

  const conditions = ["tenant_id = $1", "deleted_at IS NULL"];
  const params: unknown[] = [tenantId];
  let idx = 2;

  if (role && (role === "Teacher" || role === "Admin" || role === "Student")) {
    conditions.push(`roles @> $${idx++}::jsonb`);
    params.push(JSON.stringify([role]));
  }
  if (search) {
    conditions.push(`(name ILIKE $${idx} OR email ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const result = await pool.query<UserRow>(
    `SELECT id, tenant_id, name, email, password_hash, roles, deleted_at, created_at, updated_at
     FROM users WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
    params,
  );

  res.status(200).json({ users: result.rows.map(formatUser) });
}

// POST /api/users
export async function createUser(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { name, email, password, roles } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    roles?: unknown;
  };

  if (!name || !email || !password) {
    send400(res, "name, email, and password are required");
    return;
  }
  if (password.length < 8) {
    send400(res, "password must be at least 8 characters");
    return;
  }
  if (!Array.isArray(roles) || roles.length === 0) {
    send400(res, "roles must be a non-empty array");
    return;
  }

  const validRoles: UserRole[] = ["Teacher", "Admin", "Student"]; // v3.4
  const sanitizedRoles: UserRole[] = [
    ...new Set(
      (roles as string[]).filter((r) => validRoles.includes(r as UserRole)),
    ),
  ] as UserRole[];

  if (sanitizedRoles.length === 0) {
    send400(
      res,
      "roles must contain at least one valid role: Teacher, Admin, Student",
    );
    return;
  }

  const id = `U-${uuidv4()}`;
  const passwordHash = await bcrypt.hash(password, config.BCRYPT_ROUNDS);

  try {
    const result = await pool.query<UserRow>(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())
       RETURNING id, tenant_id, name, email, password_hash, roles, deleted_at, created_at, updated_at`,
      [
        id,
        tenantId,
        name.trim(),
        email.toLowerCase().trim(),
        passwordHash,
        JSON.stringify(sanitizedRoles),
      ],
    );
    res.status(201).json({ user: formatUser(result.rows[0]!) });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "23505"
    ) {
      send409(res, "Email already exists for this school", "DUPLICATE_EMAIL");
      return;
    }
    throw err;
  }
}

// PUT /api/users/:id/roles
// v3.4 CR-10: SELF_TARGET guard removed — Admin may target themselves.
// LASTADMIN guard added: cannot remove own Admin role if last admin in tenant.
export async function updateUserRoles(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const callerId = req.userId!;
  const { id } = req.params as { id: string };
  const { roles } = req.body as { roles?: unknown };

  if (!Array.isArray(roles) || roles.length === 0) {
    send400(res, "roles must be a non-empty array");
    return;
  }

  const validRoles: UserRole[] = ["Teacher", "Admin", "Student"]; // v3.4 CR-10
  const sanitizedRoles: UserRole[] = [
    ...new Set(
      (roles as string[]).filter((r) => validRoles.includes(r as UserRole)),
    ),
  ] as UserRole[];

  if (sanitizedRoles.length === 0) {
    send400(
      res,
      "roles must contain at least one valid role: Teacher, Admin, Student",
    );
    return;
  }

  // ── LASTADMIN guard (v3.4 CR-10) ──────────────────────────────────
  // Block if the caller targets themselves AND removes their own Admin role
  // while being the only active Admin left in this tenant.
  if (id === callerId && !sanitizedRoles.includes("Admin")) {
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM users
       WHERE tenant_id = $1 AND roles @> '["Admin"]'::jsonb AND deleted_at IS NULL`,
      [tenantId],
    );
    const adminCount = parseInt(countResult.rows[0]?.count ?? "0", 10);
    if (adminCount <= 1) {
      send409(
        res,
        "Cannot remove Admin role: you are the last admin of this tenant",
        "LASTADMIN",
      );
      return;
    }
  }

  const result = await pool.query<UserRow>(
    `UPDATE users SET roles = $1::jsonb, updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
     RETURNING id, tenant_id, name, email, password_hash, roles, deleted_at, created_at, updated_at`,
    [JSON.stringify(sanitizedRoles), id, tenantId],
  );

  if ((result.rowCount ?? 0) === 0) {
    send404(res, "User not found");
    return;
  }

  res.status(200).json({ user: formatUser(result.rows[0]!) });
}

// DELETE /api/users/:id
// v3.4 CR-08: uses withTransaction to null students.user_id atomically
export async function deleteUser(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };

  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  if ((existing.rowCount ?? 0) === 0) {
    send404(res, "User not found");
    return;
  }

  // Check for active timeslot assignments or attendance records
  const tsCheck = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM timeslots
     WHERE teacher_id = $1 AND tenant_id = $2 AND effective_to IS NULL AND deleted_at IS NULL`,
    [id, tenantId],
  );
  if (parseInt(tsCheck.rows[0]?.count ?? "0", 10) > 0) {
    send409(
      res,
      "Cannot delete: user has active timeslot assignments",
      "HAS_REFERENCES",
    );
    return;
  }

  // WHY withTransaction: Freeze v3.4 invariant — when a user is soft-deleted,
  // students.user_id referencing that user must be set to NULL atomically.
  await withTransaction(async (client) => {
    await client.query(
      "UPDATE students SET user_id = NULL, updated_at = NOW() WHERE user_id = $1 AND tenant_id = $2",
      [id, tenantId],
    );
    await client.query(
      "UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
      [id, tenantId],
    );
  });

  res.status(204).send();
}

// DELETE /api/users/bulk
export async function bulkDeleteUsers(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { ids } = req.body as BulkDeleteRequest;

  if (!Array.isArray(ids) || ids.length === 0) {
    send400(res, "ids must be a non-empty array");
    return;
  }
  if (ids.length > 100) {
    send400(res, "Cannot bulk delete more than 100 records at once");
    return;
  }

  const result = await bulkSoftDelete(
    pool,
    "users",
    ids,
    tenantId,
    async (id, tid, p) => {
      const check = await p.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM timeslots
       WHERE teacher_id = $1 AND tenant_id = $2 AND effective_to IS NULL AND deleted_at IS NULL`,
        [id, tid],
      );
      if (parseInt(check.rows[0]?.count ?? "0", 10) > 0) {
        return "Cannot delete: user has active timeslot assignments or attendance records";
      }
      // v3.4 CR-08: null out students.user_id before soft-deleting
      await p.query(
        "UPDATE students SET user_id = NULL, updated_at = NOW() WHERE user_id = $1 AND tenant_id = $2",
        [id, tid],
      );
      return null;
    },
  );

  res.status(200).json(result);
}
