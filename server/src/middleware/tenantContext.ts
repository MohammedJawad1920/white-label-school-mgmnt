/**
 * tenantContextMiddleware
 *
 * WHAT IT DOES:
 * Verifies the Bearer JWT on every tenant route, extracts tenantId/userId/roles,
 * rejects SuperAdmin JWTs, rejects inactive tenants, and — v5.0 — rejects tokens
 * with a stale tokenVersion (issued before the user's last logout/password change).
 *
 * WHY IT EXISTS:
 * Tenant isolation is the #1 security property of this system. Every controller
 * that touches the DB must have req.tenantId available and trust it came from a
 * verified JWT — not a user-supplied query param.
 *
 * Freeze §1.6 rules enforced here:
 * - SuperAdmin JWT (payload.role === 'SuperAdmin') is REJECTED with 403
 * - Inactive tenants (status !== 'active') get 403
 * - Missing/invalid token → 401
 * - Stale tokenVersion (post-logout/password-change) → 401 TOKEN_REVOKED (v5.0)
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { pool } from "../db/pool";
import { sendError } from "../utils/errors";
import {
  TenantJwtPayload,
  SuperAdminJwtPayload,
  TenantRow,
  UserRow,
} from "../types";

export async function tenantContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    sendError(res, {
      code: "UNAUTHORIZED",
      message: "Missing or malformed Authorization header",
      status: 401,
    });
    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  let payload: TenantJwtPayload | SuperAdminJwtPayload;

  try {
    payload = jwt.verify(token, config.JWT_SECRET) as
      | TenantJwtPayload
      | SuperAdminJwtPayload;
  } catch {
    sendError(res, {
      code: "TOKEN_INVALID",
      message: "JWT is invalid or expired",
      status: 401,
    });
    return;
  }

  // ── RULE: Reject SuperAdmin JWTs on tenant routes ────────────────────────
  if ("role" in payload && payload.role === "SuperAdmin") {
    sendError(res, {
      code: "FORBIDDEN",
      message: "SuperAdmin JWT cannot be used on tenant routes",
      status: 403,
    });
    return;
  }

  const tenantPayload = payload as TenantJwtPayload;

  // ── RULE: Verify tenant is still active ─────────────────────────────────
  const tenantResult = await pool.query<Pick<TenantRow, "id" | "status">>(
    "SELECT id, status FROM tenants WHERE id = $1",
    [tenantPayload.tenantId],
  );
  const tenant = tenantResult.rows[0];

  if (!tenant) {
    sendError(res, {
      code: "TENANT_NOT_FOUND",
      message: "Tenant does not exist",
      status: 403,
    });
    return;
  }

  if (tenant.status !== "active") {
    sendError(res, {
      code: "TENANT_INACTIVE",
      message: "This school account has been deactivated",
      status: 403,
    });
    return;
  }

  // ── RULE: Verify token version (v5.0 — logout / password-change revocation) ─
  // On logout or password change, the DB token_version is incremented.
  // A JWT carrying an older tokenVersion is rejected immediately.
  const userResult = await pool.query<Pick<UserRow, "token_version">>(
    "SELECT token_version FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [tenantPayload.userId, tenantPayload.tenantId],
  );
  const dbUser = userResult.rows[0];

  if (!dbUser) {
    sendError(res, {
      code: "UNAUTHORIZED",
      message: "User not found or deleted",
      status: 401,
    });
    return;
  }

  // tokenVersion missing on pre-v5.0 tokens → treat as 0 (backward-compat for
  // existing tokens issued before this migration; they will pass until rotated).
  const jwtTokenVersion = tenantPayload.tokenVersion ?? 0;
  if (jwtTokenVersion < dbUser.token_version) {
    sendError(res, {
      code: "TOKEN_REVOKED",
      message: "This token has been revoked. Please log in again.",
      status: 401,
    });
    return;
  }

  // ── Attach context to request for downstream handlers ───────────────────
  req.tenantId = tenantPayload.tenantId;
  req.userId = tenantPayload.userId;
  req.userRoles = tenantPayload.roles;
  req.activeRole = tenantPayload.activeRole;
  req.studentId = tenantPayload.studentId ?? null;
  req.tokenVersion = jwtTokenVersion;
  req.mustChangePassword = tenantPayload.mustChangePassword ?? false;
  req.classTeacherOf = tenantPayload.classTeacherOf ?? null;

  next();
}
