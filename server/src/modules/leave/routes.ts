import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { featureGuard } from "../../middleware/featureGuard";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import * as controller from "./controller";

const router = Router();
router.use(tenantContextMiddleware);
router.use(featureGuard("leave"));

// IMPORTANT: /on-campus must come before /:id to avoid path conflict
router.get(
  "/on-campus",
  requireRole("Teacher", "Admin"),
  asyncHandler(controller.onCampus),
);

router.post(
  "/",
  requireRole("Guardian", "Teacher", "Admin"),
  asyncHandler(controller.submitLeave),
);
router.get(
  "/",
  requireRole("Teacher", "Admin", "Guardian"),
  asyncHandler(controller.listLeave),
);
router.get(
  "/:id",
  requireRole("Guardian", "Teacher", "Admin"),
  asyncHandler(controller.getLeave),
);
router.put(
  "/:id/approve",
  requireRole("Teacher", "Admin"),
  asyncHandler(controller.approveLeave),
);
router.put(
  "/:id/reject",
  requireRole("Teacher", "Admin"),
  asyncHandler(controller.rejectLeave),
);
router.put(
  "/:id/cancel",
  requireRole("Guardian", "Admin"),
  asyncHandler(controller.cancelLeave),
);
router.put(
  "/:id/depart",
  requireRole("Teacher", "Admin"),
  asyncHandler(controller.departLeave),
);
router.put(
  "/:id/return",
  requireRole("Teacher", "Admin"),
  asyncHandler(controller.returnLeave),
);

export default router;
