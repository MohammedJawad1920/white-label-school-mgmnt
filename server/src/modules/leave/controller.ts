/**
 * Leave Management Controller (v5.0)
 *
 * State machine:
 *   PENDING  → APPROVED   (approveLeave)
 *   PENDING  → REJECTED   (rejectLeave)
 *   PENDING  → CANCELLED  (cancelLeave)
 *   APPROVED → ACTIVE     (departLeave)
 *   ACTIVE / OVERDUE → COMPLETED (returnLeave)
 *
 * Routes (all tenant-scoped):
 *   POST   /leave                 — submit leave request (Guardian/Teacher/Admin)
 *   GET    /leave                 — list leave requests (Teacher/Admin/Guardian)
 *   GET    /leave/on-campus       — students currently off-campus (Teacher/Admin)
 *   GET    /leave/:id             — get single leave request
 *   PUT    /leave/:id/approve     — approve (Teacher/Admin)
 *   PUT    /leave/:id/reject      — reject  (Teacher/Admin)
 *   PUT    /leave/:id/cancel      — cancel  (Guardian/Admin)
 *   PUT    /leave/:id/depart      — mark student departed (Teacher/Admin)
 *   PUT    /leave/:id/return      — mark student returned (Teacher/Admin)
 */

import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../../db/pool";
import { send400, send403, send404, send409 } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { LeaveRequestRow, ApiLeaveRequest } from "../../types";
import { sendPushToUser } from "../../services/push.service";
import type { PoolClient } from "pg";

// ─── Constants ───────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_LEAVE_TYPES = [
  "HomeVisit",
  "Medical",
  "Emergency",
  "ExternalExam",
  "OfficialDuty",
  "Personal",
] as const;
const VALID_DURATION_TYPES = [
  "HalfDayAM",
  "HalfDayPM",
  "FullDay",
  "MultiDay",
] as const;

// ─── Local Row Types ──────────────────────────────────────────────────────────

interface LeaveRowWithStudent extends LeaveRequestRow {
  student_name: string;
}

interface LeaveListRow extends LeaveRowWithStudent {
  total_count: string;
}

interface LeaveRowWithStudentClass extends LeaveRequestRow {
  student_class_id: string | null;
}

interface LeaveGetRow extends LeaveRowWithStudent {
  student_class_id: string | null;
}

interface OnCampusRow {
  id: string;
  student_id: string;
  student_name: string;
  admission_number: string;
  class_name: string | null;
  status: string;
  departed_at: Date | null;
  expected_return_at: Date;
}

// ─── Formatter ───────────────────────────────────────────────────────────────

function fmtLeave(r: LeaveRowWithStudent): ApiLeaveRequest {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    sessionId: r.session_id,
    studentId: r.student_id,
    studentName: r.student_name,
    requestedByUserId: r.requested_by_user_id,
    requestedByRole: r.requested_by_role,
    leaveType: r.leave_type,
    durationType: r.duration_type,
    startDate: String(r.start_date).slice(0, 10),
    endDate: String(r.end_date).slice(0, 10),
    reason: r.reason,
    attachmentUrl: r.attachment_url,
    status: r.status,
    reviewedBy: r.reviewed_by,
    reviewedAt:
      r.reviewed_at instanceof Date
        ? r.reviewed_at.toISOString()
        : r.reviewed_at
          ? String(r.reviewed_at)
          : null,
    rejectionReason: r.rejection_reason,
    departedAt:
      r.departed_at instanceof Date
        ? r.departed_at.toISOString()
        : r.departed_at
          ? String(r.departed_at)
          : null,
    expectedReturnAt:
      r.expected_return_at instanceof Date
        ? r.expected_return_at.toISOString()
        : String(r.expected_return_at),
    returnedAt:
      r.returned_at instanceof Date
        ? r.returned_at.toISOString()
        : r.returned_at
          ? String(r.returned_at)
          : null,
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start);
  const e = new Date(end);
  while (d <= e) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

async function refetchLeave(
  id: string,
  tenantId: string,
): Promise<LeaveRowWithStudent | undefined> {
  const { rows } = await pool.query<LeaveRowWithStudent>(
    `SELECT lr.*, s.name AS student_name
     FROM leave_requests lr
     JOIN students s ON s.id = lr.student_id
     WHERE lr.id = $1 AND lr.tenant_id = $2`,
    [id, tenantId],
  );
  return rows[0];
}

// ─── Private: Push Notifications ─────────────────────────────────────────────

