/**
 * Assignments Controller — v5.0
 *
 * POST /api/v1/assignments              — createAssignment (Admin, Teacher)
 * GET  /api/v1/assignments              — listAssignments (all roles — filtered)
 * GET  /api/v1/assignments/:id          — getAssignment
 * PUT  /api/v1/assignments/:id          — updateAssignment (Admin, Teacher)
 * DELETE /api/v1/assignments/:id        — deleteAssignment (Admin, Teacher)
 * PUT  /api/v1/assignments/:id/close    — closeAssignment (Admin)
 * GET  /api/v1/assignments/:id/submissions — getSubmissions (Admin, Teacher)
 * PUT  /api/v1/assignments/:id/submissions — bulkMark (Admin, Teacher)
 *
 * When an assignment is created, assignment_submissions rows are pre-created
 * for all active students in the class with status='PENDING'.
 */

import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { formatInTimeZone } from "date-fns-tz";
import { pool, withTransaction } from "../../db/pool";
import { send400, send403, send404 } from "../../utils/errors";
import { logger } from "../../utils/logger";
import {
  AssignmentRow,
  AssignmentSubmissionRow,
  ApiAssignment,
  ApiSubmission,
  AssignmentType,
  SubmissionStatus,
} from "../../types";

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_ASSIGNMENT_TYPES: AssignmentType[] = [
  "Written",
  "Memorization",
  "Reading",
  "ProblemSet",
  "Project",
  "Revision",
];

