import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import * as controller from "./controller";

const router = Router();
router.use(tenantContextMiddleware);

router.get(
  "/children",
  requireRole("Guardian"),
  asyncHandler(controller.listChildren),
);
router.get(
  "/children/:studentId/attendance",
  requireRole("Guardian"),
  asyncHandler(controller.childAttendance),
);
router.get(
  "/children/:studentId/timetable",
  requireRole("Guardian"),
  asyncHandler(controller.childTimetable),
);
router.get(
  "/children/:studentId/results",
  requireRole("Guardian"),
  asyncHandler(controller.childResults),
);
router.get(
  "/children/:studentId/fees",
  requireRole("Guardian"),
  asyncHandler(controller.childFees),
);
router.get(
  "/children/:studentId/assignments",
  requireRole("Guardian"),
  asyncHandler(controller.childAssignments),
);
router.get(
  "/children/:studentId/leave",
  requireRole("Guardian"),
  asyncHandler(controller.childLeave),
);

export default router;
