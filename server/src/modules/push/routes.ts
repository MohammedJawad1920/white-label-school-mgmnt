/**
 * Push Subscription Routes
 *
 * POST   /api/v1/push/subscribe  — register a Web Push subscription
 * DELETE /api/v1/push/subscribe  — remove a Web Push subscription
 */
import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import * as controller from "./controller";

const router = Router();
router.use(tenantContextMiddleware);

router.post(
  "/subscribe",
  requireRole("Admin", "Teacher", "Student", "Guardian"),
  asyncHandler(controller.subscribe),
);
router.delete(
  "/subscribe",
  requireRole("Admin", "Teacher", "Student", "Guardian"),
  asyncHandler(controller.unsubscribe),
);

export default router;
