/**
 * Notifications Routes
 *
 * GET  /api/v1/notifications          — list notifications for the current user
 * PUT  /api/v1/notifications/read-all — mark all unread notifications as read
 * PUT  /api/v1/notifications/:id/read — mark a single notification as read
 *
 * NOTE: /read-all is registered BEFORE /:id/read to prevent path conflict.
 */
import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { featureGuard } from "../../middleware/featureGuard";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import * as controller from "./controller";

const router = Router();
router.use(tenantContextMiddleware);
router.use(featureGuard("notifications"));

// /read-all MUST be registered before /:id/read to avoid Express treating
// "read-all" as a :id param value.
router.put(
  "/read-all",
  requireRole("Admin", "Teacher", "Student", "Guardian"),
  asyncHandler(controller.markAllRead),
);
router.get(
  "/",
  requireRole("Admin", "Teacher", "Student", "Guardian"),
  asyncHandler(controller.listNotifications),
);
router.put(
  "/:id/read",
  requireRole("Admin", "Teacher", "Student", "Guardian"),
  asyncHandler(controller.markOneRead),
);

export default router;
