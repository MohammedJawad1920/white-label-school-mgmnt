/**
 * Attendance Controller
 *
 * POST /api/attendance/record-class        — bulk-record for entire class
 * GET  /api/students/:studentId/attendance — paginated student history
 * GET  /api/attendance/summary             — aggregate by class + date range
 *
 * RECORD-CLASS PATTERN (defaultStatus + exceptions):
 * The teacher picks a defaultStatus (e.g. "Present") then overrides individuals.
 * This is far faster than setting each student individually for a full class.
 * The exceptions Map wins over defaultStatus for any student it contains.
 *
 * IDEMPOTENCY:
 * The DB has UNIQUE(student_id, timeslot_id, date). Re-submitting the same
 * class attendance on the same date is blocked with 409. This prevents accidental
 * double-recording but means the teacher must delete records to re-record
 * (out of scope per Freeze).
 */

import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool, withTransaction } from "../../db/pool";
import { send400, send403, send404, send409 } from "../../utils/errors";
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

  const { timeSlotId, date, defaultStatus, exceptions } = req.body as {
    timeSlotId?: string;
    date?: string;
    defaultStatus?: string;
    exceptions?: Array<{ studentId: string; status: string }>;
  };

  // ── Validation ────────────────────────────────────────────────────
  if (!timeSlotId || !date || !defaultStatus) {
    send400(res, "timeSlotId, date, and defaultStatus are required");
    return;
  }

  const validStatuses: AttendanceStatus[] = ["Present", "Absent", "Late"];
  if (!validStatuses.includes(defaultStatus as AttendanceStatus)) {
    send400(res, `defaultStatus must be one of: ${validStatuses.join(", ")}`);
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    send400(res, "date must be a valid date in YYYY-MM-DD format");
    return;
  }

  // Validate exceptions array
  const exceptionMap = new Map<string, AttendanceStatus>();
  if (Array.isArray(exceptions)) {
    for (const ex of exceptions) {
      if (!ex.studentId || !ex.status) {
        send400(res, "Each exception must have studentId and status");
        return;
      }
      if (!validStatuses.includes(ex.status as AttendanceStatus)) {
        send400(
          res,
          `Exception status must be one of: ${validStatuses.join(", ")}`,
        );
        return;
      }
      exceptionMap.set(ex.studentId, ex.status as AttendanceStatus);
    }
  }

  // ── Verify timeslot exists and is active ──────────────────────────
  const tsResult = await pool.query<
    TimeslotRow & { class_name: string; subject_name: string }
  >(
    `SELECT t.id, t.tenant_id, t.class_id, t.subject_id, t.teacher_id,
            t.day_of_week, t.period_number, t.effective_from, t.effective_to,
            t.deleted_at, t.created_at, t.updated_at,
            c.name AS class_name, s.name AS subject_name
     FROM timeslots t
     JOIN classes  c ON c.id = t.class_id
     JOIN subjects s ON s.id = t.subject_id
     WHERE t.id = $1 AND t.tenant_id = $2 AND t.deleted_at IS NULL`,
    [timeSlotId, tenantId],
  );

  if ((tsResult.rowCount ?? 0) === 0) {
    send404(res, "Timeslot not found");
    return;
  }

  const timeslot = tsResult.rows[0]!;

  if (timeslot.effective_to !== null) {
    res.status(400).json({
      error: {
        code: "TIMESLOT_ENDED",
        message: "Cannot record attendance for an ended timeslot",
        details: { effectiveTo: timeslot.effective_to },
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // ── Fetch students in this class ──────────────────────────────────
  const studentsResult = await pool.query<Pick<StudentRow, "id">>(
    `SELECT id FROM students
     WHERE class_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     ORDER BY id`,
    [timeslot.class_id, tenantId],
  );

  if (studentsResult.rows.length === 0) {
    res.status(400).json({
      error: {
        code: "NO_STUDENTS",
        message: "No students found in this class",
        details: { classId: timeslot.class_id },
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // ── Insert attendance records in a transaction ────────────────────
  // WHY transaction: partial inserts (some succeed, some fail due to UNIQUE)
  // leave the data in an inconsistent state. All-or-nothing is correct here.
  const counters = { present: 0, absent: 0, late: 0 };

  try {
    await withTransaction(async (client) => {
      for (const student of studentsResult.rows) {
        const status =
          exceptionMap.get(student.id) ?? (defaultStatus as AttendanceStatus);
        const id = `AR-${uuidv4()}`;

        await client.query(
          `INSERT INTO attendance_records
             (id, tenant_id, student_id, timeslot_id, date, status, recorded_by, recorded_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [id, tenantId, student.id, timeSlotId, date, status, recordedBy],
        );

        counters[status.toLowerCase() as "present" | "absent" | "late"]++;
      }
    });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "23505"
    ) {
      res.status(409).json({
        error: {
          code: "ATTENDANCE_ALREADY_RECORDED",
          message:
            "Attendance has already been recorded for this class on this date",
          details: { timeSlotId, date },
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }
    throw err;
  }

  res.status(201).json({
    recorded: studentsResult.rows.length,
    present: counters.present,
    absent: counters.absent,
    late: counters.late,
    date,
    timeSlot: {
      id: timeSlotId,
      className: timeslot.class_name,
      subjectName: timeslot.subject_name,
      periodNumber: timeslot.period_number,
    },
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
    corrected_status: AttendanceStatus | null;
    corrected_by: string | null;
    corrected_at: Date | null;
    recorded_by: string;
    recorded_at: Date;
    ts_id: string;
    subject_name: string;
    period_number: number;
    day_of_week: string;
  }>(
    `SELECT
       ar.id, ar.date, ar.status,
       ar.corrected_status, ar.corrected_by, ar.corrected_at,
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
  }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE COALESCE(ar.corrected_status, ar.status) = 'Present') AS present,
       COUNT(*) FILTER (WHERE COALESCE(ar.corrected_status, ar.status) = 'Absent')  AS absent,
       COUNT(*) FILTER (WHERE COALESCE(ar.corrected_status, ar.status) = 'Late')    AS late
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
      // v3.4 CR-09: effective status = corrected_status ?? original status
      status: r.corrected_status ?? r.status,
      originalStatus: r.status,
      correctedBy: r.corrected_by ?? null,
      correctedAt: r.corrected_at?.toISOString() ?? null,
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
// GET /api/attendance/summary
// ═══════════════════════════════════════════════════════════════════

export async function getAttendanceSummary(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { classId, from, to } = req.query as {
    classId?: string;
    from?: string;
    to?: string;
  };

  if (!from || !to) {
    send400(res, "from and to date parameters are required");
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    send400(res, "from and to must be valid dates in YYYY-MM-DD format");
    return;
  }
  if (from > to) {
    send400(res, "from must be on or before to");
    return;
  }

  // Optional class filter — verify it belongs to this tenant
  let classRow: { id: string; name: string } | null = null;
  if (classId) {
    const classResult = await pool.query<{ id: string; name: string }>(
      "SELECT id, name FROM classes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [classId, tenantId],
    );
    if ((classResult.rowCount ?? 0) === 0) {
      send404(res, "Class not found");
      return;
    }
    classRow = classResult.rows[0]!;
  }

  // Count students in class (or all tenant students if no classId)
  const studentCountResult = await pool.query<{ count: string }>(
    classId
      ? "SELECT COUNT(*) as count FROM students WHERE class_id = $1 AND tenant_id = $2 AND deleted_at IS NULL"
      : "SELECT COUNT(*) as count FROM students WHERE tenant_id = $1 AND deleted_at IS NULL",
    classId ? [classId, tenantId] : [tenantId],
  );
  const studentCount = parseInt(studentCountResult.rows[0]?.count ?? "0", 10);

  // Build summary query conditions
  const conditions = ["ar.tenant_id = $1", "ar.date >= $2", "ar.date <= $3"];
  const params: unknown[] = [tenantId, from, to];

  if (classId) {
    // Join through timeslots to filter by class
    conditions.push("ts.class_id = $4");
    params.push(classId);
  }

  const joinClause = classId
    ? "JOIN timeslots ts ON ts.id = ar.timeslot_id"
    : "";

  const summaryResult = await pool.query<{
    total: string;
    present: string;
    absent: string;
    late: string;
  }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE COALESCE(ar.corrected_status, ar.status) = 'Present') AS present,
       COUNT(*) FILTER (WHERE COALESCE(ar.corrected_status, ar.status) = 'Absent')  AS absent,
       COUNT(*) FILTER (WHERE COALESCE(ar.corrected_status, ar.status) = 'Late')    AS late
     FROM attendance_records ar
     ${joinClause}
     WHERE ${conditions.join(" AND ")}`,
    params,
  );

  const agg = summaryResult.rows[0]!;
  const totalRecs = parseInt(agg.total, 10);
  const presentCnt = parseInt(agg.present, 10);
  const attendanceRate =
    totalRecs > 0 ? Math.round((presentCnt / totalRecs) * 10000) / 100 : 0;

  // Per-student breakdown
  const byStudentResult = await pool.query<{
    student_id: string;
    student_name: string;
    present: string;
    absent: string;
    late: string;
  }>(
    `SELECT
       ar.student_id,
       stu.name AS student_name,
       COUNT(*) FILTER (WHERE COALESCE(ar.corrected_status, ar.status) = 'Present') AS present,
       COUNT(*) FILTER (WHERE COALESCE(ar.corrected_status, ar.status) = 'Absent')  AS absent,
       COUNT(*) FILTER (WHERE COALESCE(ar.corrected_status, ar.status) = 'Late')    AS late
     FROM attendance_records ar
     ${joinClause}
     JOIN students stu ON stu.id = ar.student_id
     WHERE ${conditions.join(" AND ")}
     GROUP BY ar.student_id, stu.name
     ORDER BY stu.name ASC`,
    params,
  );

  // Distinct days in range (calendar days, not just days with records)
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const days =
    Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;

  res.status(200).json({
    class: classRow
      ? { id: classRow.id, name: classRow.name, studentCount }
      : { id: null, name: "All Classes", studentCount },
    period: { from, to, days },
    summary: {
      totalRecords: totalRecs,
      present: presentCnt,
      absent: parseInt(agg.absent, 10),
      late: parseInt(agg.late, 10),
      attendanceRate,
    },
    byStudent: byStudentResult.rows.map((r) => {
      const p = parseInt(r.present, 10);
      const total = p + parseInt(r.absent, 10) + parseInt(r.late, 10);
      return {
        studentId: r.student_id,
        studentName: r.student_name,
        present: p,
        absent: parseInt(r.absent, 10),
        late: parseInt(r.late, 10),
        attendanceRate: total > 0 ? Math.round((p / total) * 10000) / 100 : 0,
      };
    }),
  });
}

// ═══════════════════════════════════════════════════════════════════
// PUT /api/attendance/:recordId   (v3.4 CR-09)
// ═══════════════════════════════════════════════════════════════════
// Teacher (own class) or Admin can correct an attendance status.
// Writes to corrected_status/corrected_by/corrected_at; original status
// (status column) is immutable after insert (Freeze §3.4 invariant).

export async function correctAttendance(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const callerId = req.userId!;
  const { recordId } = req.params as { recordId: string };
  const { status } = req.body as { status?: string };

  const validStatuses: AttendanceStatus[] = ["Present", "Absent", "Late"];
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
            ar.status, ar.corrected_status, ar.corrected_by, ar.corrected_at,
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
  // Cannot correct an attendance record for a future date.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const recordDate = new Date(record.record_date);
  recordDate.setHours(0, 0, 0, 0);
  if (recordDate > today) {
    send400(res, "Cannot correct attendance for a future date", "FUTURE_DATE");
    return;
  }

  // ── SAME_STATUS guard ─────────────────────────────────────────────
  const effectiveStatus = record.corrected_status ?? record.status;
  if (status === effectiveStatus) {
    send409(res, "Status is already set to that value", "SAME_STATUS");
    return;
  }

  // ── Teacher own-class access check ───────────────────────────────
  // Teachers may only correct attendance for timeslots they own.
  // Admins have no such restriction.
  const callerRoles = req.userRoles ?? [];
  if (callerRoles.includes("Teacher") && !callerRoles.includes("Admin")) {
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
     SET corrected_status = $1, corrected_by = $2, corrected_at = NOW()
     WHERE id = $3 AND tenant_id = $4
     RETURNING id, tenant_id, student_id, timeslot_id,
               date AS record_date,
               status, corrected_status, corrected_by, corrected_at,
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
      status: r.corrected_status ?? r.status, // effective
      originalStatus: r.status,
      correctedBy: r.corrected_by ?? null,
      correctedAt: r.corrected_at?.toISOString() ?? null,
      recordedBy: r.recorded_by,
      recordedAt:
        r.recorded_at instanceof Date
          ? r.recorded_at.toISOString()
          : String(r.recorded_at),
    },
  });
}