async function sendPushNotificationsForLeaveApproval(
  studentId: string,
  tenantId: string,
  _reviewerId: string,
): Promise<void> {
  try {
    const {
      rows: [student],
    } = await pool.query<{ user_id: string | null }>(
      "SELECT user_id FROM students WHERE id = $1",
      [studentId],
    );
    if (student?.user_id) {
      await sendPushToUser(student.user_id, tenantId, {
        type: "LEAVE_APPROVED",
        title: "Leave Approved",
        body: "Your leave request has been approved.",
        route: "/student/attendance",
      });
    }

    const { rows: guardians } = await pool.query<{ user_id: string }>(
      `SELECT g.user_id
       FROM guardians g
       JOIN student_guardians sg ON sg.guardian_id = g.id
       WHERE sg.student_id = $1
         AND g.user_id IS NOT NULL
         AND g.deleted_at IS NULL`,
      [studentId],
    );
    for (const g of guardians) {
      await sendPushToUser(g.user_id, tenantId, {
        type: "LEAVE_APPROVED",
        title: "Leave Approved",
        body: "Your child's leave request has been approved.",
        route: "/guardian/leave",
      });
    }
  } catch (err) {
    logger.error({ err }, "Push notification failed for leave approval");
  }
}

async function sendPushNotificationsForLeaveRejection(
  studentId: string,
  tenantId: string,
): Promise<void> {
  try {
    const {
      rows: [student],
    } = await pool.query<{ user_id: string | null }>(
      "SELECT user_id FROM students WHERE id = $1",
      [studentId],
    );
    if (student?.user_id) {
      await sendPushToUser(student.user_id, tenantId, {
        type: "LEAVE_REJECTED",
        title: "Leave Rejected",
        body: "Your leave request has been rejected.",
        route: "/student/attendance",
      });
    }

    const { rows: guardians } = await pool.query<{ user_id: string }>(
      `SELECT g.user_id
       FROM guardians g
       JOIN student_guardians sg ON sg.guardian_id = g.id
       WHERE sg.student_id = $1
         AND g.user_id IS NOT NULL
         AND g.deleted_at IS NULL`,
      [studentId],
    );
    for (const g of guardians) {
      await sendPushToUser(g.user_id, tenantId, {
        type: "LEAVE_REJECTED",
        title: "Leave Rejected",
        body: "Your child's leave request has been rejected.",
        route: "/guardian/leave",
      });
    }
  } catch (err) {
    logger.error({ err }, "Push notification failed for leave rejection");
  }
}

// ─── POST /leave ──────────────────────────────────────────────────────────────

