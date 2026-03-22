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
  getStudentAttendanceSummary,
  correctAttendance,
  getAttendanceStreaks,
  getAttendanceToppers,
  getAttendanceDailySummary,
  getAttendanceMonthlySheet,
  getAbsentees,
} from "./controller";

// ---- Main attendance router (mounted at /api/attendance) ----
const router = Router();
router.use(tenantContextMiddleware);
router.use(featureGuard("attendance"));

// Teacher records attendance; Admin views summaries
// D-06 fix: requireRole guard — Students must not be able to record attendance.
router.post(
  "/record-class",
  requireRole("Teacher", "Admin"),
  asyncHandler(recordClassAttendance),
);
router.get(
  "/summary",
  requireRole("Admin", "Teacher"),
  asyncHandler(getAttendanceSummary),
);
// PUT /api/attendance/:recordId — correct a single record (v3.4 CR-09)
router.put(
  "/:recordId",
  requireRole("Teacher", "Admin"),
  asyncHandler(correctAttendance),
);

// ── CR-33/34/35/36 — new analytics endpoints (v4.5) ──────────────────────────

// GET /api/attendance/streaks — consecutive absent streak per student × subject
// Admin: any timeslot; Teacher: own timeslots only; Student: own entry only
router.get(
  "/streaks",
  requireRole("Teacher", "Admin", "Student"),
  asyncHandler(getAttendanceStreaks),
);

// GET /api/attendance/toppers — students ranked by attendance % for a class
// Admin: any classId; Teacher: own classes only; Student: full ranking
router.get(
  "/toppers",
  requireRole("Teacher", "Admin", "Student"),
  asyncHandler(getAttendanceToppers),
);

// GET /api/attendance/daily-summary — per-slot counts for a class on a date
// Feature guard: timetable (slot structure); Admin: any; Teacher: own; Student: allowed (no PII)
router.get(
  "/daily-summary",
  featureGuard("timetable"),
  requireRole("Teacher", "Admin", "Student"),
  asyncHandler(getAttendanceDailySummary),
);

// GET /api/attendance/monthly-sheet — student × day × period grid
// Admin: any class+subject; Teacher: own class+subject pair; Student: 403 blocked by requireRole
router.get(
  "/monthly-sheet",
  requireRole("Teacher", "Admin"),
  asyncHandler(getAttendanceMonthlySheet),
);

// GET /api/attendance/absentees?timeSlotId=...&date=... — absent student names + streak for a timeslot+date
// Admin: any non-deleted timeslot; Teacher: any non-deleted timeslot (CR-41)
// Student + SuperAdmin blocked by requireRole
router.get(
  "/absentees",
  requireRole("Admin", "Teacher"),
  asyncHandler(getAbsentees),
);

// ---- Student-attendance router (mounted at /api/students) ----
const studentAttendanceRouter = Router();
studentAttendanceRouter.use(tenantContextMiddleware);
studentAttendanceRouter.use(featureGuard("attendance"));

// GET /api/students/:studentId/attendance — Students may view own record
studentAttendanceRouter.get(
  "/:studentId/attendance",
  requireRole("Teacher", "Admin", "Student"),
  asyncHandler(getStudentAttendance),
);

// GET /api/students/:studentId/attendance/summary — CR-25
studentAttendanceRouter.get(
  "/:studentId/attendance/summary",
  requireRole("Teacher", "Admin", "Student"),
  asyncHandler(getStudentAttendanceSummary),
);

export { studentAttendanceRouter };
export default router;
