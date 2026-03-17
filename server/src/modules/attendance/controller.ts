/**
 * Attendance Controller
 *
 * POST /api/v1/attendance/record-class              — bulk-record for a timeslot (UPSERT per student)
 * GET  /api/v1/students/:studentId/attendance       — paginated student history
 * GET  /api/v1/attendance/summary                   — aggregate by class + date range
 *
 * RECORD-CLASS PATTERN (students array):
 * Caller passes an explicit list of { studentId, status } pairs.
 * The endpoint uses UPSERT — safe to re-submit with corrected statuses.
 *
 * IDEMPOTENCY:
 * The DB has UNIQUE(student_id, timeslot_id, date).
 * Re-submitting updates the existing record via ON CONFLICT DO UPDATE.
 */

import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool, withTransaction } from "../../db/pool";
import { send400, send403, send404, send409, send422 } from "../../utils/errors";
import {
  AttendanceRecordRow,
  AttendanceStatus,
  StudentRow,
  TimeslotRow,
} from "../../types";

// ═══════════════════════════════════════════════════════════════════
// POST /api/attendance/record-class
// ═══════════════════════════════════════════════════════════════════

export async function recordClassAttendance(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const recordedBy = req.userId!;
  const callerRoles = req.userRoles ?? [];

  const { timeslotId, date, students } = req.body as {
    timeslotId?: string;
    date?: string;
    students?: Array<{ studentId: string; status: string }>;
  };

  // ── Validation ────────────────────────────────────────────────────
  if (!timeslotId || typeof timeslotId !== "string" || timeslotId.trim().length === 0) {
    send422(res, "timeslotId is required");
    return;
  }
  if (!date || typeof date !== "string") {
    send422(res, "date is required");
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    send422(res, "date must be a valid date in YYYY-MM-DD format");
    return;
  }
  if (!Array.isArray(students) || students.length === 0) {
    send422(res, "students must be a non-empty array");
    return;
  }
  if (students.length > 200) {
    send422(res, "students array must not exceed 200 entries");
    return;
  }

  // Teachers cannot set Excused — only Admins can
  const isAdmin = callerRoles.includes("Admin");
  const teacherStatuses: AttendanceStatus[] = ["Present", "Absent", "Late"];
  const adminStatuses: AttendanceStatus[] = [...teacherStatuses, "Excused"];
  const validStatuses = isAdmin ? adminStatuses : teacherStatuses;

  for (const entry of students) {
    if (!entry.studentId || typeof entry.studentId !== "string") {
      send422(res, "Each student entry must have a studentId");
      return;
    }
    if (!entry.status || !validStatuses.includes(entry.status as AttendanceStatus)) {
      send422(
        res,
        `Each student status must be one of: ${validStatuses.join(", ")}`,
      );
      return;
    }
  }

  // ── Verify timeslot exists and is active ──────────────────────────
  const tsResult = await pool.query<
    TimeslotRow & { class_name: string; subject_name: string }
  >(
    `SELECT t.id, t.tenant_id, t.class_id, t.subject_id, t.teacher_id,
            t.day_of_week, t.period_number,
            t.deleted_at, t.created_at, t.updated_at,
            c.name AS class_name, s.name AS subject_name
     FROM timeslots t
     JOIN classes  c ON c.id = t.class_id
     JOIN subjects s ON s.id = t.subject_id
     WHERE t.id = $1 AND t.tenant_id = $2 AND t.deleted_at IS NULL`,
    [timeslotId, tenantId],
  );

  if ((tsResult.rowCount ?? 0) === 0) {
    send404(res, "Timeslot not found");
    return;
  }

  const timeslot = tsResult.rows[0]!;

  // ── Teacher auth guard ─────────────────────────────────────────────
  // A Teacher may only record attendance for their own assigned slot.
  if (callerRoles.includes("Teacher") && !isAdmin) {
    if (timeslot.teacher_id !== recordedBy) {
      send403(res, "You are not assigned to this timeslot", "FORBIDDEN");
      return;
    }
  }

  // ── Backdating guard (Teacher only) ──────────────────────────────
  // Per OpenAPI: Teachers cannot backdate attendance.
  if (callerRoles.includes("Teacher") && !isAdmin) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const recordDate = new Date(date + "T00:00:00Z");
    recordDate.setUTCHours(0, 0, 0, 0);
    // Compare using ISO date strings for reliable comparison
    const todayStr = today.toISOString().slice(0, 10);
    if (date < todayStr) {
      send400(res, "Teachers cannot backdate attendance", "BACKDATING_NOT_ALLOWED");
      return;
    }
  }

  // ── Upsert attendance records in a transaction ────────────────────
  await withTransaction(async (client) => {
    for (const entry of students) {
      const id = uuidv4();
      await client.query(
        `INSERT INTO attendance_records
           (id, tenant_id, student_id, timeslot_id, date, status, recorded_by, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (student_id, timeslot_id, date)
         DO UPDATE SET
           status     = EXCLUDED.status,
           updated_by = $7,
           updated_at = NOW()`,
        [id, tenantId, entry.studentId, timeslotId, date, entry.status, recordedBy],
      );
    }
  });

  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const entry of students) {
    switch (entry.status) {
      case "Present":
        counts.present++;
        break;
      case "Absent":
        counts.absent++;
        break;
      case "Late":
        counts.late++;
        break;
      case "Excused":
        counts.excused++;
        break;
    }
  }

  res.status(200).json({
    recorded: students.length,
    present: counts.present,
    absent: counts.absent,
    late: counts.late,
    excused: counts.excused,
  });
}