export async function submitLeave(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const activeRole = req.activeRole!;

  const {
    studentId,
    leaveType,
    durationType,
    startDate,
    endDate,
    reason,
    expectedReturnAt,
  } = req.body as {
    studentId?: string;
    leaveType?: string;
    durationType?: string;
    startDate?: string;
    endDate?: string;
    reason?: string;
    expectedReturnAt?: string;
  };

  // ── Validation ────────────────────────────────────────────────────────────

  if (!studentId || typeof studentId !== "string" || studentId.trim() === "") {
    send400(res, "studentId is required");
    return;
  }

  if (
    !leaveType ||
    !(VALID_LEAVE_TYPES as readonly string[]).includes(leaveType)
  ) {
    send400(res, `leaveType must be one of: ${VALID_LEAVE_TYPES.join(", ")}`);
    return;
  }

  if (
    !durationType ||
    !(VALID_DURATION_TYPES as readonly string[]).includes(durationType)
  ) {
    send400(
      res,
      `durationType must be one of: ${VALID_DURATION_TYPES.join(", ")}`,
    );
    return;
  }

  if (!startDate || !DATE_RE.test(startDate)) {
    send400(res, "startDate is required (YYYY-MM-DD)");
    return;
  }

  if (!endDate || !DATE_RE.test(endDate)) {
    send400(res, "endDate is required (YYYY-MM-DD)");
    return;
  }

  if (endDate < startDate) {
    send400(res, "endDate must be on or after startDate");
    return;
  }

  if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
    send400(res, "reason must be at least 10 characters");
    return;
  }

  if (!expectedReturnAt || isNaN(Date.parse(expectedReturnAt))) {
    send400(res, "expectedReturnAt must be a valid ISO date string");
    return;
  }

  // ── Guardian permission check ─────────────────────────────────────────────

  if (activeRole === "Guardian") {
    const guardianCheck = await pool.query<{ can_submit_leave: boolean }>(
      `SELECT g.can_submit_leave
       FROM guardians g
       JOIN student_guardians sg ON sg.guardian_id = g.id
       WHERE sg.student_id = $1
         AND g.user_id = $2
         AND g.tenant_id = $3
         AND g.deleted_at IS NULL`,
      [studentId, userId, tenantId],
    );

    if (guardianCheck.rows.length === 0) {
      send400(res, "Guardian is not linked to this student");
      return;
    }

    if (guardianCheck.rows[0]!.can_submit_leave === false) {
      send400(
        res,
        "Guardian is not authorized to submit leave",
        "LEAVE_SUBMISSION_NOT_ALLOWED",
      );
      return;
    }
  }

  // ── Verify student exists ─────────────────────────────────────────────────

  const studentCheck = await pool.query<{ id: string }>(
    "SELECT id FROM students WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [studentId, tenantId],
  );
  if (!studentCheck.rows[0]) {
    send404(res, "Student not found");
    return;
  }

  // ── Get active session ────────────────────────────────────────────────────

  const sessionCheck = await pool.query<{ id: string }>(
    `SELECT id FROM academic_sessions
     WHERE tenant_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
     LIMIT 1`,
    [tenantId],
  );
  if (!sessionCheck.rows[0]) {
    send400(res, "No active academic session");
    return;
  }
  const sessionId = sessionCheck.rows[0].id;

  // ── Determine requestedByRole ─────────────────────────────────────────────

  const requestedByRole =
    activeRole === "Guardian"
      ? "Guardian"
      : activeRole === "Admin"
        ? "Admin"
        : "ClassTeacher";

  // ── Insert leave request ──────────────────────────────────────────────────

  const id = uuidv4();
  await pool.query(
    `INSERT INTO leave_requests (
       id, tenant_id, session_id, student_id, requested_by_user_id,
       requested_by_role, leave_type, duration_type, start_date, end_date,
       reason, status, expected_return_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING', $12)`,
    [
      id,
      tenantId,
      sessionId,
      studentId,
      userId,
      requestedByRole,
      leaveType,
      durationType,
      startDate,
      endDate,
      reason.trim(),
      expectedReturnAt,
    ],
  );

  const newLeave = await refetchLeave(id, tenantId);

  res.status(201).json({ data: newLeave ? fmtLeave(newLeave) : null });
}

// ─── GET /leave ───────────────────────────────────────────────────────────────

export async function listLeave(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const activeRole = req.activeRole!;
  const userId = req.userId!;
  const classTeacherOf = req.classTeacherOf ?? null;

  const {
    classId,
    studentId,
    status,
    startDate,
    endDate,
    limit = "20",
    offset = "0",
  } = req.query as {
    classId?: string;
    studentId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    limit?: string;
    offset?: string;
  };

  const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
  const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

  const params: (string | number)[] = [tenantId];
  let paramCount = 1;

  let sql = `
    SELECT lr.*, s.name AS student_name, COUNT(*) OVER() AS total_count
    FROM leave_requests lr
    JOIN students s ON s.id = lr.student_id
    WHERE lr.tenant_id = $1`;

  // ── Role-based scoping ────────────────────────────────────────────────────

  if (activeRole === "Guardian") {
    paramCount++;
    sql += `
      AND EXISTS (
        SELECT 1
        FROM student_guardians sg
        JOIN guardians g ON g.id = sg.guardian_id
        WHERE sg.student_id = lr.student_id
          AND g.user_id = $${paramCount}
          AND g.tenant_id = $1
      )`;
    params.push(userId);
  } else if (classTeacherOf !== null && activeRole !== "Admin") {
    paramCount++;
    sql += ` AND s.class_id = $${paramCount}`;
    params.push(classTeacherOf);
  }

  // ── Optional filters ──────────────────────────────────────────────────────

  if (classId) {
    paramCount++;
    sql += ` AND s.class_id = $${paramCount}`;
    params.push(classId);
  }

  if (studentId) {
    paramCount++;
    sql += ` AND lr.student_id = $${paramCount}`;
    params.push(studentId);
  }

  if (status) {
    paramCount++;
    sql += ` AND lr.status = $${paramCount}`;
    params.push(status);
  }

  if (startDate && DATE_RE.test(startDate)) {
    paramCount++;
    sql += ` AND lr.start_date >= $${paramCount}`;
    params.push(startDate);
  }

  if (endDate && DATE_RE.test(endDate)) {
    paramCount++;
    sql += ` AND lr.end_date <= $${paramCount}`;
    params.push(endDate);
  }

  paramCount++;
  sql += ` ORDER BY lr.created_at DESC LIMIT $${paramCount}`;
  params.push(limitNum);

  paramCount++;
  sql += ` OFFSET $${paramCount}`;
  params.push(offsetNum);

  const { rows } = await pool.query<LeaveListRow>(sql, params);

  res.json({
    data: rows.map(fmtLeave),
    total: rows[0] ? parseInt(rows[0].total_count, 10) : 0,
  });
}

