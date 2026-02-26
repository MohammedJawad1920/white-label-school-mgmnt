/**
 * SuperAdmin Routes
 *
 * ALL routes here use superAdminAuthMiddleware exclusively.
 * tenantContextMiddleware MUST NOT appear anywhere in this file.
 * Freeze §1.6: "Do NOT apply tenantContextMiddleware to /api/super-admin/* routes"
 */

import { Router } from "express";
import { superAdminAuthMiddleware } from "../../middleware/superAdminAuth";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  superAdminLogin,
  listTenants,
  createTenant,
  updateTenant,
  deactivateTenant,
  getTenantFeatures,
  toggleTenantFeature,
} from "./controller";

const router = Router();

// ── Auth (no middleware — public endpoint) ────────────────────────
router.post("/auth/login", asyncHandler(superAdminLogin));

// ── All routes below require SuperAdmin JWT ───────────────────────
router.use(superAdminAuthMiddleware);

// ── Tenant Management ─────────────────────────────────────────────
router.get("/tenants", asyncHandler(listTenants));
router.post("/tenants", asyncHandler(createTenant));
router.put("/tenants/:tenantId", asyncHandler(updateTenant));
router.put("/tenants/:tenantId/deactivate", asyncHandler(deactivateTenant));

// ── Feature Management ────────────────────────────────────────────
router.get("/tenants/:tenantId/features", asyncHandler(getTenantFeatures));
router.put(
  "/tenants/:tenantId/features/:featureKey",
  asyncHandler(toggleTenantFeature),
);

export default router;