const VALID_SUBMISSION_STATUSES: SubmissionStatus[] = [
  "PENDING",
  "COMPLETED",
  "INCOMPLETE",
  "NOT_SUBMITTED",
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── Extended row types ───────────────────────────────────────────────────────

type AssignmentWithMeta = AssignmentRow & {
  class_name: string;
  subject_name: string;
  created_by_name: string;
  submissions_total: string;
  submissions_completed: string;
};

type SubmissionWithStudent = AssignmentSubmissionRow & {
  student_name: string;
  admission_number: string;
};

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatAssignment(row: AssignmentWithMeta): ApiAssignment {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sessionId: row.session_id,
    classId: row.class_id,
    className: row.class_name,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    title: row.title,
    description: row.description,
    type: row.type,
    dueDate: String(row.due_date).slice(0, 10),
    isGraded: row.is_graded,
    maxMarks: row.max_marks,
    status: row.status,
    submissionsTotal: parseInt(row.submissions_total ?? "0", 10),
    submissionsCompleted: parseInt(row.submissions_completed ?? "0", 10),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}

function formatSubmission(row: SubmissionWithStudent): ApiSubmission {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    studentName: row.student_name,
    admissionNumber: row.admission_number,
    status: row.status,
    marksObtained:
      row.marks_obtained !== null ? Number(row.marks_obtained) : null,
    remark: row.remark,
    markedBy: row.marked_by,
    markedAt: row.marked_at
      ? row.marked_at instanceof Date
        ? row.marked_at.toISOString()
        : String(row.marked_at)
      : null,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ASSIGNMENT_SELECT = `
  SELECT a.*,
         c.name AS class_name,
         s.name AS subject_name,
         u.name AS created_by_name,
         COUNT(sub.id) AS submissions_total,
         COUNT(CASE WHEN sub.status = 'COMPLETED' THEN 1 END) AS submissions_completed
  FROM assignments a
  JOIN classes c ON c.id = a.class_id
  JOIN subjects s ON s.id = a.subject_id
  JOIN users u ON u.id = a.created_by
  LEFT JOIN assignment_submissions sub
    ON sub.assignment_id = a.id AND sub.tenant_id = a.tenant_id
`;

async function fetchAssignmentWithMeta(
  id: string,
  tenantId: string,
): Promise<AssignmentWithMeta | null> {
  const result = await pool.query<AssignmentWithMeta>(
    `${ASSIGNMENT_SELECT}
     WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL
     GROUP BY a.id, c.name, s.name, u.name`,
    [id, tenantId],
  );
  return result.rows[0] ?? null;
}

// ═══════════════════════════════════════════════════════════════════
// POST /assignments
// ═══════════════════════════════════════════════════════════════════

export async function createAssignment(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRoles = req.userRoles ?? [];
  const isAdmin = userRoles.includes("Admin");
  const activeRole = req.activeRole!;

  const {
    classId,
    subjectId,
    sessionId: sessionIdParam,
    title,
    description,
    type,
    dueDate,
    isGraded,
    maxMarks,
  } = req.body as {
    classId?: string;
    subjectId?: string;
    sessionId?: string;
    title?: string;
    description?: string;
    type?: string;
    dueDate?: string;
    isGraded?: boolean;
    maxMarks?: number;
  };

  if (!classId || typeof classId !== "string") {
    send400(res, "classId is required");
    return;
  }
  if (!subjectId || typeof subjectId !== "string") {
    send400(res, "subjectId is required");
    return;
  }
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    send400(res, "title is required");
    return;
  }
  if (!type || !VALID_ASSIGNMENT_TYPES.includes(type as AssignmentType)) {
    send400(res, `type must be one of: ${VALID_ASSIGNMENT_TYPES.join(", ")}`);
    return;
  }
  if (!dueDate || !DATE_RE.test(dueDate)) {
    send400(res, "dueDate must be a valid date in YYYY-MM-DD format");
    return;
  }
  if (
    isGraded &&
    (maxMarks === undefined || typeof maxMarks !== "number" || maxMarks <= 0)
  ) {
    send400(res, "maxMarks must be a positive number when isGraded is true");
    return;
  }

  // Verify class exists in tenant
  const classCheck = await pool.query(
    "SELECT id FROM classes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [classId, tenantId],
  );
  if ((classCheck.rowCount ?? 0) === 0) {
    send404(res, "Class not found");
    return;
  }

  // Verify subject exists in tenant
  const subjectCheck = await pool.query(
    "SELECT id FROM subjects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [subjectId, tenantId],
  );
  if ((subjectCheck.rowCount ?? 0) === 0) {
    send404(res, "Subject not found");
    return;
  }

  // Teacher authorization: must be class teacher or assigned to teach this class+subject
  if (!isAdmin && activeRole === "Teacher") {
    const classTeacherOf = req.classTeacherOf;
    const isClassTeacher = classTeacherOf === classId;
    if (!isClassTeacher) {
      const timeslotCheck = await pool.query(
        `SELECT id FROM timeslots
         WHERE teacher_id = $1 AND class_id = $2 AND subject_id = $3
           AND tenant_id = $4 AND deleted_at IS NULL`,
        [userId, classId, subjectId, tenantId],
      );
      if ((timeslotCheck.rowCount ?? 0) === 0) {
        send403(
          res,
          "You are not assigned to teach this class and subject combination",
        );
        return;
      }
    }
  }

  // Resolve session: use provided or find current active session
  let sessionId = sessionIdParam;
  if (!sessionId) {
    const sessionResult = await pool.query<{ id: string }>(
      `SELECT id FROM academic_sessions
       WHERE tenant_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
       LIMIT 1`,
      [tenantId],
    );
    if ((sessionResult.rowCount ?? 0) === 0) {
      send400(
        res,
        "No active academic session found. Please provide sessionId.",
        "NO_ACTIVE_SESSION",
      );
      return;
    }
    sessionId = sessionResult.rows[0]!.id;
  } else {
    const sessionCheck = await pool.query(
      "SELECT id FROM academic_sessions WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [sessionId, tenantId],
    );
    if ((sessionCheck.rowCount ?? 0) === 0) {
      send404(res, "Academic session not found");
      return;
    }
  }

  const id = uuidv4();

  await withTransaction(async (client) => {
    // Insert the assignment
    await client.query(
      `INSERT INTO assignments
         (id, tenant_id, session_id, class_id, subject_id, created_by,
          title, description, type, due_date, is_graded, max_marks,
          status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ACTIVE', NOW(), NOW())`,
      [
        id,
        tenantId,
        sessionId,
        classId,
        subjectId,
        userId,
        title.trim(),
        description ?? null,
        type,
        dueDate,
        isGraded ?? false,
        isGraded ? (maxMarks ?? null) : null,
      ],
    );

    // Pre-create submission rows for all active students in the class
    const studentsResult = await client.query<{ id: string }>(
      `SELECT id FROM students
       WHERE class_id = $1 AND tenant_id = $2 AND status = 'Active' AND deleted_at IS NULL`,
      [classId, tenantId],
    );

    for (const student of studentsResult.rows) {
      const submissionId = uuidv4();
      await client.query(
        `INSERT INTO assignment_submissions
           (id, tenant_id, assignment_id, student_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'PENDING', NOW(), NOW())`,
        [submissionId, tenantId, id, student.id],
      );
    }
  });

  const assignment = await fetchAssignmentWithMeta(id, tenantId);
  const data = formatAssignment(assignment!);
  res.status(201).json({ data, assignment: data });
}

// ═══════════════════════════════════════════════════════════════════
// GET /assignments
// ═══════════════════════════════════════════════════════════════════

export async function listAssignments(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRoles = req.userRoles ?? [];
  const isAdmin = userRoles.includes("Admin");
  const isTeacher = userRoles.includes("Teacher") && !isAdmin;
  const isStudent = userRoles.includes("Student") && !isAdmin && !isTeacher;
  const isGuardian = userRoles.includes("Guardian") && !isAdmin && !isTeacher;

  const {
    classId: classIdFilter,
    sessionId: sessionIdFilter,
    subjectId: subjectIdFilter,
    status: statusFilter,
  } = req.query as {
    classId?: string;
    sessionId?: string;
    subjectId?: string;
    status?: string;
  };

  const conditions: string[] = ["a.tenant_id = $1", "a.deleted_at IS NULL"];
  const params: unknown[] = [tenantId];
  let paramIdx = 2;

  if (classIdFilter) {
    conditions.push(`a.class_id = $${paramIdx++}`);
    params.push(classIdFilter);
  }
  if (sessionIdFilter) {
    conditions.push(`a.session_id = $${paramIdx++}`);
    params.push(sessionIdFilter);
  }
  if (subjectIdFilter) {
    conditions.push(`a.subject_id = $${paramIdx++}`);
    params.push(subjectIdFilter);
  }
  if (statusFilter) {
    conditions.push(`a.status = $${paramIdx++}`);
    params.push(statusFilter);
  }

  if (isTeacher) {
    // Teacher sees only their class+subject assignments
    const classTeacherOf = req.classTeacherOf;
    if (classTeacherOf && !classIdFilter) {
      // If no class filter, default to their own class
      conditions.push(`a.created_by = $${paramIdx++}`);
      params.push(userId);
    } else if (!classTeacherOf && !classIdFilter) {
      // Teacher without class: show only what they created
      conditions.push(`a.created_by = $${paramIdx++}`);
      params.push(userId);
    }
  } else if (isStudent) {
    // Student sees own class assignments
    const studentId = req.studentId;
    if (studentId) {
      const studentResult = await pool.query<{ class_id: string | null }>(
        "SELECT class_id FROM students WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
        [studentId, tenantId],
      );
      const studentClassId = studentResult.rows[0]?.class_id;
      if (!studentClassId) {
        res.status(200).json({ data: [], total: 0, assignments: [] });
        return;
      }
      if (!classIdFilter) {
        conditions.push(`a.class_id = $${paramIdx++}`);
        params.push(studentClassId);
      }
    }
  } else if (isGuardian) {
    // Guardian sees children's class assignments
    const childrenResult = await pool.query<{ class_id: string | null }>(
      `SELECT DISTINCT s.class_id FROM students s
       JOIN student_guardians sg ON sg.student_id = s.id
       JOIN guardians g ON g.id = sg.guardian_id
       WHERE g.user_id = $1 AND g.tenant_id = $2
         AND g.deleted_at IS NULL AND s.deleted_at IS NULL AND s.status = 'Active'`,
      [userId, tenantId],
    );
    const childClassIds = childrenResult.rows
      .map((r) => r.class_id)
      .filter((cid): cid is string => cid !== null);
    if (childClassIds.length === 0) {
      res.status(200).json({ data: [], total: 0, assignments: [] });
      return;
    }
    if (!classIdFilter) {
      conditions.push(`a.class_id = ANY($${paramIdx++}::uuid[])`);
      params.push(childClassIds);
    }
  }

  const result = await pool.query<AssignmentWithMeta>(
    `${ASSIGNMENT_SELECT}
     WHERE ${conditions.join(" AND ")}
     GROUP BY a.id, c.name, s.name, u.name
     ORDER BY a.created_at DESC`,
    params,
  );

  const data = result.rows.map(formatAssignment);
  res.status(200).json({ data, total: data.length, assignments: data });
}

// ═══════════════════════════════════════════════════════════════════
// GET /assignments/:id
// ═══════════════════════════════════════════════════════════════════

export async function getAssignment(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };

  const assignment = await fetchAssignmentWithMeta(id, tenantId);
  if (!assignment) {
    send404(res, "Assignment not found");
    return;
  }

  const data = formatAssignment(assignment);
  res.status(200).json({ data, assignment: data });
}

