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
  superAdminLogout,
  listTenants,
  createTenant,
  updateTenant,
  deactivateTenant,
  reactivateTenant,
  getTenantFeatures,
  toggleTenantFeature,
} from "./controller";

const router = Router();

// ── Auth (no middleware — public endpoint) ──────────────────────────────────
router.post("/auth/login", asyncHandler(superAdminLogin));
// D-04 fix: SA logout route — behind superAdminAuthMiddleware so only
// valid SA tokens can reach it (even though JWT is stateless, aligns with contract).
router.post(
  "/auth/logout",
  superAdminAuthMiddleware,
  asyncHandler(superAdminLogout),
);

// ── All routes below require SuperAdmin JWT ───────────────────────
router.use(superAdminAuthMiddleware);

// ── Tenant Management ─────────────────────────────────────────────
router.get("/tenants", asyncHandler(listTenants));
router.post("/tenants", asyncHandler(createTenant));
// Specific sub-path PUTs MUST precede the generic /:tenantId PUT (Express top-to-bottom)
router.put("/tenants/:tenantId/deactivate", asyncHandler(deactivateTenant));
router.put("/tenants/:tenantId/reactivate", asyncHandler(reactivateTenant)); // v3.4 CR-07
router.put("/tenants/:tenantId", asyncHandler(updateTenant));

// ── Feature Management ────────────────────────────────────────────
router.get("/tenants/:tenantId/features", asyncHandler(getTenantFeatures));
router.put(
  "/tenants/:tenantId/features/:featureKey",
  asyncHandler(toggleTenantFeature),
);

export default router;
