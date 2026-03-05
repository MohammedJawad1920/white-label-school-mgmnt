/**
 * Auth Controller — Tenant Auth
 *
 * POST /api/auth/login       — tenant user login (requires tenantSlug)
 * POST /api/auth/logout      — 204, stateless (JWT blacklist out of scope per Freeze)
 * POST /api/auth/switch-role — re-issue JWT with new activeRole
 *
 * CRITICAL: switch-role reads roles from DB, NOT from the JWT.
 * Freeze §7 Phase 3: "POST /api/auth/switch-role reads `roles` from DB, not JWT"
 * WHY: If an Admin updates a user's roles via PUT /users/:id/roles, the change
 * is live on next switch-role call without a full re-login.
 */

import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../../db/pool";
import { config } from "../../config/env";
import { send400, send401, send404 } from "../../utils/errors";
import { UserRow, TenantRow, UserRole, TenantJwtPayload } from "../../types";

function formatUser(
  u: Pick<UserRow, "id" | "tenant_id" | "name" | "email" | "roles">,
  activeRole: UserRole,
) {
  return {
    id: u.id,
    tenantId: u.tenant_id,
    name: u.name,
    email: u.email,
    roles: u.roles,
    activeRole,
  };
}

// POST /api/auth/login
export async function tenantLogin(req: Request, res: Response): Promise<void> {
  const { email, password, tenantSlug } = req.body as {
    email?: string;
    password?: string;
    tenantSlug?: string;
  };

  // CR-19: Use z.string().min(1) — NOT .email() — because student loginIds
  // (e.g. 530@greenvalley.local) are pseudo-emails exempt from RFC 5322.
  if (!email || typeof email !== "string" || email.trim().length === 0) {
    send400(res, "email is required");
    return;
  }
  if (
    !password ||
    typeof password !== "string" ||
    password.trim().length === 0
  ) {
    send400(res, "password is required");
    return;
  }
  if (
    !tenantSlug ||
    typeof tenantSlug !== "string" ||
    tenantSlug.trim().length === 0
  ) {
    send400(res, "tenantSlug is required");
    return;
  }
  if (password.length < 8) {
    send400(res, "password must be at least 8 characters");
    return;
  }

  const tenantResult = await pool.query<Pick<TenantRow, "id" | "status">>(
    "SELECT id, status FROM tenants WHERE slug = $1",
    [tenantSlug.trim()],
  );
  const tenant = tenantResult.rows[0];

  if (!tenant) {
    send404(res, "Tenant does not exist");
    return;
  }
  if (tenant.status !== "active") {
    res.status(403).json({
      error: {
        code: "TENANT_INACTIVE",
        message: "Tenant is inactive",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  const userResult = await pool.query<UserRow>(
    `SELECT id, tenant_id, name, email, password_hash, roles, deleted_at, created_at, updated_at
     FROM users WHERE email = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [email.toLowerCase().trim(), tenant.id],
  );
  const user = userResult.rows[0];

  // Timing-safe: always bcrypt even when user not found
  const hashToCompare =
    user?.password_hash ?? "$2b$10$invalidhashpaddingtopreventimingoracles";
  const valid = await bcrypt.compare(password, hashToCompare);

  if (!user || !valid) {
    send401(res, "Invalid credentials");
    return;
  }

  const activeRole = user.roles[0] as UserRole;
  const payload: TenantJwtPayload = {
    userId: user.id,
    tenantId: tenant.id,
    roles: user.roles,
    activeRole,
  };
  const token = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  } as jwt.SignOptions);

  res.status(200).json({ token, user: formatUser(user, activeRole) });
}

// POST /api/auth/logout — stateless, client discards token
export async function tenantLogout(
  _req: Request,
  res: Response,
): Promise<void> {
  res.status(204).send();
}

// POST /api/auth/switch-role
export async function switchRole(req: Request, res: Response): Promise<void> {
  const { role } = req.body as { role?: string };
  const userId = req.userId!;
  const tenantId = req.tenantId!;

  if (!role) {
    send400(res, "role is required");
    return;
  }
  if (role !== "Teacher" && role !== "Admin") {
    res.status(400).json({
      error: {
        code: "ROLE_NOT_ASSIGNED",
        message: "Requested role is not assigned to this user",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // CRITICAL: Read from DB — not from JWT (see module docstring)
  const userResult = await pool.query<
    Pick<UserRow, "id" | "tenant_id" | "name" | "email" | "roles">
  >(
    "SELECT id, tenant_id, name, email, roles FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [userId, tenantId],
  );
  const user = userResult.rows[0];

  if (!user) {
    send404(res, "User not found");
    return;
  }
  if (user.roles.length < 2) {
    res.status(403).json({
      error: {
        code: "SINGLE_ROLE_USER",
        message: "User has only one role; switching not applicable",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }
  if (!user.roles.includes(role as UserRole)) {
    res.status(400).json({
      error: {
        code: "ROLE_NOT_ASSIGNED",
        message: "Requested role is not assigned to this user",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  const newActiveRole = role as UserRole;
  const payload: TenantJwtPayload = {
    userId: user.id,
    tenantId: user.tenant_id,
    roles: user.roles,
    activeRole: newActiveRole,
  };
  const token = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  } as jwt.SignOptions);

  res.status(200).json({
    token,
    user: formatUser(user, newActiveRole),
  });
}
