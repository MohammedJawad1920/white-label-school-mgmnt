/**
 * requireRole middleware factory
 *
 * WHAT IT DOES:
 * Returns an Express middleware that checks req.userRoles (set by tenantContextMiddleware)
 * against a required set of roles. If the user holds ANY of the required roles, they pass.
 *
 * WHY "any of" not "all of":
 * Freeze §1: "Authorization checks if user has required role using array membership."
 * A user with roles ["Teacher","Admin"] must pass a requireRole("Admin") check.
 * activeRole is a UI context hint only — it does NOT restrict API access per Freeze §1.
 *
 * Usage:
 *   router.delete('/:id', requireRole('Admin'), deleteHandler);
 *   router.get('/',       requireRole('Teacher', 'Admin'), listHandler);
 */

import { Request, Response, NextFunction } from "express";
import { UserRole } from "../types";

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRoles = req.userRoles ?? [];
    const hasRole = roles.some((r) => userRoles.includes(r));

    if (!hasRole) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: `This action requires one of these roles: ${roles.join(", ")}`,
          details: {},
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}
