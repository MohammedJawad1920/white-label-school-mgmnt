/**
 * Announcements Routes — v5.0
 *
 * Mounted at /api/v1/announcements
 * All routes require tenant context (JWT validated, tenantId + userId available).
 */

import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createAnnouncement,
  listAnnouncements,
  getAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "./controller";

const router = Router();
router.use(tenantContextMiddleware);

router.post(
  "/",
  requireRole("Admin", "Teacher"),
  asyncHandler(createAnnouncement),
);
router.get(
  "/",
  requireRole("Admin", "Teacher", "Student", "Guardian"),
  asyncHandler(listAnnouncements),
);
router.get(
  "/:id",
  requireRole("Admin", "Teacher", "Student", "Guardian"),
  asyncHandler(getAnnouncement),
);
router.put(
  "/:id",
  requireRole("Admin", "Teacher"),
  asyncHandler(updateAnnouncement),
);
router.delete(
  "/:id",
  requireRole("Admin", "Teacher"),
  asyncHandler(deleteAnnouncement),
);

export default router;
