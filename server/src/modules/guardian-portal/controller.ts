/**
 * Guardian Portal Controller
 *
 * GET /api/v1/guardian/children                          — list linked children
 * GET /api/v1/guardian/children/:studentId/attendance    — child's attendance by month
 * GET /api/v1/guardian/children/:studentId/timetable     — child's class timetable
 * GET /api/v1/guardian/children/:studentId/results       — child's published exam results
 * GET /api/v1/guardian/children/:studentId/fees          — child's fee charges + balance
 * GET /api/v1/guardian/children/:studentId/assignments   — child's assignments + submission status
 * GET /api/v1/guardian/children/:studentId/leave         — child's leave requests
 *
 * All routes require Guardian role + tenant context.
 * Every handler verifies guardian–student linkage before returning data.
 */

import { Request, Response } from "express";
import { pool } from "../../db/pool";
import { send400, send403, send404 } from "../../utils/errors";
import { logger } from "../../utils/logger";

// ─── Guardian–Child Link Verification ────────────────────────────────────────

async function verifyGuardianChild(
  guardianUserId: string,
  studentId: string,
  tenantId: string,
): Promise<boolean> {
  const { rows } = await pool.query<{ "?column?": number }>(
    `SELECT 1
     FROM student_guardians sg
     JOIN guardians g ON g.id = sg.guardian_id
     WHERE sg.student_id = $1
       AND g.user_id = $2
       AND sg.tenant_id = $3
       AND g.deleted_at IS NULL`,
    [studentId, guardianUserId, tenantId],
  );
  return rows.length > 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/guardian/children
// ═══════════════════════════════════════════════════════════════════════════════

export async function listChildren(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;

  const { rows } = await pool.query<{
    id: string;
    name: string;
    admission_number: string;
    status: string;
    class_id: string | null;
    class_name: string | null;
    batch_id: string;
    batch_name: string | null;
  }>(
    `SELECT DISTINCT
       s.id,
       s.name,
       s.admission_number,
       s.status,
       s.class_id,
       c.name AS class_name,
       s.batch_id,
       b.name AS batch_name
     FROM students s
     JOIN student_guardians sg ON sg.student_id = s.id
     JOIN guardians g ON g.id = sg.guardian_id
     LEFT JOIN classes c ON c.id = s.class_id
     LEFT JOIN batches b ON b.id = s.batch_id
     WHERE g.user_id = $1
       AND sg.tenant_id = $2
       AND s.deleted_at IS NULL
       AND g.deleted_at IS NULL
     ORDER BY s.name`,
    [userId, tenantId],
  );

  res.status(200).json({
    data: rows.map((s) => ({
      id: s.id,
      name: s.name,
      admissionNumber: s.admission_number,
      status: s.status,
      classId: s.class_id,
      className: s.class_name,
      batchId: s.batch_id,
      batchName: s.batch_name,
    })),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/guardian/children/:studentId/attendance
// ═══════════════════════════════════════════════════════════════════════════════

export async function childAttendance(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const { studentId } = req.params as { studentId: string };
  const { month } = req.query as { month?: string };

  // ── Verify guardian link ──────────────────────────────────────────────────
  const linked = await verifyGuardianChild(userId, studentId, tenantId);
  if (!linked) {
    send403(res, "Access denied: student not linked to this guardian");
    return;
  }

  // ── Validate month ────────────────────────────────────────────────────────
  if (!month) {
    send400(res, "Query parameter 'month' is required (format: YYYY-MM)");
    return;
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    send400(res, "Month must be in YYYY-MM format");
    return;
  }

  const { rows } = await pool.query<{
    date: string;
    status: string;
    period_label: string;
    period_number: number;
  }>(
    `SELECT
       ar.date,
       ar.status,
       sp.label AS period_label,
       sp.period_number
     FROM attendance_records ar
     JOIN timeslots t ON ar.timeslot_id = t.id
     JOIN school_periods sp
       ON sp.period_number = t.period_number
       AND sp.tenant_id = ar.tenant_id
     WHERE ar.student_id = $1
       AND ar.tenant_id = $2
       AND TO_CHAR(ar.date, 'YYYY-MM') = $3
     ORDER BY ar.date, sp.period_number`,
    [studentId, tenantId, month],
  );

  // Group by date
  const days: Record<
    string,
    Array<{ status: string; periodLabel: string }>
  > = {};
  for (const row of rows) {
    const dateKey = row.date;
    if (!days[dateKey]) {
      days[dateKey] = [];
    }
    days[dateKey].push({
      status: row.status,
      periodLabel: row.period_label,
    });
  }

  logger.info(
    { tenantId, action: "guardian.childAttendance", studentId, month },
    "Guardian fetched child attendance",
  );

  res.status(200).json({ studentId, month, days });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/guardian/children/:studentId/timetable
// ═══════════════════════════════════════════════════════════════════════════════

export async function childTimetable(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const { studentId } = req.params as { studentId: string };

  // ── Verify guardian link ──────────────────────────────────────────────────
  const linked = await verifyGuardianChild(userId, studentId, tenantId);
  if (!linked) {
    send403(res, "Access denied: student not linked to this guardian");
    return;
  }

  // ── Get student's class_id ────────────────────────────────────────────────
  const { rows: studentRows } = await pool.query<{ class_id: string | null }>(
    `SELECT class_id FROM students WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [studentId, tenantId],
  );

  if (studentRows.length === 0) {
    send404(res, "Student not found");
    return;
  }

  const classId = studentRows[0]!.class_id;
  if (!classId) {
    res.status(200).json({ data: [] });
    return;
  }

  const { rows } = await pool.query<{
    day_of_week: string;
    period_number: number;
    subject_name: string;
    teacher_name: string;
    label: string;
    start_time: string;
    end_time: string;
  }>(
    `SELECT
       t.day_of_week,
       t.period_number,
       sub.name AS subject_name,
       u.name AS teacher_name,
       sp.label,
       sp.start_time,
       sp.end_time
     FROM timeslots t
     JOIN subjects sub ON sub.id = t.subject_id
     JOIN users u ON u.id = t.teacher_id
     JOIN school_periods sp
       ON sp.period_number = t.period_number
       AND sp.tenant_id = t.tenant_id
     WHERE t.class_id = $1
       AND t.tenant_id = $2
       AND t.deleted_at IS NULL
     ORDER BY t.day_of_week, t.period_number`,
    [classId, tenantId],
  );

  res.status(200).json({ data: rows });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/guardian/children/:studentId/results
// ═══════════════════════════════════════════════════════════════════════════════

export async function childResults(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const { studentId } = req.params as { studentId: string };
  const { sessionId } = req.query as { sessionId?: string };

  // ── Verify guardian link ──────────────────────────────────────────────────
  const linked = await verifyGuardianChild(userId, studentId, tenantId);
  if (!linked) {
    send403(res, "Access denied: student not linked to this guardian");
    return;
  }

  const params: unknown[] = [studentId, tenantId];
  let sessionFilter = "";
  if (sessionId) {
    params.push(sessionId);
    sessionFilter = `AND e.session_id = $${params.length}`;
  }

  const { rows } = await pool.query<{
    id: string;
    name: string;
    type: string;
    published_at: Date | null;
    total_marks_obtained: number;
    total_marks_possible: number;
    aggregate_percentage: number;
    overall_grade: string;
    overall_result: string;
    class_rank: number | null;
  }>(
    `SELECT
       e.id,
       e.name,
       e.type,
       e.published_at,
       ess.total_marks_obtained,
       ess.total_marks_possible,
       ess.aggregate_percentage,
       ess.overall_grade,
       ess.overall_result,
       ess.class_rank
     FROM exams e
     JOIN exam_student_summaries ess ON ess.exam_id = e.id
     WHERE ess.student_id = $1
       AND e.tenant_id = $2
       AND e.status = 'PUBLISHED'
       ${sessionFilter}
     ORDER BY e.published_at DESC`,
    params,
  );

  res.status(200).json({
    data: rows.map((r) => ({
      examId: r.id,
      examName: r.name,
      examType: r.type,
      publishedAt: r.published_at
        ? r.published_at instanceof Date
          ? r.published_at.toISOString()
          : String(r.published_at)
        : null,
      totalMarksObtained: r.total_marks_obtained,
      totalMarksPossible: r.total_marks_possible,
      aggregatePercentage: r.aggregate_percentage,
      overallGrade: r.overall_grade,
      overallResult: r.overall_result,
      classRank: r.class_rank,
    })),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/guardian/children/:studentId/fees
// ═══════════════════════════════════════════════════════════════════════════════

export async function childFees(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const { studentId } = req.params as { studentId: string };
  const { sessionId } = req.query as { sessionId?: string };

  // ── Verify guardian link ──────────────────────────────────────────────────
  const linked = await verifyGuardianChild(userId, studentId, tenantId);
  if (!linked) {
    send403(res, "Access denied: student not linked to this guardian");
    return;
  }

  const params: unknown[] = [studentId, tenantId];
  let sessionFilter = "";
  if (sessionId) {
    params.push(sessionId);
    sessionFilter = `AND fc.session_id = $${params.length}`;
  }

  const { rows } = await pool.query<{
    id: string;
    session_id: string;
    description: string;
    category: string;
    amount: number;
    due_date: string | null;
    notes: string | null;
    created_at: Date;
    total_paid: string;
  }>(
    `SELECT
       fc.id,
       fc.session_id,
       fc.description,
       fc.category,
       fc.amount,
       fc.due_date,
       fc.notes,
       fc.created_at,
       COALESCE(SUM(fp.amount_paid), 0) AS total_paid
     FROM fee_charges fc
     LEFT JOIN fee_payments fp ON fp.charge_id = fc.id
     WHERE fc.student_id = $1
       AND fc.tenant_id = $2
       ${sessionFilter}
     GROUP BY fc.id
     ORDER BY fc.created_at DESC`,
    params,
  );

  res.status(200).json({
    data: rows.map((r) => {
      const totalPaid = parseFloat(r.total_paid);
      return {
        id: r.id,
        tenantId,
        studentId,
        sessionId: r.session_id,
        description: r.description,
        category: r.category,
        amount: r.amount,
        dueDate: r.due_date,
        totalPaid,
        balance: r.amount - totalPaid,
        notes: r.notes,
        createdAt:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : String(r.created_at),
      };
    }),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/guardian/children/:studentId/assignments
// ═══════════════════════════════════════════════════════════════════════════════

export async function childAssignments(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const { studentId } = req.params as { studentId: string };

  // ── Verify guardian link ──────────────────────────────────────────────────
  const linked = await verifyGuardianChild(userId, studentId, tenantId);
  if (!linked) {
    send403(res, "Access denied: student not linked to this guardian");
    return;
  }

  // ── Get student's class_id ────────────────────────────────────────────────
  const { rows: studentRows } = await pool.query<{ class_id: string | null }>(
    `SELECT class_id FROM students WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [studentId, tenantId],
  );

  if (studentRows.length === 0) {
    send404(res, "Student not found");
    return;
  }

  const classId = studentRows[0]!.class_id;
  if (!classId) {
    res.status(200).json({ data: [] });
    return;
  }

  const { rows } = await pool.query<{
    id: string;
    title: string;
    type: string;
    due_date: string;
    status: string;
    submission_status: string | null;
  }>(
    `SELECT
       a.id,
       a.title,
       a.type,
       a.due_date,
       a.status,
       asub.status AS submission_status
     FROM assignments a
     LEFT JOIN assignment_submissions asub
       ON asub.assignment_id = a.id
       AND asub.student_id = $1
     WHERE a.class_id = $2
       AND a.tenant_id = $3
       AND a.deleted_at IS NULL
     ORDER BY a.due_date DESC`,
    [studentId, classId, tenantId],
  );

  res.status(200).json({
    data: rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      dueDate: r.due_date,
      status: r.status,
      submissionStatus: r.submission_status,
    })),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/guardian/children/:studentId/leave
// ═══════════════════════════════════════════════════════════════════════════════

export async function childLeave(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const { studentId } = req.params as { studentId: string };

  // ── Verify guardian link ──────────────────────────────────────────────────
  const linked = await verifyGuardianChild(userId, studentId, tenantId);
  if (!linked) {
    send403(res, "Access denied: student not linked to this guardian");
    return;
  }

  const { rows } = await pool.query<{
    id: string;
    tenant_id: string;
    session_id: string;
    student_id: string;
    student_name: string;
    requested_by_user_id: string;
    requested_by_role: string;
    leave_type: string;
    duration_type: string;
    start_date: string;
    end_date: string;
    reason: string;
    attachment_url: string | null;
    status: string;
    reviewed_by: string | null;
    reviewed_at: Date | null;
    rejection_reason: string | null;
    departed_at: Date | null;
    expected_return_at: Date;
    returned_at: Date | null;
    created_at: Date;
  }>(
    `SELECT
       lr.*,
       s.name AS student_name
     FROM leave_requests lr
     JOIN students s ON s.id = lr.student_id
     WHERE lr.student_id = $1
       AND lr.tenant_id = $2
     ORDER BY lr.created_at DESC`,
    [studentId, tenantId],
  );

  res.status(200).json({
    data: rows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      sessionId: r.session_id,
      studentId: r.student_id,
      studentName: r.student_name,
      requestedByUserId: r.requested_by_user_id,
      requestedByRole: r.requested_by_role,
      leaveType: r.leave_type,
      durationType: r.duration_type,
      startDate: r.start_date,
      endDate: r.end_date,
      reason: r.reason,
      attachmentUrl: r.attachment_url,
      status: r.status,
      reviewedBy: r.reviewed_by,
      reviewedAt: r.reviewed_at
        ? r.reviewed_at instanceof Date
          ? r.reviewed_at.toISOString()
          : String(r.reviewed_at)
        : null,
      rejectionReason: r.rejection_reason,
      departedAt: r.departed_at
        ? r.departed_at instanceof Date
          ? r.departed_at.toISOString()
          : String(r.departed_at)
        : null,
      expectedReturnAt:
        r.expected_return_at instanceof Date
          ? r.expected_return_at.toISOString()
          : String(r.expected_return_at),
      returnedAt: r.returned_at
        ? r.returned_at instanceof Date
          ? r.returned_at.toISOString()
          : String(r.returned_at)
        : null,
      createdAt:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
    })),
  });
}
