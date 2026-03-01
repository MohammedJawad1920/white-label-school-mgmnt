/**
 * Attendance Routes
 *
 * Two routers exported:
 *  - default: /record-class + /summary — mounted at /api/attendance
 *  - studentAttendanceRouter: /:studentId/attendance — mounted at /api/students
 */
import { Router } from "express";
import { tenantContextMiddleware } from "../../middleware/tenantContext";
import { featureGuard } from "../../middleware/featureGuard";
import { requireRole } from "../../middleware/requireRole";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  recordClassAttendance,
  getStudentAttendance,
  getAttendanceSummary,
} from "./controller";

// ---- Main attendance router (mounted at /api/attendance) ----
const router = Router();
router.use(tenantContextMiddleware);
router.use(featureGuard("attendance"));

// Teacher records attendance; Admin views summaries
router.post("/record-class", asyncHandler(recordClassAttendance));
router.get(
  "/summary",
  requireRole("Admin"),
  asyncHandler(getAttendanceSummary),
);

// ---- Student-attendance router (mounted at /api/students) ----
const studentAttendanceRouter = Router();
studentAttendanceRouter.use(tenantContextMiddleware);
studentAttendanceRouter.use(featureGuard("attendance"));

// GET /api/students/:studentId/attendance
studentAttendanceRouter.get(
  "/:studentId/attendance",
  asyncHandler(getStudentAttendance),
);

export { studentAttendanceRouter };
export default router;