// ═══════════════════════════════════════════════════════════════════
// PUT /assignments/:id
// ═══════════════════════════════════════════════════════════════════

export async function updateAssignment(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRoles = req.userRoles ?? [];
  const isAdmin = userRoles.includes("Admin");
  const { id } = req.params as { id: string };

  const existingResult = await pool.query<AssignmentRow>(
    "SELECT * FROM assignments WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  if ((existingResult.rowCount ?? 0) === 0) {
    send404(res, "Assignment not found");
    return;
  }
  const existing = existingResult.rows[0]!;

  // Only creator or Admin
  if (!isAdmin && existing.created_by !== userId) {
    send403(res, "You can only edit your own assignments");
    return;
  }

  // Cannot edit past-due assignments
  // Fetch tenant timezone for accurate date comparison
  const { rows: tenantRows } = await pool.query<{ timezone: string }>(
    "SELECT timezone FROM tenants WHERE id = $1",
    [tenantId],
  );
  const tenantTimezone = tenantRows[0]?.timezone ?? "UTC";

  const dueDate = String(existing.due_date).slice(0, 10);
  const today = formatInTimeZone(new Date(), tenantTimezone, "yyyy-MM-dd");
  if (dueDate < today) {
    send400(
      res,
      "Cannot edit an assignment past its due date",
      "PAST_DUE_DATE",
    );
    return;
  }

  const {
    title,
    description,
    type,
    dueDate: newDueDate,
    isGraded,
    maxMarks,
  } = req.body as {
    title?: string;
    description?: string | null;
    type?: string;
    dueDate?: string;
    isGraded?: boolean;
    maxMarks?: number | null;
  };

  if (
    type !== undefined &&
    !VALID_ASSIGNMENT_TYPES.includes(type as AssignmentType)
  ) {
    send400(res, `type must be one of: ${VALID_ASSIGNMENT_TYPES.join(", ")}`);
    return;
  }
  if (newDueDate !== undefined && !DATE_RE.test(newDueDate)) {
    send400(res, "dueDate must be a valid date in YYYY-MM-DD format");
    return;
  }

  await pool.query(
    `UPDATE assignments
     SET title = $1, description = $2, type = $3, due_date = $4,
         is_graded = $5, max_marks = $6, updated_at = NOW()
     WHERE id = $7 AND tenant_id = $8`,
    [
      title !== undefined ? title.trim() : existing.title,
      description !== undefined ? description : existing.description,
      type !== undefined ? type : existing.type,
      newDueDate !== undefined
        ? newDueDate
        : String(existing.due_date).slice(0, 10),
      isGraded !== undefined ? isGraded : existing.is_graded,
      maxMarks !== undefined ? maxMarks : existing.max_marks,
      id,
      tenantId,
    ],
  );

  const assignment = await fetchAssignmentWithMeta(id, tenantId);
  const data = formatAssignment(assignment!);
  res.status(200).json({ data, assignment: data });
}

