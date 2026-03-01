/**
 * Features Routes (Tenant-level)
 *
 * Freeze §3.5:
 *   GET  /api/features              — Admin only (read-only)
 *   PUT  /api/features/:featureKey  — REMOVED in v3.2, 403 for all callers
 *
 * tenantContextMiddleware is applied to all routes so JWT is verified
 * and req.tenantId is available.
 */

import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import { listFeatures, toggleFeatureDeprecated } from "./controller";

const router = Router();
router.use(tenantContextMiddleware);

// Admin read-only — list feature flags for the tenant
router.get("/", requireRole("Admin"), asyncHandler(listFeatures));

// REMOVED in v3.2 — always returns 403
// Auth is still required (tenantContextMiddleware) so unauthenticated
// requests get 401, not 403.
router.put("/:featureKey", asyncHandler(toggleFeatureDeprecated));

export default router;
