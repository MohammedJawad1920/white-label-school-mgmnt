/**
 * tenantContextMiddleware
 *
 * WHAT IT DOES (3-line explanation):
 * Verifies the Bearer JWT on every tenant route, extracts tenantId/userId/roles,
 * rejects SuperAdmin JWTs (they have no tenantId), and rejects logins to inactive
 * tenants — then attaches the extracted context to req for downstream handlers.
 *
 * WHY IT EXISTS:
 * Tenant isolation is the #1 security property of this system. Every controller
 * that touches the DB must have req.tenantId available and trust it came from a
 * verified JWT — not a user-supplied query param. Without this middleware every
 * route would need to re-implement JWT parsing, and one missed check = data leak.
 *
 * Freeze §1.6 rules enforced here:
 * - SuperAdmin JWT (payload.role === 'SuperAdmin') is REJECTED with 403
 * - Inactive tenants (status !== 'active') get 403
 * - Missing/invalid token → 401
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { pool } from "../db/pool";
import { TenantJwtPayload, SuperAdminJwtPayload, TenantRow } from "../types";

export async function tenantContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or malformed Authorization header",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  let payload: TenantJwtPayload | SuperAdminJwtPayload;

  try {
    payload = jwt.verify(token, config.JWT_SECRET) as
      | TenantJwtPayload
      | SuperAdminJwtPayload;
  } catch (err) {
    res.status(401).json({
      error: {
        code: "TOKEN_INVALID",
        message: "JWT is invalid or expired",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // ── RULE: Reject SuperAdmin JWTs on tenant routes ────────────────────────
  // SuperAdmin tokens carry role: 'SuperAdmin' and no tenantId.
  // Allowing them here would bypass all tenant isolation.
  if ("role" in payload && payload.role === "SuperAdmin") {
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "SuperAdmin JWT cannot be used on tenant routes",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  const tenantPayload = payload as TenantJwtPayload;

  // ── RULE: Verify tenant is still active ─────────────────────────────────
  // A tenant could have been deactivated after the JWT was issued.
  // We check the DB on every request (low cost — single indexed lookup).
  const tenantResult = await pool.query<Pick<TenantRow, "id" | "status">>(
    "SELECT id, status FROM tenants WHERE id = $1",
    [tenantPayload.tenantId],
  );

  const tenant = tenantResult.rows[0];

  if (!tenant) {
    res.status(403).json({
      error: {
        code: "TENANT_NOT_FOUND",
        message: "Tenant does not exist",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  if (tenant.status !== "active") {
    res.status(403).json({
      error: {
        code: "TENANT_INACTIVE",
        message: "This school account has been deactivated",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // ── Attach context to request for downstream handlers ───────────────────
  req.tenantId = tenantPayload.tenantId;
  req.userId = tenantPayload.userId;
  req.userRoles = tenantPayload.roles;
  req.activeRole = tenantPayload.activeRole;
  // CR-38: studentId in JWT payload (field absent on old tokens → null for backward-compat)
  req.studentId = tenantPayload.studentId ?? null;

  next();
}
