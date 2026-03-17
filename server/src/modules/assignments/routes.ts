/**
 * Assignments Routes — v5.0
 *
 * Mounted at /api/v1/assignments
 * All routes require tenant context (JWT validated, tenantId + userId available).
 */

import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createAssignment,
  listAssignments,
  getAssignment,
  updateAssignment,
  deleteAssignment,
  closeAssignment,
  getSubmissions,
  bulkMark,
} from "./controller";

const router = Router();
router.use(tenantContextMiddleware);

router.post(
  "/",
  requireRole("Admin", "Teacher"),
  asyncHandler(createAssignment),
);
router.get(
  "/",
  requireRole("Admin", "Teacher", "Student", "Guardian"),
  asyncHandler(listAssignments),
);
router.get(
  "/:id",
  requireRole("Admin", "Teacher", "Student", "Guardian"),
  asyncHandler(getAssignment),
);
router.put(
  "/:id",
  requireRole("Admin", "Teacher"),
  asyncHandler(updateAssignment),
);
router.delete(
  "/:id",
  requireRole("Admin", "Teacher"),
  asyncHandler(deleteAssignment),
);
router.put("/:id/close", requireRole("Admin"), asyncHandler(closeAssignment));
router.get(
  "/:id/submissions",
  requireRole("Admin", "Teacher"),
  asyncHandler(getSubmissions),
);
router.put(
  "/:id/submissions",
  requireRole("Admin", "Teacher"),
  asyncHandler(bulkMark),
);

export default router;