// ─── GET /leave/:id ───────────────────────────────────────────────────────────

export async function getLeave(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const activeRole = req.activeRole!;
  const classTeacherOf = req.classTeacherOf ?? null;
  const id = req.params.id as string;

  const { rows } = await pool.query<LeaveGetRow>(
    `SELECT lr.*, s.name AS student_name, s.class_id AS student_class_id
     FROM leave_requests lr
     JOIN students s ON s.id = lr.student_id
     WHERE lr.id = $1 AND lr.tenant_id = $2`,
    [id, tenantId],
  );
  const row = rows[0];

  if (!row) {
    send404(res, "Leave request not found");
    return;
  }

  // ── Guardian access check ─────────────────────────────────────────────────

  if (activeRole === "Guardian") {
    const guardianCheck = await pool.query(
      `SELECT 1
       FROM student_guardians sg
       JOIN guardians g ON g.id = sg.guardian_id
       WHERE sg.student_id = $1 AND g.user_id = $2`,
      [row.student_id, userId],
    );
    if (!guardianCheck.rows[0]) {
      send403(res, "Access denied");
      return;
    }
  }

  // ── Teacher (class-teacher) access check ──────────────────────────────────

  if (activeRole === "Teacher") {
    if (classTeacherOf !== row.student_class_id) {
      send403(res, "Access denied");
      return;
    }
  }

  res.json({ data: fmtLeave(row) });
}

// ─── PUT /leave/:id/approve ───────────────────────────────────────────────────

