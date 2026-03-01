/**
 * Timetable Controller — v3.3
 *
 * GET  /api/timetable               — list timeslots with school_periods JOIN
 * POST /api/timetable               — create timeslot (no startTime/endTime in body)
 * PUT  /api/timetable/:id/end       — set effectiveTo (ends the assignment)
 *
 * v3.3 KEY CHANGE — POST no longer accepts startTime/endTime:
 * Times live in school_periods, joined at read time.
 * POST only validates that periodNumber exists in school_periods for this tenant
 * (PERIOD_NOT_CONFIGURED error if not).
 *
 * TIMETABLE VERSIONING PATTERN:
 * Timeslots are never updated in place. To change a teacher or subject:
 *   1. PUT /:id/end  → sets effectiveTo = today
 *   2. POST /        → creates new timeslot with effectiveFrom = tomorrow
 * This preserves attendance history — every attendance_record links to the
 * exact timeslot that was active when it was recorded.
 *
 * GET JOIN QUERY:
 * Every read JOINs school_periods on (tenant_id, period_number) to populate
 * startTime, endTime, and label. These fields are NOT stored in timeslots.
 */

import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../../db/pool";
import { send400, send404 } from "../../utils/errors";
import { TimeslotRow, DayOfWeek, SchoolPeriodRow } from "../../types";

// Row returned by the timetable JOIN query
interface TimeslotJoinRow extends TimeslotRow {
  class_name: string;
  subject_name: string;
  teacher_name: string;
  sp_label: string;
  sp_start_time: string;
  sp_end_time: string;
}

function trimTime(t: string): string {
  return t.slice(0, 5); // "HH:MM:SS" → "HH:MM"
}

function fmt(row: TimeslotJoinRow) {
  return {
    id: row.id,
    classId: row.class_id,
    className: row.class_name,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    dayOfWeek: row.day_of_week,
    periodNumber: row.period_number,
    label: row.sp_label,
    startTime: trimTime(row.sp_start_time),
    endTime: trimTime(row.sp_end_time),
    effectiveFrom: String(row.effective_from).slice(0, 10),
    effectiveTo: row.effective_to
      ? String(row.effective_to).slice(0, 10)
      : null,
  };
}

// Base JOIN query — reused by GET and POST (after insert + re-fetch)
const TIMETABLE_JOIN = `
  SELECT
    t.id, t.tenant_id, t.class_id, t.subject_id, t.teacher_id,
    t.day_of_week, t.period_number,
    t.effective_from, t.effective_to,
    t.deleted_at, t.created_at, t.updated_at,
    c.name  AS class_name,
    s.name  AS subject_name,
    u.name  AS teacher_name,
    sp.label     AS sp_label,
    sp.start_time AS sp_start_time,
    sp.end_time   AS sp_end_time
  FROM timeslots t
  JOIN classes       c  ON c.id  = t.class_id
  JOIN subjects      s  ON s.id  = t.subject_id
  JOIN users         u  ON u.id  = t.teacher_id
  JOIN school_periods sp
    ON sp.tenant_id = t.tenant_id
   AND sp.period_number = t.period_number
`;

// ═══════════════════════════════════════════════════════════════════
// GET /api/timetable
// ═══════════════════════════════════════════════════════════════════

export async function getTimetable(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { date, dayOfWeek, teacherId, classId, status } = req.query as {
    date?: string;
    dayOfWeek?: string;
    teacherId?: string;
    classId?: string;
    status?: string;
  };

  const conditions = ["t.tenant_id = $1", "t.deleted_at IS NULL"];
  const params: unknown[] = [tenantId];
  let idx = 2;

  // ?status=Active (default) → only non-ended slots
  // ?status=All → include ended slots
  if (!status || status === "Active") {
    conditions.push("t.effective_to IS NULL");
  }

  if (date) {
    // Filter by ISO date: slots effective on this date
    conditions.push(
      `t.effective_from <= $${idx} AND (t.effective_to IS NULL OR t.effective_to >= $${idx})`,
    );
    params.push(date);
    idx++;
  }

  if (dayOfWeek) {
    conditions.push(`t.day_of_week = $${idx++}`);
    params.push(dayOfWeek);
  }
  if (teacherId) {
    conditions.push(`t.teacher_id = $${idx++}`);
    params.push(teacherId);
  }
  if (classId) {
    conditions.push(`t.class_id = $${idx++}`);
    params.push(classId);
  }

  const result = await pool.query<TimeslotJoinRow>(
    `${TIMETABLE_JOIN}
     WHERE ${conditions.join(" AND ")}
     ORDER BY t.day_of_week, t.period_number ASC`,
    params,
  );

  res.status(200).json({ timetable: result.rows.map(fmt) });
}

// ═══════════════════════════════════════════════════════════════════
// POST /api/timetable
// v3.3: No startTime/endTime in body — derived from school_periods
// ═══════════════════════════════════════════════════════════════════

