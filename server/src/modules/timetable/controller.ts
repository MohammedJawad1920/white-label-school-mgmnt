/**
 * Timetable Controller — v4.4
 *
 * GET    /api/timetable     — list non-deleted timeslots (JOIN school_periods)
 * POST   /api/timetable     — create timeslot
 * DELETE /api/timetable/:id — soft-delete timeslot (CR-31)
 *
 * v4.3 KEY CHANGES (CR-31):
 * - effectiveFrom/effectiveTo removed from all schemas and flows
 * - PUT /:id/end REMOVED entirely
 * - DELETE /:id — soft-delete (deletedat = NOW())
 * - GET: date and status query params removed; returns all non-deleted slots
 * - POST: effectiveFrom no longer required or accepted
 * - Teacher auth for attendance: deletedat IS NULL only (no effectiveto check)
 *
 * v4.4 KEY CHANGE (CR-32):
 * - PUT /:id REMOVED entirely; correction workflow is DELETE + POST
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
    endTime: row.sp_end_time ? trimTime(row.sp_end_time) : null,
  };
}

// Base JOIN query — reused by GET, POST (after insert + re-fetch), and PUT
const TIMETABLE_JOIN = `
  SELECT
    t.id, t.tenant_id, t.class_id, t.subject_id, t.teacher_id,
    t.day_of_week, t.period_number,
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
// v4.3: date + status params removed; returns all non-deleted slots
// ═══════════════════════════════════════════════════════════════════

export async function getTimetable(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { dayOfWeek, teacherId, classId } = req.query as {
    dayOfWeek?: string;
    teacherId?: string;
    classId?: string;
  };

  const conditions = ["t.tenant_id = $1", "t.deleted_at IS NULL"];
  const params: unknown[] = [tenantId];
  let idx = 2;

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
// v4.3: effectiveFrom removed — no date-range tracking
// ═══════════════════════════════════════════════════════════════════

export async function createTimeslot(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { classId, subjectId, teacherId, dayOfWeek, periodNumber } =
    req.body as {
      classId?: string;
      subjectId?: string;
      teacherId?: string;
      dayOfWeek?: string;
      periodNumber?: unknown;
    };

  // ── Validation ────────────────────────────────────────────────────
  if (!classId || !subjectId || !teacherId || !dayOfWeek) {
    send400(
      res,
      "classId, subjectId, teacherId, dayOfWeek, and periodNumber are required",
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

  // ── PERIOD_NOT_CONFIGURED guard ────────────────────────────────────
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
        timestamp: new Date().toISOString(),
      },
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
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // ── Insert ────────────────────────────────────────────────────────
  const id = uuidv4();

  try {
    await pool.query(
      `INSERT INTO timeslots
         (id, tenant_id, class_id, subject_id, teacher_id, day_of_week,
          period_number, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [id, tenantId, classId, subjectId, teacherId, dayOfWeek, periodNum],
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
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }
    throw err;
  }

  // Re-fetch with JOIN to return full shape
  const result = await pool.query<TimeslotJoinRow>(
    `${TIMETABLE_JOIN} WHERE t.id = $1`,
    [id],
  );

  res.status(201).json({ timeSlot: fmt(result.rows[0]!) });
}

// ═══════════════════════════════════════════════════════════════════
// DELETE /api/timetable/:id   (CR-31)
// Soft-delete a timeslot (sets deleted_at = NOW()).
// ═══════════════════════════════════════════════════════════════════

export async function deleteTimeslot(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };

  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM timeslots WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  if ((existing.rowCount ?? 0) === 0) {
    send404(res, "Timeslot not found");
    return;
  }

  await pool.query(
    `UPDATE timeslots SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId],
  );

  res.status(204).send();
}