export async function approveLeave(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const activeRole = req.activeRole!;
  const classTeacherOf = req.classTeacherOf ?? null;
  const id = req.params.id as string;

  // Suppress unused-variable lint for PoolClient – used implicitly via pool.connect()
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    // SELECT FOR UPDATE prevents concurrent approval/rejection of the same request
    const { rows } = await client.query<LeaveRowWithStudentClass>(
      `SELECT lr.*, s.class_id AS student_class_id
       FROM leave_requests lr
       JOIN students s ON s.id = lr.student_id
       WHERE lr.id = $1 AND lr.tenant_id = $2
       FOR UPDATE`,
      [id, tenantId],
    );
    const row = rows[0];

    if (!row) {
      await client.query("ROLLBACK");
      send404(res, "Leave request not found");
      return;
    }

    if (row.status !== "PENDING") {
      await client.query("ROLLBACK");
      send409(
        res,
        "Leave request has already been reviewed",
        "LEAVE_ALREADY_REVIEWED",
      );
      return;
    }

    // Class-teacher scope check
    if (classTeacherOf !== null && activeRole !== "Admin") {
      if (classTeacherOf !== row.student_class_id) {
        await client.query("ROLLBACK");
        send403(res, "Access denied");
        return;
      }
    }

    // 1. Approve the leave request
    await client.query(
      `UPDATE leave_requests
       SET status = 'APPROVED',
           reviewed_by = $1,
           reviewed_at = NOW(),
           updated_at  = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      [userId, id, tenantId],
    );

    // 2. Fetch the student's class timeslots
    const { rows: timeslots } = await client.query<{ id: string }>(
      `SELECT t.id
       FROM timeslots t
       WHERE t.class_id = $1 AND t.tenant_id = $2 AND t.deleted_at IS NULL`,
      [row.student_class_id, tenantId],
    );

    // 3. UPSERT attendance records as Excused for every timeslot on every leave date
    //    Only overwrite statuses that are not already Present.
    const dates = getDatesInRange(
      String(row.start_date).slice(0, 10),
      String(row.end_date).slice(0, 10),
    );

    for (const date of dates) {
      for (const timeslot of timeslots) {
        const recordId = uuidv4();
        await client.query(
          `INSERT INTO attendance_records
             (id, tenant_id, student_id, timeslot_id, date, status, recorded_by, recorded_at)
           VALUES ($1, $2, $3, $4, $5, 'Excused', $6, NOW())
           ON CONFLICT (student_id, timeslot_id, date) DO UPDATE
             SET status     = 'Excused',
                 updated_by = $6,
                 updated_at = NOW()
           WHERE attendance_records.status NOT IN ('Present')`,
          [recordId, tenantId, row.student_id, timeslot.id, date, userId],
        );
      }
    }

    // 4. Mark exam results as absent for exams that fall within the leave period
    const startDateStr = String(row.start_date).slice(0, 10);
    const endDateStr = String(row.end_date).slice(0, 10);
    await client.query(
      `UPDATE exam_results er
       SET is_absent = true
       FROM exam_subjects es
       WHERE er.exam_subject_id = es.id
         AND er.student_id      = $1
         AND er.tenant_id       = $2
         AND es.exam_date BETWEEN $3 AND $4`,
      [row.student_id, tenantId, startDateStr, endDateStr],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Re-fetch updated row for response
  const updated = await refetchLeave(id, tenantId);

  // Fire-and-forget push notifications
  if (updated) {
    void sendPushNotificationsForLeaveApproval(
      updated.student_id,
      tenantId,
      userId,
    );
  }

  res.json({ data: updated ? fmtLeave(updated) : null });
}

// ─── PUT /leave/:id/reject ────────────────────────────────────────────────────

export async function rejectLeave(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const activeRole = req.activeRole!;
  const classTeacherOf = req.classTeacherOf ?? null;
  const id = req.params.id as string;

  const { rejectionReason } = req.body as { rejectionReason?: string };

  if (
    !rejectionReason ||
    typeof rejectionReason !== "string" ||
    rejectionReason.trim().length === 0
  ) {
    send400(res, "rejectionReason is required");
    return;
  }

  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query<LeaveRowWithStudentClass>(
      `SELECT lr.*, s.class_id AS student_class_id
       FROM leave_requests lr
       JOIN students s ON s.id = lr.student_id
       WHERE lr.id = $1 AND lr.tenant_id = $2
       FOR UPDATE`,
      [id, tenantId],
    );
    const row = rows[0];

    if (!row) {
      await client.query("ROLLBACK");
      send404(res, "Leave request not found");
      return;
    }

    if (row.status !== "PENDING") {
      await client.query("ROLLBACK");
      send409(
        res,
        "Leave request has already been reviewed",
        "LEAVE_ALREADY_REVIEWED",
      );
      return;
    }

    // Class-teacher scope check
    if (classTeacherOf !== null && activeRole !== "Admin") {
      if (classTeacherOf !== row.student_class_id) {
        await client.query("ROLLBACK");
        send403(res, "Access denied");
        return;
      }
    }

    await client.query(
      `UPDATE leave_requests
       SET status           = 'REJECTED',
           rejection_reason = $1,
           reviewed_by      = $2,
           reviewed_at      = NOW(),
           updated_at       = NOW()
       WHERE id = $3 AND tenant_id = $4`,
      [rejectionReason.trim(), userId, id, tenantId],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const updated = await refetchLeave(id, tenantId);

  if (updated) {
    void sendPushNotificationsForLeaveRejection(updated.student_id, tenantId);
  }

  res.json({ data: updated ? fmtLeave(updated) : null });
}

// ─── PUT /leave/:id/cancel ────────────────────────────────────────────────────

export async function cancelLeave(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const activeRole = req.activeRole!;
  const id = req.params.id as string;

  const { rows } = await pool.query<LeaveGetRow>(
    `SELECT lr.*, s.name AS student_name, s.class_id AS student_class_id
     FROM leave_requests lr
     JOIN students s ON s.id = lr.student_id
     WHERE lr.id = $1 AND lr.tenant_id = $2`,
    [id, tenantId],
  );
  const row = rows[0];

  if (!row) {
    send404(res, "Leave request not found");
    return;
  }

  // Guardian must be linked to the student
  if (activeRole === "Guardian") {
    const guardianCheck = await pool.query(
      `SELECT 1
       FROM student_guardians sg
       JOIN guardians g ON g.id = sg.guardian_id
       WHERE sg.student_id = $1 AND g.user_id = $2`,
      [row.student_id, userId],
    );
    if (!guardianCheck.rows[0]) {
      send403(res, "Access denied");
      return;
    }
  }

  if (row.status !== "PENDING") {
    send400(res, "Only PENDING leave requests can be cancelled");
    return;
  }

  await pool.query(
    `UPDATE leave_requests
     SET status     = 'CANCELLED',
         updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId],
  );

  const updated = await refetchLeave(id, tenantId);
  res.json({ data: updated ? fmtLeave(updated) : null });
}

