/**
 * Guardians Routes
 *
 * POST   /api/v1/guardians          — create guardian + link to student (Admin)
 * PUT    /api/v1/guardians/:id      — update guardian details (Admin)
 * DELETE /api/v1/guardians/:id      — soft-delete guardian (Admin)
 *
 * listStudentGuardians is exported for use by the students module router.
 */
import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import * as controller from "./controller";

const router = Router();
router.use(tenantContextMiddleware);

router.post("/", requireRole("Admin"), asyncHandler(controller.createGuardian));
router.put(
  "/:id",
  requireRole("Admin"),
  asyncHandler(controller.updateGuardian),
);
router.delete(
  "/:id",
  requireRole("Admin"),
  asyncHandler(controller.deleteGuardian),
);

export default router;

// Used by students module to expose GET /api/v1/students/:id/guardians
export { controller as guardiansController };
