/**
 * featureGuard — Feature-gate middleware factory
 *
 * WHAT IT DOES:
 * Checks tenant_features for the given key. If not enabled, returns
 * 403 FEATURE_DISABLED before the request reaches the controller.
 *
 * WHY middleware not controller logic:
 * Every timetable AND attendance controller would need the same DB check.
 * Centralising it in middleware means you can't accidentally forget it on
 * a new route — it's enforced at the router mount point in app.ts.
 *
 * WHY it requires tenantContextMiddleware first:
 * It reads req.tenantId which only exists after tenantContextMiddleware runs.
 * Always mount featureGuard AFTER tenantContextMiddleware on the same route.
 */

import { Request, Response, NextFunction } from "express";
import { pool } from "../db/pool";
import { FeatureKey } from "../types";

export function featureGuard(featureKey: FeatureKey) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const tenantId = req.tenantId!;

    const result = await pool.query<{ enabled: boolean }>(
      `SELECT enabled FROM tenant_features
       WHERE tenant_id = $1 AND feature_key = $2`,
      [tenantId, featureKey],
    );

    const enabled = result.rows[0]?.enabled ?? false;

    if (!enabled) {
      res.status(403).json({
        error: {
          code: "FEATURE_DISABLED",
          message: `${featureKey.charAt(0).toUpperCase() + featureKey.slice(1)} feature is not enabled for this tenant`,
          details: { featureKey },
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    next();
  };
}