export async function createTimeslot(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const {
    classId,
    subjectId,
    teacherId,
    dayOfWeek,
    periodNumber,
    effectiveFrom,
  } = req.body as {
    classId?: string;
    subjectId?: string;
    teacherId?: string;
    dayOfWeek?: string;
    periodNumber?: unknown;
    effectiveFrom?: string;
  };

  // ── v3.3 BREAKING: Reject removed fields ────────────────────────
  // Freeze §7 Phase 5: "rejects request if startTime/endTime sent in body → 400"
  const body = req.body as Record<string, unknown>;
  if (body.startTime !== undefined || body.endTime !== undefined) {
    send400(
      res,
      "startTime and endTime are no longer accepted. Period times are derived from school_periods configuration.",
      "VALIDATION_ERROR",
    );
    return;
  }

  // ── Validation ────────────────────────────────────────────────────
  if (!classId || !subjectId || !teacherId || !dayOfWeek || !effectiveFrom) {
    send400(
      res,
      "classId, subjectId, teacherId, dayOfWeek, periodNumber, and effectiveFrom are required",
    );
    return;
  }

  const validDays: DayOfWeek[] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  if (!validDays.includes(dayOfWeek as DayOfWeek)) {
    send400(res, `dayOfWeek must be one of: ${validDays.join(", ")}`);
    return;
  }

  const periodNum = Number(periodNumber);
  if (!Number.isInteger(periodNum) || periodNum < 1) {
    send400(res, "periodNumber must be a positive integer");
    return;
  }

  // Basic ISO date format check
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
    send400(res, "effectiveFrom must be a valid date in YYYY-MM-DD format");
    return;
  }

  // ── PERIOD_NOT_CONFIGURED guard (v3.3) ────────────────────────────
  // The periodNumber must exist in school_periods for this tenant.
  // WHY: Without this check, a timeslot with period_number=99 would
  // INSERT fine but the JOIN in GET would return no startTime/endTime.
  const periodCheck = await pool.query<Pick<SchoolPeriodRow, "id">>(
    `SELECT id FROM school_periods
     WHERE tenant_id = $1 AND period_number = $2`,
    [tenantId, periodNum],
  );
  if ((periodCheck.rowCount ?? 0) === 0) {
    res.status(400).json({
      error: {
        code: "PERIOD_NOT_CONFIGURED",
        message: `Period ${periodNum} is not configured for this school`,
        details: { periodNumber: periodNum },
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // ── Verify class belongs to this tenant ───────────────────────────
  const classCheck = await pool.query<{ id: string }>(
    "SELECT id FROM classes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [classId, tenantId],
  );
  if ((classCheck.rowCount ?? 0) === 0) {
    send404(res, "Class not found");
    return;
  }

  // ── Verify subject belongs to this tenant ─────────────────────────
  const subjectCheck = await pool.query<{ id: string }>(
    "SELECT id FROM subjects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [subjectId, tenantId],
  );
  if ((subjectCheck.rowCount ?? 0) === 0) {
    send404(res, "Subject not found");
    return;
  }

  // ── Verify teacher exists and has Teacher role ────────────────────
  // WHY check roles: An Admin-only user could be passed as teacherId.
  // Attendance reports group by teacher, so only actual Teachers belong here.
  const teacherCheck = await pool.query<{ id: string; roles: string[] }>(
    "SELECT id, roles FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [teacherId, tenantId],
  );
  if ((teacherCheck.rowCount ?? 0) === 0) {
    send404(res, "Teacher not found");
    return;
  }
  if (!teacherCheck.rows[0]!.roles.includes("Teacher")) {
    res.status(400).json({
      error: {
        code: "INVALID_TEACHER",
        message: "The specified user does not have the Teacher role",
        details: { teacherId },
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // ── Insert ────────────────────────────────────────────────────────
  const id = `TS-${uuidv4()}`;

  try {
    await pool.query(
      `INSERT INTO timeslots
         (id, tenant_id, class_id, subject_id, teacher_id, day_of_week,
          period_number, effective_from, effective_to, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, NOW(), NOW())`,
      [
        id,
        tenantId,
        classId,
        subjectId,
        teacherId,
        dayOfWeek,
        periodNum,
        effectiveFrom,
      ],
    );
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "23505"
    ) {
      res.status(409).json({
        error: {
          code: "CONFLICT",
          message:
            "This period slot is already occupied for the given class and day",
          details: { classId, dayOfWeek, periodNumber: periodNum },
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    throw err;
  }

  // Re-fetch with JOIN to return full shape (startTime, endTime, label, names)
  const result = await pool.query<TimeslotJoinRow>(
    `${TIMETABLE_JOIN} WHERE t.id = $1`,
    [id],
  );

  res.status(201).json({ timeSlot: fmt(result.rows[0]!) });
}

// ═══════════════════════════════════════════════════════════════════
// PUT /api/timetable/:id/end
// ═══════════════════════════════════════════════════════════════════

export async function endTimeslot(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };
  const { effectiveTo } = req.body as { effectiveTo?: string };

  if (!effectiveTo) {
    send400(res, "effectiveTo is required");
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveTo)) {
    send400(res, "effectiveTo must be a valid date in YYYY-MM-DD format");
    return;
  }

  const existing = await pool.query<{
    id: string;
    effective_to: string | null;
  }>(
    `SELECT id, effective_to FROM timeslots
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  if ((existing.rowCount ?? 0) === 0) {
    send404(res, "Timeslot not found");
    return;
  }
  if (existing.rows[0]!.effective_to !== null) {
    res.status(409).json({
      error: {
        code: "ALREADY_ENDED",
        message: "This timeslot has already been ended",
        details: { effectiveTo: existing.rows[0]!.effective_to },
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  await pool.query(
    `UPDATE timeslots SET effective_to = $1, updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3`,
    [effectiveTo, id, tenantId],
  );

  res.status(200).json({
    timeSlot: { id, effectiveTo },
  });
}