// ═══════════════════════════════════════════════════════════════════
// GET /api/students/:studentId/attendance
// ═══════════════════════════════════════════════════════════════════

export async function getStudentAttendance(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { studentId } = req.params as { studentId: string };
  const {
    from,
    to,
    limit: limitStr,
    offset: offsetStr,
  } = req.query as {
    from?: string;
    to?: string;
    limit?: string;
    offset?: string;
  };

  const limit = Math.min(parseInt(limitStr ?? "50", 10), 200);
  const offset = Math.max(parseInt(offsetStr ?? "0", 10), 0);

  // Verify student belongs to this tenant + JOIN class for className (Freeze §3.5)
  // CR-21: LEFT JOIN so graduated students (class_id = NULL) are not excluded (D-02 fix).
  const studentResult = await pool.query<
    StudentRow & { class_name: string | null }
  >(
    `SELECT st.id, st.tenant_id, st.name, st.class_id, st.batch_id,
            st.user_id,
            st.deleted_at, st.created_at, st.updated_at,
            c.name AS class_name
     FROM students st
     LEFT JOIN classes c ON c.id = st.class_id
     WHERE st.id = $1 AND st.tenant_id = $2 AND st.deleted_at IS NULL`,
    [studentId, tenantId],
  );
  if ((studentResult.rowCount ?? 0) === 0) {
    send404(res, "Student not found");
    return;
  }
  const student = studentResult.rows[0]!;

  // ── CR-08: Student self-access guard ──────────────────────────────
  // Students may only view their own attendance record.
  if (req.userRoles?.includes("Student") && student.user_id !== req.userId) {
    send403(
      res,
      "Students can only access their own attendance",
      "STUDENT_ACCESS_DENIED",
    );
    return;
  }

  // Build attendance query
  const conditions = ["ar.student_id = $1", "ar.tenant_id = $2"];
  const params: unknown[] = [studentId, tenantId];
  let idx = 3;

  if (from) {
    conditions.push(`ar.date >= $${idx++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`ar.date <= $${idx++}`);
    params.push(to);
  }

  // Total count for pagination
  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM attendance_records ar
     WHERE ${conditions.join(" AND ")}`,
    params,
  );
  const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

  // Paginated records
  const recordsResult = await pool.query<{
    id: string;
    date: string;
    status: AttendanceStatus;
    updated_by: string | null;
    updated_at: Date | null;
    recorded_by: string;
    recorded_at: Date;
    ts_id: string;
    subject_name: string;
    period_number: number;
    day_of_week: string;
  }>(
    `SELECT
       ar.id, ar.date, ar.status,
       ar.updated_by, ar.updated_at,
       ar.recorded_by, ar.recorded_at,
       t.id  AS ts_id,
       s.name AS subject_name,
       t.period_number,
       t.day_of_week
     FROM attendance_records ar
     JOIN timeslots t ON t.id = ar.timeslot_id
     JOIN subjects  s ON s.id = t.subject_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY ar.date DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset],
  );

  // Summary aggregation over the full filtered set (not just this page)
  const summaryResult = await pool.query<{
    total: string;
    present: string;
    absent: string;
    late: string;
    excused: string;
  }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE ar.status = 'Present') AS present,
       COUNT(*) FILTER (WHERE ar.status = 'Absent')  AS absent,
       COUNT(*) FILTER (WHERE ar.status = 'Late')    AS late,
       COUNT(*) FILTER (WHERE ar.status = 'Excused') AS excused
     FROM attendance_records ar
     WHERE ${conditions.join(" AND ")}`,
    params,
  );

  const agg = summaryResult.rows[0]!;
  const totalRecs = parseInt(agg.total, 10);
  const presentCnt = parseInt(agg.present, 10);
  const attendanceRate =
    totalRecs > 0
      ? Math.round((presentCnt / totalRecs) * 10000) / 100 // 2dp percent
      : 0;

  res.status(200).json({
    student: {
      id: student.id,
      name: student.name,
      className: student.class_name,
    },
    records: recordsResult.rows.map((r) => ({
      id: r.id,
      date: String(r.date).slice(0, 10),
      status: r.status,
      updatedBy: r.updated_by ?? null,
      updatedAt: r.updated_at?.toISOString() ?? null,
      timeSlot: {
        id: r.ts_id,
        subjectName: r.subject_name,
        periodNumber: r.period_number,
        dayOfWeek: r.day_of_week,
      },
      recordedBy: r.recorded_by,
      recordedAt: r.recorded_at.toISOString(),
    })),
    summary: {
      totalRecords: totalRecs,
      present: presentCnt,
      absent: parseInt(agg.absent, 10),
      late: parseInt(agg.late, 10),
      excused: parseInt(agg.excused, 10),
      attendanceRate,
    },
    pagination: {
      limit,
      offset,
      total,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════
// GET /api/attendance/summary  (CR-28)
// ═══════════════════════════════════════════════════════════════════
// Admin: any classId in tenant
// Teacher: only classIds where caller has an active timeslot assignment
//          (deleted_at IS NULL)
//          → 403 FORBIDDEN if no assignment found for that classId
// Student: 403 FORBIDDEN (handled by requireRole guard in routes)

export async function getAttendanceSummary(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const callerId = req.userId!;
  const callerRoles = req.userRoles ?? [];

  const { classId, from, to } = req.query as {
    classId?: string;
    from?: string;
    to?: string;
  };

  // ── Validation ────────────────────────────────────────────────────
  if (!classId || !from || !to) {
    send400(res, "classId, from, and to are required");
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    send400(res, "from and to must be valid dates in YYYY-MM-DD format");
    return;
  }
  if (from > to) {
    send400(res, "from must be on or before to", "VALIDATION_ERROR");
    return;
  }

  // ── Class lookup ──────────────────────────────────────────────────
  const classResult = await pool.query<{ id: string; name: string }>(
    "SELECT id, name FROM classes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [classId, tenantId],
  );
  if ((classResult.rowCount ?? 0) === 0) {
    send404(res, "Class not found");
    return;
  }
  const classRow = classResult.rows[0]!;

  // ── Teacher active-assignment guard (CR-28) ───────────────────────
  if (callerRoles.includes("Teacher") && !callerRoles.includes("Admin")) {
    const assignmentCheck = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM timeslots
         WHERE class_id = $1
           AND teacher_id = $2
           AND tenant_id = $3
           AND deleted_at IS NULL
       ) AS exists`,
      [classId, callerId, tenantId],
    );
    if (!assignmentCheck.rows[0]?.exists) {
      send403(res, "You are not assigned to this class", "FORBIDDEN");
      return;
    }
  }

  // ── Aggregate query ───────────────────────────────────────────────
  const totalStudents = await pool.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM students WHERE class_id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [classId, tenantId],
  );
  const studentCount = parseInt(totalStudents.rows[0]?.count ?? "0", 10);

  const aggResult = await pool.query<{
    total: string;
    present_late: string;
  }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (
         WHERE ar.status IN ('Present', 'Late')
       ) AS present_late
     FROM attendance_records ar
     JOIN students s ON s.id = ar.student_id
     WHERE s.class_id = $1
       AND ar.tenant_id = $2
       AND ar.date BETWEEN $3 AND $4`,
    [classId, tenantId, from, to],
  );

  const agg = aggResult.rows[0]!;
  const totalClasses = parseInt(agg.total, 10);
  const presentLate = parseInt(agg.present_late, 10);
  const avgRate =
    totalClasses > 0
      ? Math.round((presentLate / totalClasses) * 10000) / 100
      : 0;

  res.status(200).json({
    summary: {
      classId: classRow.id,
      className: classRow.name,
      from,
      to,
      totalStudents: studentCount,
      totalClasses,
      averageAttendanceRate: avgRate,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════
// PUT /api/v1/attendance/:recordId   (v3.4 CR-09, updated v5.0 M-012)
// ═══════════════════════════════════════════════════════════════════
// Teacher (own class) or Admin can correct an attendance status.
// v5.0: status column is now directly updated; updated_by / updated_at
// replace the old corrected_* audit columns.
// 'Excused' is Admin-only (Teachers may only set Present/Absent/Late).

export async function correctAttendance(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const callerId = req.userId!;
  const { recordId } = req.params as { recordId: string };
  const { status } = req.body as { status?: string };

  const callerRoles = req.userRoles ?? [];
  const isAdmin = callerRoles.includes("Admin");

  // Teachers cannot set Excused — only Admins can
  const teacherStatuses: AttendanceStatus[] = ["Present", "Absent", "Late"];
  const adminStatuses: AttendanceStatus[] = [...teacherStatuses, "Excused"];
  const validStatuses = isAdmin ? adminStatuses : teacherStatuses;

  if (!status || !validStatuses.includes(status as AttendanceStatus)) {
    send400(res, `status must be one of: ${validStatuses.join(", ")}`);
    return;
  }

  // Fetch record + timeslot (need teacher_id for access check)
  const recordResult = await pool.query<
    AttendanceRecordRow & { teacher_id: string; record_date: string }
  >(
    `SELECT ar.id, ar.tenant_id, ar.student_id, ar.timeslot_id,
            ar.date AS record_date,
            ar.status,
            ar.updated_by, ar.updated_at,
            ar.recorded_by, ar.recorded_at,
            t.teacher_id
     FROM attendance_records ar
     JOIN timeslots t ON t.id = ar.timeslot_id
     WHERE ar.id = $1 AND ar.tenant_id = $2`,
    [recordId, tenantId],
  );

  if ((recordResult.rowCount ?? 0) === 0) {
    send404(res, "Attendance record not found");
    return;
  }

  const record = recordResult.rows[0]!;

  // ── FUTURE_DATE guard ─────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const recordDate = new Date(record.record_date);
  recordDate.setHours(0, 0, 0, 0);
  if (recordDate > today) {
    send400(res, "Cannot correct attendance for a future date", "FUTURE_DATE");
    return;
  }

  // ── SAME_STATUS guard ─────────────────────────────────────────────
  if (status === record.status) {
    send409(res, "Status is already set to that value", "SAME_STATUS");
    return;
  }

  // ── Teacher own-class access check ───────────────────────────────
  if (!isAdmin && callerRoles.includes("Teacher")) {
    if (record.teacher_id !== callerId) {
      send403(
        res,
        "Teachers can only correct attendance for their own classes",
        "FORBIDDEN",
      );
      return;
    }
  }

  // ── Apply correction ──────────────────────────────────────────────
  const updated = await pool.query<
    AttendanceRecordRow & { record_date: string }
  >(
    `UPDATE attendance_records
     SET status = $1, updated_by = $2, updated_at = NOW()
     WHERE id = $3 AND tenant_id = $4
     RETURNING id, tenant_id, student_id, timeslot_id,
               date AS record_date,
               status,
               updated_by, updated_at,
               recorded_by, recorded_at`,
    [status, callerId, recordId, tenantId],
  );

  const r = updated.rows[0]!;
  res.status(200).json({
    record: {
      id: r.id,
      studentId: r.student_id,
      timeslotId: r.timeslot_id,
      date: String(r.record_date).slice(0, 10),
      status: r.status,
      recordedBy: r.recorded_by,
      recordedAt:
        r.recorded_at instanceof Date
          ? r.recorded_at.toISOString()
          : String(r.recorded_at),
      updatedBy: r.updated_by ?? null,
      updatedAt: r.updated_at?.toISOString() ?? null,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════
// GET /api/students/:studentId/attendance/summary  (CR-25)
// ═══════════════════════════════════════════════════════════════════
// Roles allowed: Admin, Teacher, Student
// Student guard: if caller is Student (and not Admin/Teacher), then
//   student.user_id MUST match req.userId → 403 STUDENT_ACCESS_DENIED
// Query params: year (integer), month (integer 1-12)

export async function getStudentAttendanceSummary(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const callerId = req.userId!;
  const callerRoles = req.userRoles ?? [];
  const { studentId } = req.params as { studentId: string };

  // ── Parse year / month ────────────────────────────────────────────
  const { year: yearStr, month: monthStr } = req.query as {
    year?: string;
    month?: string;
  };

  if (!yearStr || !monthStr) {
    send400(res, "year and month are required");
    return;
  }

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (isNaN(year) || year < 2000 || year > 9999) {
    send400(res, "year must be a valid integer (e.g. 2025)");
    return;
  }
  if (isNaN(month) || month < 1 || month > 12) {
    send400(res, "month must be an integer between 1 and 12");
    return;
  }

  // ── Fetch student + tenant ownership check ────────────────────────
  const studentResult = await pool.query<{
    id: string;
    user_id: string | null;
  }>(
    "SELECT id, user_id FROM students WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [studentId, tenantId],
  );
  if ((studentResult.rowCount ?? 0) === 0) {
    send404(res, "Student not found");
    return;
  }

  const student = studentResult.rows[0]!;

  // ── Student self-access guard ─────────────────────────────────────
  if (
    callerRoles.includes("Student") &&
    !callerRoles.includes("Admin") &&
    !callerRoles.includes("Teacher")
  ) {
    if (student.user_id !== callerId) {
      send403(res, "Access denied", "STUDENT_ACCESS_DENIED");
      return;
    }
  }

  // ── Date range for the requested month ───────────────────────────
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  // Last day of month: go to 1st of next month then subtract a day
  const lastDay = new Date(year, month, 0).getDate(); // month is 1-based; JS Date month is 0-based
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // ── Aggregate ─────────────────────────────────────────────────────
  const aggResult = await pool.query<{
    total: string;
    present: string;
    absent: string;
    late: string;
    excused: string;
  }>(
    `SELECT
       COUNT(*)                                       AS total,
       COUNT(*) FILTER (WHERE ar.status = 'Present') AS present,
       COUNT(*) FILTER (WHERE ar.status = 'Absent')  AS absent,
       COUNT(*) FILTER (WHERE ar.status = 'Late')    AS late,
       COUNT(*) FILTER (WHERE ar.status = 'Excused') AS excused
     FROM attendance_records ar
     WHERE ar.student_id = $1
       AND ar.tenant_id  = $2
       AND ar.date BETWEEN $3 AND $4`,
    [studentId, tenantId, from, to],
  );

  const agg = aggResult.rows[0]!;
  const totalClasses = parseInt(agg.total, 10);
  const present = parseInt(agg.present, 10);
  const absent = parseInt(agg.absent, 10);
  const late = parseInt(agg.late, 10);
  const excused = parseInt(agg.excused, 10);

  const attendancePercentage =
    totalClasses > 0
      ? Math.round(((present + late) / totalClasses) * 10000) / 100
      : 0;

  res.status(200).json({
    summary: {
      studentId,
      year,
      month,
      totalClasses,
      present,
      absent,
      late,
      excused,
      attendancePercentage,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════
// GET /api/attendance/streaks  (v4.5 CR-33)
// ═══════════════════════════════════════════════════════════════════
// Returns consecutive absent streak per student for the subject of the
// given timeslot.
// Admin: any non-deleted timeslot in tenant
// Teacher: only timeslots where caller is the assigned teacher → 403
// Student: any timeslot; response filtered to own entry only

export async function getAttendanceStreaks(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const callerId = req.userId!;
  const callerRole = req.activeRole!;

  const { timeSlotId } = req.query as { timeSlotId?: string };

  if (!timeSlotId) {
    send400(res, "timeSlotId is required", "VALIDATION_ERROR");
    return;
  }

  // Fetch timeslot + resolve classId/subjectId
  const tsResult = await pool.query<{
    id: string;
    class_id: string;
    subject_id: string;
    teacher_id: string;
  }>(
    `SELECT id, class_id, subject_id, teacher_id
     FROM timeslots
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [timeSlotId, tenantId],
  );
  if ((tsResult.rowCount ?? 0) === 0) {
    send404(res, "Timeslot not found");
    return;
  }
  const timeslot = tsResult.rows[0]!;

  // Teacher guard: must be assigned to this timeslot
  if (callerRole === "Teacher") {
    if (timeslot.teacher_id !== callerId) {
      send403(res, "You are not assigned to this timeslot", "FORBIDDEN");
      return;
    }
  }

  // Fetch active students in the class
  let studentsQuery: string;
  let studentsParams: unknown[];

  if (callerRole === "Student") {
    // Student sees only their own entry
    studentsQuery = `SELECT s.id FROM students s
                     WHERE s.class_id = $1 AND s.tenant_id = $2 AND s.deleted_at IS NULL
                       AND s.user_id = $3`;
    studentsParams = [timeslot.class_id, tenantId, callerId];
  } else {
    studentsQuery = `SELECT s.id FROM students s
                     WHERE s.class_id = $1 AND s.tenant_id = $2 AND s.deleted_at IS NULL
                     ORDER BY s.id`;
    studentsParams = [timeslot.class_id, tenantId];
  }

  const studentsResult = await pool.query<{ id: string }>(
    studentsQuery,
    studentsParams,
  );

  // Compute consecutive absent streak for each student
  // Streak = leading run of Absent records ordered by date DESC for this subject
  const streaks: Array<{ studentId: string; consecutiveAbsentCount: number }> =
    [];

  for (const student of studentsResult.rows) {
    const recordsResult = await pool.query<{
      effective_status: string;
    }>(
      `SELECT ar.status AS effective_status
       FROM attendance_records ar
       JOIN timeslots t ON t.id = ar.timeslot_id
       WHERE ar.student_id = $1
         AND ar.tenant_id  = $2
         AND t.subject_id  = $3
       ORDER BY ar.date DESC`,
      [student.id, tenantId, timeslot.subject_id],
    );

    let streak = 0;
    for (const row of recordsResult.rows) {
      if (row.effective_status === "Absent") {
        streak++;
      } else {
        break;
      }
    }
    streaks.push({ studentId: student.id, consecutiveAbsentCount: streak });
  }

  res.status(200).json({
    classId: timeslot.class_id,
    subjectId: timeslot.subject_id,
    streaks,
  });
}

// ═══════════════════════════════════════════════════════════════════
// GET /api/attendance/toppers  (v4.5 CR-34)
// ═══════════════════════════════════════════════════════════════════
// Returns students ranked by overall attendance percentage for a class
// over a date range.
// Admin: any classId in tenant
// Teacher: only classIds where caller has ≥1 non-deleted timeslot → 403
// Student: full ranking returned (can see own position)

export async function getAttendanceToppers(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const callerId = req.userId!;
  const callerRole = req.activeRole!;

  const {
    classId,
    from,
    to,
    limit: limitStr,
    offset: offsetStr,
  } = req.query as {
    classId?: string;
    from?: string;
    to?: string;
    limit?: string;
    offset?: string;
  };

  // Validation
  if (!classId || !from || !to) {
    send400(res, "classId, from, and to are required", "VALIDATION_ERROR");
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    send400(
      res,
      "from and to must be valid dates in YYYY-MM-DD format",
      "VALIDATION_ERROR",
    );
    return;
  }
  if (from > to) {
    send400(res, "'from' must not be after 'to'", "VALIDATION_ERROR");
    return;
  }

  const limit = parseInt(limitStr ?? "10", 10);
  const offset = Math.max(parseInt(offsetStr ?? "0", 10), 0);

  if (isNaN(limit) || limit < 1 || limit > 50) {
    send400(res, "limit must be between 1 and 50", "VALIDATION_ERROR");
    return;
  }

  // Class lookup
  const classResult = await pool.query<{ id: string }>(
    "SELECT id FROM classes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [classId, tenantId],
  );
  if ((classResult.rowCount ?? 0) === 0) {
    send404(res, "Class not found");
    return;
  }

  // CR-40: Teacher ownership check removed — Teacher may call for any classId in tenant.

  // Fetch all active students
  const studentsResult = await pool.query<{
    id: string;
    name: string;
  }>(
    `SELECT id, name FROM students
     WHERE class_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     ORDER BY name ASC`,
    [classId, tenantId],
  );

  const total = studentsResult.rows.length;

  // Compute attendance stats for each student
  const ranked: Array<{
    studentId: string;
    studentName: string;
    totalPeriods: number;
    presentCount: number;
    attendancePercentage: number | null;
  }> = [];

  // Batch query for all students at once for efficiency
  const statsResult = await pool.query<{
    student_id: string;
    total_periods: string;
    present_count: string;
  }>(
    `SELECT
       ar.student_id,
       COUNT(*) AS total_periods,
       COUNT(*) FILTER (
         WHERE ar.status IN ('Present', 'Late')
       ) AS present_count
     FROM attendance_records ar
     JOIN students s ON s.id = ar.student_id
     WHERE s.class_id = $1
       AND ar.tenant_id = $2
       AND ar.date BETWEEN $3 AND $4
       AND ar.student_id = ANY($5::varchar[])
     GROUP BY ar.student_id`,
    [classId, tenantId, from, to, studentsResult.rows.map((s) => s.id)],
  );

  const statsMap = new Map(statsResult.rows.map((r) => [r.student_id, r]));

  for (const student of studentsResult.rows) {
    const stats = statsMap.get(student.id);
    const totalPeriods = parseInt(stats?.total_periods ?? "0", 10);
    const presentCount = parseInt(stats?.present_count ?? "0", 10);
    const attendancePercentage =
      totalPeriods > 0
        ? Math.round((presentCount / totalPeriods) * 10000) / 100
        : null;
    ranked.push({
      studentId: student.id,
      studentName: student.name,
      totalPeriods,
      presentCount,
      attendancePercentage,
    });
  }

  // Sort: attendancePercentage DESC NULLS LAST, studentName ASC
  ranked.sort((a, b) => {
    if (a.attendancePercentage === null && b.attendancePercentage === null)
      return a.studentName.localeCompare(b.studentName);
    if (a.attendancePercentage === null) return 1;
    if (b.attendancePercentage === null) return -1;
    if (b.attendancePercentage !== a.attendancePercentage)
      return b.attendancePercentage - a.attendancePercentage;
    return a.studentName.localeCompare(b.studentName);
  });

  // Assign global ranks (1-based, before pagination)
  const withRanks = ranked.map((s, i) => ({ rank: i + 1, ...s }));

  // Apply pagination
  const page = withRanks.slice(offset, offset + limit);

  res.status(200).json({
    classId,
    from,
    to,
    total,
    limit,
    offset,
    toppers: page,
  });
}

// ═══════════════════════════════════════════════════════════════════
// GET /api/attendance/daily-summary  (v4.5 CR-35)
// ═══════════════════════════════════════════════════════════════════
// Returns per-slot attendance summary for a class on a specific date.
// Feature guard: timetable feature (slot structure, not attendance).
// Admin: any classId in tenant
// Teacher: only classIds where caller has ≥1 non-deleted timeslot → 403
// Student: full slot list, class-level counts (no PII)

export async function getAttendanceDailySummary(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const callerId = req.userId!;
  const callerRole = req.activeRole!;

  const { classId, date } = req.query as {
    classId?: string;
    date?: string;
  };

  if (!classId || !date) {
    send400(res, "classId and date are required", "VALIDATION_ERROR");
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    send400(
      res,
      "date must be a valid date in YYYY-MM-DD format",
      "VALIDATION_ERROR",
    );
    return;
  }

  // Class lookup
  const classResult = await pool.query<{ id: string }>(
    "SELECT id FROM classes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [classId, tenantId],
  );
  if ((classResult.rowCount ?? 0) === 0) {
    send404(res, "Class not found");
    return;
  }

  // CR-40: Teacher ownership check removed — Teacher may call for any classId in tenant.

  // Derive dayOfWeek server-side from the date
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const dateObj = new Date(date + "T00:00:00Z");
  const dayOfWeek = dayNames[dateObj.getUTCDay()];

  // Total active students in class
  const totalStudentsResult = await pool.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM students WHERE class_id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [classId, tenantId],
  );
  const totalStudents = parseInt(totalStudentsResult.rows[0]?.count ?? "0", 10);

  // Fetch timeslots for this class and day
  const slotsResult = await pool.query<{
    id: string;
    period_number: number;
    subject_id: string;
    subject_name: string;
    teacher_id: string;
    teacher_name: string;
  }>(
    `SELECT t.id, t.period_number, t.subject_id,
            s.name AS subject_name,
            t.teacher_id,
            u.name AS teacher_name
     FROM timeslots t
     JOIN subjects s ON s.id = t.subject_id
     JOIN users    u ON u.id = t.teacher_id
     WHERE t.class_id   = $1
       AND t.tenant_id  = $2
       AND t.day_of_week = $3
       AND t.deleted_at IS NULL
     ORDER BY t.period_number ASC`,
    [classId, tenantId, dayOfWeek],
  );

  // For each slot, check if attendance has been marked on this date
  const slots = await Promise.all(
    slotsResult.rows.map(async (slot) => {
      const countResult = await pool.query<{
        record_count: string;
        absent_count: string;
      }>(
        `SELECT
           COUNT(*)                                    AS record_count,
           COUNT(*) FILTER (
             WHERE ar.status = 'Absent'
           ) AS absent_count
         FROM attendance_records ar
         WHERE ar.timeslot_id = $1 AND ar.tenant_id = $2 AND ar.date = $3`,
        [slot.id, tenantId, date],
      );
      const recordCount = parseInt(
        countResult.rows[0]?.record_count ?? "0",
        10,
      );
      const attendanceMarked = recordCount > 0;
      const absentCount = attendanceMarked
        ? parseInt(countResult.rows[0]?.absent_count ?? "0", 10)
        : 0;

      return {
        timeSlotId: slot.id,
        periodNumber: slot.period_number,
        subjectId: slot.subject_id,
        subjectName: slot.subject_name,
        teacherId: slot.teacher_id,
        teacherName: slot.teacher_name,
        attendanceMarked,
        totalStudents,
        absentCount,
      };
    }),
  );

  res.status(200).json({
    classId,
    date,
    dayOfWeek,
    slots,
  });
}

// ═══════════════════════════════════════════════════════════════════
// GET /api/attendance/monthly-sheet  (v4.5 CR-36)
// ═══════════════════════════════════════════════════════════════════
// Returns full student × day × period attendance grid for a class+subject
// for a given month/year.
// Admin: any class+subject in tenant
// Teacher: only where ≥1 non-deleted timeslot matches both classId AND subjectId → 403
// Student: 403 FORBIDDEN (handled by requireRole in routes)

export async function getAttendanceMonthlySheet(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const callerId = req.userId!;
  const callerRole = req.activeRole!;

  const {
    classId,
    subjectId,
    year: yearStr,
    month: monthStr,
  } = req.query as {
    classId?: string;
    subjectId?: string;
    year?: string;
    month?: string;
  };

  if (!classId || !subjectId || !yearStr || !monthStr) {
    send400(
      res,
      "classId, subjectId, year, and month are required",
      "VALIDATION_ERROR",
    );
    return;
  }

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (isNaN(year) || year < 2000 || year > 2099) {
    send400(
      res,
      "year must be an integer between 2000 and 2099",
      "VALIDATION_ERROR",
    );
    return;
  }
  if (isNaN(month) || month < 1 || month > 12) {
    send400(
      res,
      "month must be an integer between 1 and 12",
      "VALIDATION_ERROR",
    );
    return;
  }

  // Class lookup
  const classResult = await pool.query<{ id: string }>(
    "SELECT id FROM classes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [classId, tenantId],
  );
  if ((classResult.rowCount ?? 0) === 0) {
    send404(res, "Class not found");
    return;
  }

  // Subject lookup
  const subjectResult = await pool.query<{ id: string; name: string }>(
    "SELECT id, name FROM subjects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [subjectId, tenantId],
  );
  if ((subjectResult.rowCount ?? 0) === 0) {
    send404(res, "Subject not found");
    return;
  }
  const subjectName = subjectResult.rows[0]!.name;

  // Teacher guard: must have ≥1 non-deleted timeslot for BOTH classId AND subjectId
  if (callerRole === "Teacher") {
    const assignCheck = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM timeslots
         WHERE class_id   = $1
           AND subject_id = $2
           AND teacher_id = $3
           AND tenant_id  = $4
           AND deleted_at IS NULL
       ) AS exists`,
      [classId, subjectId, callerId, tenantId],
    );
    if (!assignCheck.rows[0]?.exists) {
      send403(
        res,
        "You are not assigned to this subject in the specified class",
        "FORBIDDEN",
      );
      return;
    }
  }

  // Compute date range for the month
  const daysInMonth = new Date(year, month, 0).getDate();
  const rangeStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const rangeEnd = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  // Fetch active students for class ordered by name
  const studentsResult = await pool.query<{
    id: string;
    name: string;
    admission_number: string;
  }>(
    `SELECT id, name, admission_number FROM students
     WHERE class_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     ORDER BY name ASC`,
    [classId, tenantId],
  );

  // Fetch all attendance records for these students in the date range for this subject
  const recordsResult = await pool.query<{
    student_id: string;
    record_date: string;
    timeslot_id: string;
    effective_status: string;
  }>(
    `SELECT
       ar.student_id,
       ar.date        AS record_date,
       ar.timeslot_id,
       ar.status AS effective_status
     FROM attendance_records ar
     JOIN timeslots t ON t.id = ar.timeslot_id
     WHERE ar.tenant_id   = $1
       AND ar.student_id  = ANY($2::varchar[])
       AND t.subject_id   = $3
       AND ar.date BETWEEN $4 AND $5
     ORDER BY ar.date ASC, t.period_number ASC`,
    [
      tenantId,
      studentsResult.rows.map((s) => s.id),
      subjectId,
      rangeStart,
      rangeEnd,
    ],
  );

  // Build per-student days map
  type DayEntry = {
    timeSlotId: string;
    status: string;
  };

  const studentDaysMap = new Map<string, Map<number, DayEntry[]>>();
  for (const student of studentsResult.rows) {
    const daysMap = new Map<number, DayEntry[]>();
    for (let d = 1; d <= daysInMonth; d++) {
      daysMap.set(d, []);
    }
    studentDaysMap.set(student.id, daysMap);
  }

  for (const r of recordsResult.rows) {
    const dayNum = parseInt(String(r.record_date).slice(8, 10), 10);
    const daysMap = studentDaysMap.get(r.student_id);
    if (daysMap) {
      const entries = daysMap.get(dayNum) ?? [];
      entries.push({
        timeSlotId: r.timeslot_id,
        status: r.effective_status,
      });
      daysMap.set(dayNum, entries);
    }
  }

  // Build response
  const students = studentsResult.rows.map((student) => {
    const daysMap = studentDaysMap.get(student.id)!;
    const days: Record<string, DayEntry[]> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      days[String(d)] = daysMap.get(d) ?? [];
    }
    return {
      studentId: student.id,
      studentName: student.name,
      admissionNumber: student.admission_number,
      days,
    };
  });

  res.status(200).json({
    classId,
    subjectId,
    subjectName,
    year,
    month,
    daysInMonth,
    students,
  });
}

// ═══════════════════════════════════════════════════════════════════
// GET /api/attendance/absentees  (v4.6 CR-39, auth relaxed CR-41)
// ═══════════════════════════════════════════════════════════════════
// Returns absent student names + streak for a specific timeslot on a date.
// Powers the absentee popup on the dashboard timetable grid.
// Admin: any non-deleted timeslot in tenant
// Teacher: any non-deleted timeslot in tenant (CR-41: ownership check removed)
// Student: 403 FORBIDDEN
// SuperAdmin: 403 FORBIDDEN (handled by requireRole in routes)

export async function getAbsentees(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const callerRole = req.activeRole!;

  // H-03: timeslotId is a path parameter; date remains a query parameter
  const { timeslotId } = req.params as { timeslotId: string };
  const { date } = req.query as { date?: string };

  // ── Validation ─────────────────────────────────────────────────
  if (!timeslotId) {
    send400(res, "timeslotId is required", "VALIDATION_ERROR");
    return;
  }
  if (!date) {
    send400(res, "date is required", "VALIDATION_ERROR");
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    send400(
      res,
      "date must be a valid date in YYYY-MM-DD format",
      "VALIDATION_ERROR",
    );
    return;
  }

  // ── Resolve timeslot ───────────────────────────────────────────
  const tsResult = await pool.query<{
    id: string;
    class_id: string;
    subject_id: string;
  }>(
    `SELECT id, class_id, subject_id
     FROM timeslots
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [timeslotId, tenantId],
  );
  if ((tsResult.rowCount ?? 0) === 0) {
    send404(res, "Timeslot not found");
    return;
  }
  const timeslot = tsResult.rows[0]!;

  // ── Role guard ─────────────────────────────────────────────────
  // CR-41: Teacher may call for any non-deleted timeslot in tenant.
  // Student + SuperAdmin are blocked (SuperAdmin blocked by requireRole; Student blocked here).
  if (callerRole === "Student") {
    send403(res, "Students cannot access absentee details", "FORBIDDEN");
    return;
  }

  // ── Fetch absent records for this timeslot+date ────────────────
  const absentResult = await pool.query<{
    student_id: string;
    student_name: string;
    admission_number: string;
  }>(
    `SELECT ar.student_id,
            s.name           AS student_name,
            s.admission_number
     FROM attendance_records ar
     JOIN students s ON s.id = ar.student_id
     WHERE ar.timeslot_id = $1
       AND ar.date        = $2
       AND ar.tenant_id   = $3
       AND ar.status = 'Absent'
       AND s.deleted_at IS NULL
     ORDER BY s.name ASC`,
    [timeslotId, date, tenantId],
  );

  // ── Compute consecutive absent streak for each absent student ──
  const absentees: Array<{
    studentId: string;
    studentName: string;
    admissionNumber: string;
    consecutiveAbsentCount: number;
  }> = [];

  for (const row of absentResult.rows) {
    const recordsResult = await pool.query<{ effective_status: string }>(
      `SELECT ar.status AS effective_status
       FROM attendance_records ar
       JOIN timeslots t ON t.id = ar.timeslot_id
       WHERE ar.student_id = $1
         AND ar.tenant_id  = $2
         AND t.subject_id  = $3
       ORDER BY ar.date DESC`,
      [row.student_id, tenantId, timeslot.subject_id],
    );

    let streak = 0;
    for (const r of recordsResult.rows) {
      if (r.effective_status === "Absent") {
        streak++;
      } else {
        break;
      }
    }
    // streak is always >= 1 because today is Absent (included in DESC walk)

    absentees.push({
      studentId: row.student_id,
      studentName: row.student_name,
      admissionNumber: row.admission_number,
      consecutiveAbsentCount: streak,
    });
  }

  res.status(200).json({
    timeslotId,
    date,
    classId: timeslot.class_id,
    subjectId: timeslot.subject_id,
    absentees,
  });
}