// ═══════════════════════════════════════════════════════════════════
// DELETE /assignments/:id
// ═══════════════════════════════════════════════════════════════════

export async function deleteAssignment(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRoles = req.userRoles ?? [];
  const isAdmin = userRoles.includes("Admin");
  const { id } = req.params as { id: string };

  const result = await pool.query<AssignmentRow>(
    "SELECT * FROM assignments WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  if ((result.rowCount ?? 0) === 0) {
    send404(res, "Assignment not found");
    return;
  }
  const assignment = result.rows[0]!;

  if (!isAdmin && assignment.created_by !== userId) {
    send403(res, "You can only delete your own assignments");
    return;
  }

  await pool.query(
    "UPDATE assignments SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2",
    [id, tenantId],
  );
  res.status(204).send();
}

// ═══════════════════════════════════════════════════════════════════
// PUT /assignments/:id/close
// ═══════════════════════════════════════════════════════════════════

export async function closeAssignment(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };

  const result = await pool.query<AssignmentRow>(
    "SELECT * FROM assignments WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  if ((result.rowCount ?? 0) === 0) {
    send404(res, "Assignment not found");
    return;
  }

  await pool.query(
    "UPDATE assignments SET status = 'CLOSED', updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
    [id, tenantId],
  );

  const assignment = await fetchAssignmentWithMeta(id, tenantId);
  const data = formatAssignment(assignment!);
  res.status(200).json({ data, assignment: data });
}

// ═══════════════════════════════════════════════════════════════════
// GET /assignments/:id/submissions
// ═══════════════════════════════════════════════════════════════════

