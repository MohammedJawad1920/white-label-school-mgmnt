/**
 * Attendance Routes
 *
 * NOTE: getStudentAttendance is mounted here even though its path is
 * /students/:studentId/attendance — we mount this router at /api in app.ts
 * with a broader prefix so the full path resolves correctly.
 * See app.ts comment for mount strategy.
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

// Student history — path: /students/:studentId/attendance
// This route is mounted separately in app.ts under /api/students
router.get("/:studentId/attendance", asyncHandler(getStudentAttendance));

export default router;
