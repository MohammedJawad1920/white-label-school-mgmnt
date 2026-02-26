/**
 * superAdminAuthMiddleware
 *
 * WHAT IT DOES:
 * Verifies the Bearer JWT on /api/super-admin/* routes and ensures it is a
 * SuperAdmin JWT (payload.role === 'SuperAdmin'). Tenant user JWTs are rejected
 * with 403. Attaches superAdminId to req.
 *
 * WHY A SEPARATE MIDDLEWARE:
 * SuperAdmin routes must NEVER run through tenantContextMiddleware (no tenantId
 * concept). Keeping the two completely separate prevents any accidental coupling
 * — a bug in one cannot affect the other's security guarantees.
 *
 * Freeze §1.6 explicit rule: "Do NOT apply tenantContextMiddleware to /api/super-admin/* routes"
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import { TenantJwtPayload, SuperAdminJwtPayload } from "../types";

export function superAdminAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or malformed Authorization header",
        details: {},
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const token = authHeader.slice(7);

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
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // ── RULE: Reject tenant JWTs on SuperAdmin routes ────────────────────────
  // Tenant JWTs carry tenantId + roles array; they do NOT have role: 'SuperAdmin'.
  if (!("role" in payload) || payload.role !== "SuperAdmin") {
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "This endpoint requires SuperAdmin credentials",
        details: {},
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  req.superAdminId = payload.superAdminId;
  next();
}