export async function getSubmissions(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRoles = req.userRoles ?? [];
  const isAdmin = userRoles.includes("Admin");
  const { id } = req.params as { id: string };

  const assignment = await fetchAssignmentWithMeta(id, tenantId);
  if (!assignment) {
    send404(res, "Assignment not found");
    return;
  }

  // Teacher must be assigned to this subject for this class
  if (!isAdmin) {
    const timeslotCheck = await pool.query(
      `SELECT id FROM timeslots
       WHERE teacher_id = $1 AND class_id = $2 AND subject_id = $3
         AND tenant_id = $4 AND deleted_at IS NULL`,
      [userId, assignment.class_id, assignment.subject_id, tenantId],
    );
    const isClassTeacher = req.classTeacherOf === assignment.class_id;
    const isCreator = assignment.created_by === userId;
    if (!isClassTeacher && !isCreator && (timeslotCheck.rowCount ?? 0) === 0) {
      send403(res, "You are not assigned to this assignment's subject");
      return;
    }
  }

  const submissionsResult = await pool.query<SubmissionWithStudent>(
    `SELECT asub.*, s.name AS student_name, s.admission_number
     FROM assignment_submissions asub
     JOIN students s ON s.id = asub.student_id
     WHERE asub.assignment_id = $1 AND asub.tenant_id = $2
     ORDER BY s.name ASC`,
    [id, tenantId],
  );

  const assignmentData = formatAssignment(assignment);
  const submissions = submissionsResult.rows.map(formatSubmission);
  res.status(200).json({
    data: {
      assignment: assignmentData,
      submissions,
    },
    assignment: assignmentData,
    submissions,
  });
}

// ═══════════════════════════════════════════════════════════════════
// PUT /assignments/:id/submissions
// ═══════════════════════════════════════════════════════════════════

export async function bulkMark(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRoles = req.userRoles ?? [];
  const isAdmin = userRoles.includes("Admin");
  const { id } = req.params as { id: string };

  const assignment = await fetchAssignmentWithMeta(id, tenantId);
  if (!assignment) {
    send404(res, "Assignment not found");
    return;
  }

  // Teacher must be assigned to this subject
  if (!isAdmin) {
    const timeslotCheck = await pool.query(
      `SELECT id FROM timeslots
       WHERE teacher_id = $1 AND class_id = $2 AND subject_id = $3
         AND tenant_id = $4 AND deleted_at IS NULL`,
      [userId, assignment.class_id, assignment.subject_id, tenantId],
    );
    const isClassTeacher = req.classTeacherOf === assignment.class_id;
    const isCreator = assignment.created_by === userId;
    if (!isClassTeacher && !isCreator && (timeslotCheck.rowCount ?? 0) === 0) {
      send403(res, "You are not assigned to this assignment's subject");
      return;
    }
  }

  const { submissions } = req.body as {
    submissions?: Array<{
      studentId: string;
      status: string;
      marksObtained?: number | null;
      remark?: string | null;
    }>;
  };

  if (!Array.isArray(submissions) || submissions.length === 0) {
    send400(res, "submissions array is required");
    return;
  }

  for (const entry of submissions) {
    if (!entry.studentId || typeof entry.studentId !== "string") {
      send400(res, "Each submission entry must have a studentId");
      return;
    }
    if (
      !entry.status ||
      !VALID_SUBMISSION_STATUSES.includes(entry.status as SubmissionStatus)
    ) {
      send400(
        res,
        `status must be one of: ${VALID_SUBMISSION_STATUSES.join(", ")}`,
      );
      return;
    }
  }

  let updatedCount = 0;
  for (const entry of submissions) {
    const result = await pool.query(
      `UPDATE assignment_submissions
       SET status = $1, marks_obtained = $2, remark = $3,
           marked_by = $4, marked_at = NOW(), updated_at = NOW()
       WHERE assignment_id = $5 AND student_id = $6 AND tenant_id = $7`,
      [
        entry.status,
        entry.marksObtained ?? null,
        entry.remark ?? null,
        userId,
        id,
        entry.studentId,
        tenantId,
      ],
    );
    if ((result.rowCount ?? 0) > 0) {
      updatedCount++;
    } else {
      // Submission not pre-created — insert it (handles edge cases)
      const submissionId = uuidv4();
      try {
        await pool.query(
          `INSERT INTO assignment_submissions
             (id, tenant_id, assignment_id, student_id, status, marks_obtained,
              remark, marked_by, marked_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())
           ON CONFLICT (assignment_id, student_id) DO UPDATE SET
             status = EXCLUDED.status,
             marks_obtained = EXCLUDED.marks_obtained,
             remark = EXCLUDED.remark,
             marked_by = EXCLUDED.marked_by,
             marked_at = NOW(),
             updated_at = NOW()`,
          [
            submissionId,
            tenantId,
            id,
            entry.studentId,
            entry.status,
            entry.marksObtained ?? null,
            entry.remark ?? null,
            userId,
          ],
        );
        updatedCount++;
      } catch (err) {
        logger.warn(
          { err, action: "assignments.bulkMark", studentId: entry.studentId },
          "Failed to upsert submission",
        );
      }
    }
  }

  res.status(200).json({ updated: updatedCount });
}