// ─── PUT /leave/:id/depart ────────────────────────────────────────────────────

export async function departLeave(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const activeRole = req.activeRole!;
  const classTeacherOf = req.classTeacherOf ?? null;
  const id = req.params.id as string;

  const { rows } = await pool.query<LeaveGetRow>(
    `SELECT lr.*, s.name AS student_name, s.class_id AS student_class_id
     FROM leave_requests lr
     JOIN students s ON s.id = lr.student_id
     WHERE lr.id = $1 AND lr.tenant_id = $2`,
    [id, tenantId],
  );
  const row = rows[0];

  if (!row) {
    send404(res, "Leave request not found");
    return;
  }

  // Class-teacher scope check (Admin bypasses)
  if (activeRole !== "Admin" && classTeacherOf !== row.student_class_id) {
    send403(res, "Access denied");
    return;
  }

  if (row.status !== "APPROVED") {
    send400(res, "Leave must be APPROVED before marking departure");
    return;
  }

  await pool.query(
    `UPDATE leave_requests
     SET status      = 'ACTIVE',
         departed_at = NOW(),
         updated_at  = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId],
  );

  const updated = await refetchLeave(id, tenantId);
  res.json({ data: updated ? fmtLeave(updated) : null });
}

// ─── PUT /leave/:id/return ────────────────────────────────────────────────────

export async function returnLeave(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const activeRole = req.activeRole!;
  const classTeacherOf = req.classTeacherOf ?? null;
  const id = req.params.id as string;

  const { rows } = await pool.query<LeaveGetRow>(
    `SELECT lr.*, s.name AS student_name, s.class_id AS student_class_id
     FROM leave_requests lr
     JOIN students s ON s.id = lr.student_id
     WHERE lr.id = $1 AND lr.tenant_id = $2`,
    [id, tenantId],
  );
  const row = rows[0];

  if (!row) {
    send404(res, "Leave request not found");
    return;
  }

  // Class-teacher scope check (Admin bypasses)
  if (activeRole !== "Admin" && classTeacherOf !== row.student_class_id) {
    send403(res, "Access denied");
    return;
  }

  if (row.status !== "ACTIVE" && row.status !== "OVERDUE") {
    send400(res, "Leave must be ACTIVE or OVERDUE to mark return");
    return;
  }

  await pool.query(
    `UPDATE leave_requests
     SET status          = 'COMPLETED',
         returned_at     = NOW(),
         return_noted_by = $1,
         updated_at      = NOW()
     WHERE id = $2 AND tenant_id = $3`,
    [userId, id, tenantId],
  );

  const updated = await refetchLeave(id, tenantId);
  res.json({ data: updated ? fmtLeave(updated) : null });
}

// ─── GET /leave/on-campus ─────────────────────────────────────────────────────

export async function onCampus(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const activeRole = req.activeRole!;
  const classTeacherOf = req.classTeacherOf ?? null;

  const params: (string | number)[] = [tenantId];
  let paramCount = 1;

  let sql = `
    SELECT lr.id,
           lr.student_id,
           s.name            AS student_name,
           s.admission_number,
           c.name            AS class_name,
           lr.status,
           lr.departed_at,
           lr.expected_return_at
    FROM leave_requests lr
    JOIN students s ON s.id = lr.student_id
    LEFT JOIN classes c ON c.id = s.class_id
    WHERE lr.tenant_id = $1
      AND lr.status IN ('ACTIVE', 'OVERDUE')`;

  if (activeRole !== "Admin" && classTeacherOf !== null) {
    paramCount++;
    sql += ` AND s.class_id = $${paramCount}`;
    params.push(classTeacherOf);
  }

  sql += ` ORDER BY lr.departed_at DESC`;

  const { rows } = await pool.query<OnCampusRow>(sql, params);

  res.json({
    data: rows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      studentName: r.student_name,
      admissionNumber: r.admission_number,
      className: r.class_name,
      status: r.status,
      departedAt:
        r.departed_at instanceof Date
          ? r.departed_at.toISOString()
          : r.departed_at
            ? String(r.departed_at)
            : null,
      expectedReturnAt:
        r.expected_return_at instanceof Date
          ? r.expected_return_at.toISOString()
          : String(r.expected_return_at),
    })),
  });
}
