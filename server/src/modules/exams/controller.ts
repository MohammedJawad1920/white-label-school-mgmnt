/**
 * Exams Controller — v5.0
 *
 * POST   /api/v1/exams                              — createExam (Admin)
 * GET    /api/v1/exams                              — listExams (Admin, Teacher)
 * GET    /api/v1/exams/:id                          — getExam
 * PUT    /api/v1/exams/:id                          — updateExam (Admin, DRAFT only)
 * DELETE /api/v1/exams/:id                          — deleteExam (Admin, DRAFT only)
 * PUT    /api/v1/exams/:id/publish                  — publishExam (Admin)
 * PUT    /api/v1/exams/:id/unpublish                — unpublishExam (Admin)
 * POST   /api/v1/exams/:id/subjects                 — addExamSubject (Admin)
 * PUT    /api/v1/exams/:id/subjects/:subjectId      — updateExamSubject (Admin)
 * DELETE /api/v1/exams/:id/subjects/:subjectId      — removeExamSubject (Admin, DRAFT only)
 * GET    /api/v1/exams/:id/subjects/:subjectId/marks — getMarks
 * PUT    /api/v1/exams/:id/subjects/:subjectId/marks — enterMarks
 * GET    /api/v1/exams/:id/results                  — getResults (PUBLISHED only)
 * GET    /api/v1/exams/:id/results/:studentId       — getStudentResult
 *
 * Also handles external-results CRUD via exported functions.
 */

import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool, withTransaction } from "../../db/pool";
import {
  sendError,
  send400,
  send403,
  send404,
  send409,
} from "../../utils/errors";
import { logger } from "../../utils/logger";
import {
  ExamRow,
  ExamSubjectRow,
  ExamResultRow,
  ExamStudentSummaryRow,
  ExternalResultRow,
  GradeBoundary,
  ApiExam,
  ApiExamSubject,
  ApiExamResult,
  ApiConsolidatedResults,
  ApiExternalResult,
} from "../../types";

// ─── Constants ───────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_EXAM_TYPES = ["TermExam", "PeriodicTest"] as const;
type ExamType = (typeof VALID_EXAM_TYPES)[number];

// ─── Extended row types for JOIN queries ──────────────────────────────────────

type ExamRowWithClass = ExamRow & { class_name: string };

type ExamSubjectWithNames = ExamSubjectRow & {
  subject_name: string;
  teacher_name: string;
};

type ExamStudentSummaryWithStudent = ExamStudentSummaryRow & {
  student_name: string;
  admission_number: string;
};

type StudentBasicRow = {
  id: string;
  name: string;
  admission_number: string;
};

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatExamSubject(es: ExamSubjectWithNames): ApiExamSubject {
  return {
    id: es.id,
    examId: es.exam_id,
    subjectId: es.subject_id,
    subjectName: es.subject_name,
    teacherId: es.teacher_id,
    teacherName: es.teacher_name,
    examDate: String(es.exam_date).slice(0, 10),
    startTime: es.start_time,
    endTime: es.end_time,
    totalMarks: Number(es.total_marks),
    passMarks: Number(es.pass_marks),
    marksStatus: es.marks_status,
  };
}

function formatExam(
  exam: ExamRowWithClass,
  subjects: ApiExamSubject[],
): ApiExam {
  return {
    id: exam.id,
    tenantId: exam.tenant_id,
    sessionId: exam.session_id,
    classId: exam.class_id,
    className: exam.class_name,
    name: exam.name,
    type: exam.type,
    status: exam.status,
    gradeBoundaries: exam.grade_boundaries,
    subjects,
    createdBy: exam.created_by,
    publishedBy: exam.published_by,
    publishedAt: exam.published_at
      ? exam.published_at instanceof Date
        ? exam.published_at.toISOString()
        : String(exam.published_at)
      : null,
    createdAt:
      exam.created_at instanceof Date
        ? exam.created_at.toISOString()
        : String(exam.created_at),
    updatedAt:
      exam.updated_at instanceof Date
        ? exam.updated_at.toISOString()
        : String(exam.updated_at),
  };
}

function formatExternalResult(
  row: ExternalResultRow & { student_name: string },
): ApiExternalResult {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_id,
    studentName: row.student_name,
    sessionId: row.session_id,
    examName: row.exam_name,
    conductedBy: row.conducted_by,
    resultSummary: row.result_summary,
    documentUrl: row.document_url,
    recordedBy: row.recorded_by,
    recordedAt:
      row.recorded_at instanceof Date
        ? row.recorded_at.toISOString()
        : String(row.recorded_at),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lookupGrade(percentage: number, boundaries: GradeBoundary[]): string {
  const match = boundaries.find(
    (b) => percentage >= b.minPercentage && percentage <= b.maxPercentage,
  );
  return match?.grade ?? "N/A";
}

async function getExamSubjectsWithNames(
  examId: string,
  tenantId: string,
): Promise<ApiExamSubject[]> {
  const result = await pool.query<ExamSubjectWithNames>(
    `SELECT es.*, s.name AS subject_name, u.name AS teacher_name
     FROM exam_subjects es
     JOIN subjects s ON s.id = es.subject_id
     JOIN users u ON u.id = es.teacher_id
     WHERE es.exam_id = $1 AND es.tenant_id = $2
     ORDER BY es.exam_date ASC`,
    [examId, tenantId],
  );
  return result.rows.map(formatExamSubject);
}

async function fetchExamWithClass(
  id: string,
  tenantId: string,
): Promise<ExamRowWithClass | null> {
  const result = await pool.query<ExamRowWithClass>(
    `SELECT e.*, c.name AS class_name
     FROM exams e
     JOIN classes c ON c.id = e.class_id
     WHERE e.id = $1 AND e.tenant_id = $2 AND e.deleted_at IS NULL`,
    [id, tenantId],
  );
  return result.rows[0] ?? null;
}

// ═══════════════════════════════════════════════════════════════════
// POST /exams
// ═══════════════════════════════════════════════════════════════════

export async function createExam(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;

  const { classId, sessionId, name, type, gradeBoundaries } = req.body as {
    classId?: string;
    sessionId?: string;
    name?: string;
    type?: string;
    gradeBoundaries?: GradeBoundary[];
  };

  if (!classId || typeof classId !== "string") {
    send400(res, "classId is required");
    return;
  }
  if (!sessionId || typeof sessionId !== "string") {
    send400(res, "sessionId is required");
    return;
  }
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    send400(res, "name is required");
    return;
  }
  if (!type || !VALID_EXAM_TYPES.includes(type as ExamType)) {
    send400(res, `type must be one of: ${VALID_EXAM_TYPES.join(", ")}`);
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

  // Verify session exists in tenant
  const sessionCheck = await pool.query(
    "SELECT id FROM academic_sessions WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [sessionId, tenantId],
  );
  if ((sessionCheck.rowCount ?? 0) === 0) {
    send404(res, "Academic session not found");
    return;
  }

  const id = uuidv4();
  const result = await pool.query<ExamRow>(
    `INSERT INTO exams
       (id, tenant_id, session_id, class_id, name, type, status,
        grade_boundaries, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', $7, $8, NOW(), NOW())
     RETURNING *`,
    [
      id,
      tenantId,
      sessionId,
      classId,
      name.trim(),
      type,
      JSON.stringify(gradeBoundaries ?? []),
      userId,
    ],
  );

  const exam = result.rows[0]!;
  const classRow = await pool.query<{ name: string }>(
    "SELECT name FROM classes WHERE id = $1",
    [classId],
  );
  const examWithClass: ExamRowWithClass = {
    ...exam,
    class_name: classRow.rows[0]?.name ?? "",
  };

  res.status(201).json({ exam: formatExam(examWithClass, []) });
}

// ═══════════════════════════════════════════════════════════════════
// GET /exams
// ═══════════════════════════════════════════════════════════════════

export async function listExams(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRoles = req.userRoles ?? [];
  const isAdmin = userRoles.includes("Admin");

  const { classId, sessionId } = req.query as {
    classId?: string;
    sessionId?: string;
  };

  const conditions: string[] = ["e.tenant_id = $1", "e.deleted_at IS NULL"];
  const params: unknown[] = [tenantId];
  let paramIdx = 2;

  if (classId) {
    conditions.push(`e.class_id = $${paramIdx++}`);
    params.push(classId);
  }
  if (sessionId) {
    conditions.push(`e.session_id = $${paramIdx++}`);
    params.push(sessionId);
  }

  let teacherJoin = "";
  if (!isAdmin) {
    // Teacher: only exams where they are assigned as a subject teacher
    teacherJoin = `JOIN exam_subjects es_filter
      ON es_filter.exam_id = e.id
      AND es_filter.teacher_id = $${paramIdx++}
      AND es_filter.tenant_id = e.tenant_id`;
    params.push(userId);
  }

  const examsResult = await pool.query<ExamRowWithClass>(
    `SELECT DISTINCT e.*, c.name AS class_name
     FROM exams e
     JOIN classes c ON c.id = e.class_id
     ${teacherJoin}
     WHERE ${conditions.join(" AND ")}
     ORDER BY e.created_at DESC`,
    params,
  );

  const exams = examsResult.rows;
  if (exams.length === 0) {
    res.status(200).json({ data: [] });
    return;
  }

  const examIds = exams.map((e) => e.id);
  const subjectsResult = await pool.query<ExamSubjectWithNames>(
    `SELECT es.*, s.name AS subject_name, u.name AS teacher_name
     FROM exam_subjects es
     JOIN subjects s ON s.id = es.subject_id
     JOIN users u ON u.id = es.teacher_id
     WHERE es.exam_id = ANY($1::text[]) AND es.tenant_id = $2
     ORDER BY es.exam_date ASC`,
    [examIds, tenantId],
  );

  const subjectsByExam: Record<string, ApiExamSubject[]> = {};
  for (const sub of subjectsResult.rows) {
    if (!subjectsByExam[sub.exam_id]) {
      subjectsByExam[sub.exam_id] = [];
    }
    subjectsByExam[sub.exam_id]!.push(formatExamSubject(sub));
  }

  const data = exams.map((e) => formatExam(e, subjectsByExam[e.id] ?? []));
  res.status(200).json({ data });
}

// ═══════════════════════════════════════════════════════════════════
// GET /exams/:id
// ═══════════════════════════════════════════════════════════════════

export async function getExam(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userRoles = req.userRoles ?? [];
  const { id } = req.params as { id: string };

  const exam = await fetchExamWithClass(id, tenantId);
  if (!exam) {
    send404(res, "Exam not found");
    return;
  }

  // Students and Guardians (without Admin/Teacher role) can only view PUBLISHED exams
  const canViewAllStatuses =
    userRoles.includes("Admin") || userRoles.includes("Teacher");
  if (!canViewAllStatuses && exam.status !== "PUBLISHED") {
    send404(res, "Exam not found");
    return;
  }

  const subjects = await getExamSubjectsWithNames(id, tenantId);
  res.status(200).json({ exam: formatExam(exam, subjects) });
}

// ═══════════════════════════════════════════════════════════════════
// PUT /exams/:id
// ═══════════════════════════════════════════════════════════════════

export async function updateExam(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };

  const existingResult = await pool.query<ExamRow>(
    "SELECT * FROM exams WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  if ((existingResult.rowCount ?? 0) === 0) {
    send404(res, "Exam not found");
    return;
  }
  const existing = existingResult.rows[0]!;

  if (existing.status !== "DRAFT") {
    send409(res, "Exam can only be edited in DRAFT status", "INVALID_STATUS");
    return;
  }

  const { name, type, gradeBoundaries } = req.body as {
    name?: string;
    type?: string;
    gradeBoundaries?: GradeBoundary[];
  };

  if (type !== undefined && !VALID_EXAM_TYPES.includes(type as ExamType)) {
    send400(res, `type must be one of: ${VALID_EXAM_TYPES.join(", ")}`);
    return;
  }

  const updatedName = name !== undefined ? name.trim() : existing.name;
  const updatedType = type !== undefined ? type : existing.type;
  const updatedBoundaries =
    gradeBoundaries !== undefined
      ? JSON.stringify(gradeBoundaries)
      : JSON.stringify(existing.grade_boundaries);

  const updated = await pool.query<ExamRow>(
    `UPDATE exams
     SET name = $1, type = $2, grade_boundaries = $3, updated_at = NOW()
     WHERE id = $4 AND tenant_id = $5
     RETURNING *`,
    [updatedName, updatedType, updatedBoundaries, id, tenantId],
  );

  const classRow = await pool.query<{ name: string }>(
    "SELECT name FROM classes WHERE id = $1",
    [existing.class_id],
  );
  const examWithClass: ExamRowWithClass = {
    ...updated.rows[0]!,
    class_name: classRow.rows[0]?.name ?? "",
  };
  const subjects = await getExamSubjectsWithNames(id, tenantId);
  res.status(200).json({ exam: formatExam(examWithClass, subjects) });
}

// ═══════════════════════════════════════════════════════════════════
// DELETE /exams/:id
// ═══════════════════════════════════════════════════════════════════

export async function deleteExam(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };

  const result = await pool.query<ExamRow>(
    "SELECT * FROM exams WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  if ((result.rowCount ?? 0) === 0) {
    send404(res, "Exam not found");
    return;
  }
  const exam = result.rows[0]!;

  if (exam.status !== "DRAFT") {
    send409(res, "Only DRAFT exams can be deleted", "INVALID_STATUS");
    return;
  }

  await pool.query(
    "UPDATE exams SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2",
    [id, tenantId],
  );
  res.status(204).send();
}

// ═══════════════════════════════════════════════════════════════════
// PUT /exams/:id/publish
// ═══════════════════════════════════════════════════════════════════

export async function publishExam(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const { id } = req.params as { id: string };

  const examResult = await pool.query<ExamRow>(
    "SELECT * FROM exams WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  if ((examResult.rowCount ?? 0) === 0) {
    send404(res, "Exam not found");
    return;
  }
  const exam = examResult.rows[0]!;

  if (exam.status === "PUBLISHED") {
    send409(res, "Exam is already published", "ALREADY_PUBLISHED");
    return;
  }

  // Check all subjects have marks ENTERED (not PENDING)
  const subjectsResult = await pool.query<ExamSubjectRow>(
    "SELECT * FROM exam_subjects WHERE exam_id = $1 AND tenant_id = $2",
    [id, tenantId],
  );
  const subjects = subjectsResult.rows;

  if (subjects.length === 0) {
    send409(res, "Exam has no subjects", "NO_SUBJECTS");
    return;
  }

  const pendingSubjects = subjects.filter((s) => s.marks_status === "PENDING");
  if (pendingSubjects.length > 0) {
    sendError(res, {
      code: "MARKS_NOT_COMPLETE",
      message: "All subjects must have marks entered before publishing",
      details: { pendingSubjects: pendingSubjects.map((s) => s.id) },
      status: 409,
    });
    return;
  }

  const boundaries = exam.grade_boundaries;

  try {
    await withTransaction(async (client) => {
      // Re-fetch with lock inside transaction
      const lockedResult = await client.query<ExamRow>(
        "SELECT * FROM exams WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
        [id, tenantId],
      );
      if ((lockedResult.rowCount ?? 0) === 0) {
        throw Object.assign(new Error("Exam not found"), { code: "NOT_FOUND" });
      }

      // Get all exam results for this exam joined with subject marks info
      type ResultWithSubjectData = ExamResultRow & {
        total_marks: string;
        pass_marks: string;
      };
      const resultsResult = await client.query<ResultWithSubjectData>(
        `SELECT er.*, es.total_marks, es.pass_marks
         FROM exam_results er
         JOIN exam_subjects es ON er.exam_subject_id = es.id
         WHERE es.exam_id = $1 AND er.tenant_id = $2`,
        [id, tenantId],
      );
      const allResults = resultsResult.rows;

      // Compute grade and is_pass for each result and update
      for (const result of allResults) {
        let grade: string;
        let isPass: boolean | null;
        const totalMarks = Number(result.total_marks);
        const passMarks = Number(result.pass_marks);

        if (result.is_absent) {
          grade = "AB";
          isPass = null;
        } else {
          const marksObtained = Number(result.marks_obtained ?? 0);
          const percentage =
            totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0;
          grade = lookupGrade(percentage, boundaries);
          isPass = marksObtained >= passMarks;
        }

        await client.query(
          `UPDATE exam_results
           SET grade = $1, is_pass = $2, updated_at = NOW()
           WHERE id = $3 AND tenant_id = $4`,
          [grade, isPass, result.id, tenantId],
        );
      }

      // Group results by student
      type StudentResultEntry = {
        result: ResultWithSubjectData;
        isAbsent: boolean;
        marksObtained: number;
        totalMarks: number;
        passMarks: number;
        isPass: boolean | null;
      };
      const studentResultsMap: Record<string, StudentResultEntry[]> = {};
      for (const r of allResults) {
        if (!studentResultsMap[r.student_id]) {
          studentResultsMap[r.student_id] = [];
        }
        studentResultsMap[r.student_id]!.push({
          result: r,
          isAbsent: r.is_absent,
          marksObtained: Number(r.marks_obtained ?? 0),
          totalMarks: Number(r.total_marks),
          passMarks: Number(r.pass_marks),
          isPass: r.is_absent
            ? null
            : Number(r.marks_obtained ?? 0) >= Number(r.pass_marks),
        });
      }

      // Compute per-student summaries
      type StudentSummary = {
        studentId: string;
        totalObtained: number;
        totalPossible: number;
        aggregatePercentage: number;
        overallGrade: string;
        overallResult: "PASS" | "FAIL";
        classRank: number;
      };
      const studentSummaries: StudentSummary[] = [];

      for (const [studentId, entries] of Object.entries(studentResultsMap)) {
        const nonAbsent = entries.filter((e) => !e.isAbsent);
        const totalObtained = nonAbsent.reduce(
          (sum, e) => sum + e.marksObtained,
          0,
        );
        const totalPossible = entries.reduce((sum, e) => sum + e.totalMarks, 0);
        const aggregatePercentage =
          totalPossible > 0 ? (totalObtained / totalPossible) * 100 : 0;
        const overallGrade = lookupGrade(aggregatePercentage, boundaries);
        const hasFailure = entries.some(
          (e) => !e.isAbsent && e.isPass === false,
        );
        studentSummaries.push({
          studentId,
          totalObtained,
          totalPossible,
          aggregatePercentage,
          overallGrade,
          overallResult: hasFailure ? "FAIL" : "PASS",
          classRank: 0, // computed below
        });
      }

      // Compute ranks (RANK-style: same rank for ties, skip subsequent)
      studentSummaries.sort(
        (a, b) => b.aggregatePercentage - a.aggregatePercentage,
      );
      let currentRank = 1;
      for (let i = 0; i < studentSummaries.length; i++) {
        if (
          i > 0 &&
          studentSummaries[i]!.aggregatePercentage <
            studentSummaries[i - 1]!.aggregatePercentage
        ) {
          currentRank = i + 1;
        }
        studentSummaries[i]!.classRank = currentRank;
      }

      // Upsert student summaries
      for (const summary of studentSummaries) {
        const summaryId = uuidv4();
        await client.query(
          `INSERT INTO exam_student_summaries
             (id, tenant_id, exam_id, student_id, total_marks_obtained,
              total_marks_possible, aggregate_percentage, overall_grade,
              overall_result, class_rank, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
           ON CONFLICT (exam_id, student_id) DO UPDATE SET
             total_marks_obtained = EXCLUDED.total_marks_obtained,
             total_marks_possible = EXCLUDED.total_marks_possible,
             aggregate_percentage = EXCLUDED.aggregate_percentage,
             overall_grade = EXCLUDED.overall_grade,
             overall_result = EXCLUDED.overall_result,
             class_rank = EXCLUDED.class_rank`,
          [
            summaryId,
            tenantId,
            id,
            summary.studentId,
            summary.totalObtained,
            summary.totalPossible,
            summary.aggregatePercentage,
            summary.overallGrade,
            summary.overallResult,
            summary.classRank,
          ],
        );
      }

      // Update exam status to PUBLISHED
      await client.query(
        `UPDATE exams
         SET status = 'PUBLISHED', published_by = $1, published_at = NOW(), updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        [userId, id, tenantId],
      );

      // Lock all exam_subjects
      await client.query(
        `UPDATE exam_subjects
         SET marks_status = 'LOCKED'
         WHERE exam_id = $1 AND tenant_id = $2`,
        [id, tenantId],
      );
    });
  } catch (err) {
    const error = err as Error & { code?: string };
    if (error.code === "NOT_FOUND") {
      send404(res, "Exam not found");
      return;
    }
    logger.error({ err, action: "exams.publish", examId: id }, error.message);
    throw err;
  }

  const updatedExam = await fetchExamWithClass(id, tenantId);
  const updatedSubjects = await getExamSubjectsWithNames(id, tenantId);
  res.status(200).json({
    exam: formatExam(updatedExam!, updatedSubjects),
  });
}

// ═══════════════════════════════════════════════════════════════════
// PUT /exams/:id/unpublish
// ═══════════════════════════════════════════════════════════════════

export async function unpublishExam(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };

  const result = await pool.query<ExamRow>(
    "SELECT * FROM exams WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  if ((result.rowCount ?? 0) === 0) {
    send404(res, "Exam not found");
    return;
  }
  const exam = result.rows[0]!;

  if (exam.status !== "PUBLISHED") {
    send409(res, "Only PUBLISHED exams can be unpublished", "INVALID_STATUS");
    return;
  }

  await pool.query(
    `UPDATE exams SET status = 'UNPUBLISHED', updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId],
  );
  await pool.query(
    `UPDATE exam_subjects SET marks_status = 'ENTERED'
     WHERE exam_id = $1 AND tenant_id = $2 AND marks_status = 'LOCKED'`,
    [id, tenantId],
  );

  const updatedExam = await fetchExamWithClass(id, tenantId);
  const updatedSubjects = await getExamSubjectsWithNames(id, tenantId);
  res.status(200).json({
    exam: formatExam(updatedExam!, updatedSubjects),
  });
}

// ═══════════════════════════════════════════════════════════════════
// POST /exams/:id/subjects
// ═══════════════════════════════════════════════════════════════════

export async function addExamSubject(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };

  const examResult = await pool.query<ExamRow>(
    "SELECT * FROM exams WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  if ((examResult.rowCount ?? 0) === 0) {
    send404(res, "Exam not found");
    return;
  }

  const {
    subjectId,
    teacherId,
    examDate,
    startTime,
    endTime,
    totalMarks,
    passMarks,
  } = req.body as {
    subjectId?: string;
    teacherId?: string;
    examDate?: string;
    startTime?: string;
    endTime?: string;
    totalMarks?: number;
    passMarks?: number;
  };

  if (!subjectId || typeof subjectId !== "string") {
    send400(res, "subjectId is required");
    return;
  }
  if (!teacherId || typeof teacherId !== "string") {
    send400(res, "teacherId is required");
    return;
  }
  if (!examDate || !DATE_RE.test(examDate)) {
    send400(res, "examDate must be a valid date in YYYY-MM-DD format");
    return;
  }
  if (
    totalMarks === undefined ||
    typeof totalMarks !== "number" ||
    totalMarks <= 0
  ) {
    send400(res, "totalMarks must be a positive number");
    return;
  }
  if (
    passMarks === undefined ||
    typeof passMarks !== "number" ||
    passMarks < 0
  ) {
    send400(res, "passMarks must be a non-negative number");
    return;
  }
  if (passMarks > totalMarks) {
    send400(res, "passMarks must not exceed totalMarks");
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

  // Verify teacher exists in tenant
  const teacherCheck = await pool.query(
    "SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [teacherId, tenantId],
  );
  if ((teacherCheck.rowCount ?? 0) === 0) {
    send404(res, "Teacher not found");
    return;
  }

  // Check for duplicate subject in this exam
  const dupCheck = await pool.query(
    "SELECT id FROM exam_subjects WHERE exam_id = $1 AND subject_id = $2 AND tenant_id = $3",
    [id, subjectId, tenantId],
  );
  if ((dupCheck.rowCount ?? 0) > 0) {
    send409(res, "Subject already added to this exam", "CONFLICT");
    return;
  }

  const subjectRowId = uuidv4();
  await pool.query(
    `INSERT INTO exam_subjects
       (id, tenant_id, exam_id, subject_id, teacher_id, exam_date,
        start_time, end_time, total_marks, pass_marks, marks_status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING', NOW())`,
    [
      subjectRowId,
      tenantId,
      id,
      subjectId,
      teacherId,
      examDate,
      startTime ?? null,
      endTime ?? null,
      totalMarks,
      passMarks,
    ],
  );

  const insertedResult = await pool.query<ExamSubjectWithNames>(
    `SELECT es.*, s.name AS subject_name, u.name AS teacher_name
     FROM exam_subjects es
     JOIN subjects s ON s.id = es.subject_id
     JOIN users u ON u.id = es.teacher_id
     WHERE es.id = $1`,
    [subjectRowId],
  );

  res
    .status(201)
    .json({ examSubject: formatExamSubject(insertedResult.rows[0]!) });
}

// ═══════════════════════════════════════════════════════════════════
// PUT /exams/:id/subjects/:subjectId
// ═══════════════════════════════════════════════════════════════════

export async function updateExamSubject(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { id, subjectId } = req.params as { id: string; subjectId: string };

  const examResult = await pool.query<ExamRow>(
    "SELECT * FROM exams WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  if ((examResult.rowCount ?? 0) === 0) {
    send404(res, "Exam not found");
    return;
  }
  const exam = examResult.rows[0]!;

  if (exam.status === "PUBLISHED") {
    send409(res, "Cannot edit subjects of a published exam", "INVALID_STATUS");
    return;
  }

  const esResult = await pool.query<ExamSubjectRow>(
    "SELECT * FROM exam_subjects WHERE id = $1 AND exam_id = $2 AND tenant_id = $3",
    [subjectId, id, tenantId],
  );
  if ((esResult.rowCount ?? 0) === 0) {
    send404(res, "Exam subject not found");
    return;
  }
  const es = esResult.rows[0]!;

  const { teacherId, examDate, startTime, endTime, totalMarks, passMarks } =
    req.body as {
      teacherId?: string;
      examDate?: string;
      startTime?: string | null;
      endTime?: string | null;
      totalMarks?: number;
      passMarks?: number;
    };

  if (examDate !== undefined && !DATE_RE.test(examDate)) {
    send400(res, "examDate must be a valid date in YYYY-MM-DD format");
    return;
  }

  if (teacherId !== undefined) {
    const teacherCheck = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [teacherId, tenantId],
    );
    if ((teacherCheck.rowCount ?? 0) === 0) {
      send404(res, "Teacher not found");
      return;
    }
  }

  const resolvedTotalMarks =
    totalMarks !== undefined ? totalMarks : Number(es.total_marks);
  const resolvedPassMarks =
    passMarks !== undefined ? passMarks : Number(es.pass_marks);

  if (resolvedPassMarks > resolvedTotalMarks) {
    send400(res, "passMarks must not exceed totalMarks");
    return;
  }

  await pool.query(
    `UPDATE exam_subjects
     SET teacher_id = $1, exam_date = $2, start_time = $3, end_time = $4,
         total_marks = $5, pass_marks = $6
     WHERE id = $7 AND tenant_id = $8`,
    [
      teacherId ?? es.teacher_id,
      examDate ?? String(es.exam_date).slice(0, 10),
      startTime !== undefined ? startTime : es.start_time,
      endTime !== undefined ? endTime : es.end_time,
      resolvedTotalMarks,
      resolvedPassMarks,
      subjectId,
      tenantId,
    ],
  );

  const updatedResult = await pool.query<ExamSubjectWithNames>(
    `SELECT es.*, s.name AS subject_name, u.name AS teacher_name
     FROM exam_subjects es
     JOIN subjects s ON s.id = es.subject_id
     JOIN users u ON u.id = es.teacher_id
     WHERE es.id = $1`,
    [subjectId],
  );
  res
    .status(200)
    .json({ examSubject: formatExamSubject(updatedResult.rows[0]!) });
}

// ═══════════════════════════════════════════════════════════════════
// DELETE /exams/:id/subjects/:subjectId
// ═══════════════════════════════════════════════════════════════════

export async function removeExamSubject(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { id, subjectId } = req.params as { id: string; subjectId: string };

  const examResult = await pool.query<ExamRow>(
    "SELECT * FROM exams WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  if ((examResult.rowCount ?? 0) === 0) {
    send404(res, "Exam not found");
    return;
  }
  const exam = examResult.rows[0]!;

  if (exam.status !== "DRAFT") {
    send409(
      res,
      "Subjects can only be removed from DRAFT exams",
      "INVALID_STATUS",
    );
    return;
  }

  const esResult = await pool.query(
    "SELECT id FROM exam_subjects WHERE id = $1 AND exam_id = $2 AND tenant_id = $3",
    [subjectId, id, tenantId],
  );
  if ((esResult.rowCount ?? 0) === 0) {
    send404(res, "Exam subject not found");
    return;
  }

  // Hard delete — cascades to exam_results
  await pool.query(
    "DELETE FROM exam_subjects WHERE id = $1 AND tenant_id = $2",
    [subjectId, tenantId],
  );
  res.status(204).send();
}

// ═══════════════════════════════════════════════════════════════════
// GET /exams/:id/subjects/:subjectId/marks
// ═══════════════════════════════════════════════════════════════════

export async function getMarks(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRoles = req.userRoles ?? [];
  const isAdmin = userRoles.includes("Admin");
  const { id, subjectId } = req.params as { id: string; subjectId: string };

  const examResult = await pool.query<ExamRow>(
    "SELECT * FROM exams WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  if ((examResult.rowCount ?? 0) === 0) {
    send404(res, "Exam not found");
    return;
  }
  const exam = examResult.rows[0]!;

  const esResult = await pool.query<ExamSubjectWithNames>(
    `SELECT es.*, s.name AS subject_name, u.name AS teacher_name
     FROM exam_subjects es
     JOIN subjects s ON s.id = es.subject_id
     JOIN users u ON u.id = es.teacher_id
     WHERE es.id = $1 AND es.exam_id = $2 AND es.tenant_id = $3`,
    [subjectId, id, tenantId],
  );
  if ((esResult.rowCount ?? 0) === 0) {
    send404(res, "Exam subject not found");
    return;
  }
  const es = esResult.rows[0]!;

  // Teacher can only view their own subject
  if (!isAdmin && es.teacher_id !== userId) {
    send403(res, "You are not assigned to this subject");
    return;
  }

  // Get all active students for the class
  const studentsResult = await pool.query<StudentBasicRow>(
    `SELECT id, name, admission_number
     FROM students
     WHERE class_id = $1 AND tenant_id = $2 AND status = 'Active' AND deleted_at IS NULL
     ORDER BY name ASC`,
    [exam.class_id, tenantId],
  );

  // Get existing results for this subject
  const resultsResult = await pool.query<ExamResultRow>(
    "SELECT * FROM exam_results WHERE exam_subject_id = $1 AND tenant_id = $2",
    [subjectId, tenantId],
  );
  const resultsByStudent: Record<string, ExamResultRow> = {};
  for (const r of resultsResult.rows) {
    resultsByStudent[r.student_id] = r;
  }

  const studentMarks = studentsResult.rows.map((student) => {
    const result = resultsByStudent[student.id];
    return {
      studentId: student.id,
      studentName: student.name,
      admissionNumber: student.admission_number,
      marksObtained: result?.marks_obtained ?? null,
      isAbsent: result?.is_absent ?? false,
      grade: result?.grade ?? null,
      isPass: result?.is_pass ?? null,
    };
  });

  res.status(200).json({
    examSubject: formatExamSubject(es),
    students: studentMarks,
  });
}

// ═══════════════════════════════════════════════════════════════════
// PUT /exams/:id/subjects/:subjectId/marks
// ═══════════════════════════════════════════════════════════════════

export async function enterMarks(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRoles = req.userRoles ?? [];
  const isAdmin = userRoles.includes("Admin");
  const { id, subjectId } = req.params as { id: string; subjectId: string };

  const examResult = await pool.query<ExamRow>(
    "SELECT * FROM exams WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  if ((examResult.rowCount ?? 0) === 0) {
    send404(res, "Exam not found");
    return;
  }
  const exam = examResult.rows[0]!;

  if (exam.status === "PUBLISHED") {
    send409(res, "Cannot enter marks for a published exam", "EXAM_PUBLISHED");
    return;
  }

  const esResult = await pool.query<ExamSubjectRow>(
    "SELECT * FROM exam_subjects WHERE id = $1 AND exam_id = $2 AND tenant_id = $3",
    [subjectId, id, tenantId],
  );
  if ((esResult.rowCount ?? 0) === 0) {
    send404(res, "Exam subject not found");
    return;
  }
  const es = esResult.rows[0]!;

  if (!isAdmin && es.teacher_id !== userId) {
    send403(res, "You are not assigned to this subject");
    return;
  }

  const { students } = req.body as {
    students?: Array<{
      studentId: string;
      marksObtained: number | null;
      isAbsent: boolean;
    }>;
  };

  if (!Array.isArray(students) || students.length === 0) {
    send400(res, "students array is required");
    return;
  }

  const totalMarks = Number(es.total_marks);
  for (const entry of students) {
    if (!entry.studentId || typeof entry.studentId !== "string") {
      send400(res, "Each student entry must have a studentId");
      return;
    }
    if (
      !entry.isAbsent &&
      (entry.marksObtained === null || entry.marksObtained === undefined)
    ) {
      send400(
        res,
        `marksObtained is required for present student (${entry.studentId})`,
      );
      return;
    }
    if (
      !entry.isAbsent &&
      typeof entry.marksObtained === "number" &&
      entry.marksObtained > totalMarks
    ) {
      send400(
        res,
        `marksObtained (${entry.marksObtained}) exceeds totalMarks (${totalMarks}) for student ${entry.studentId}`,
      );
      return;
    }
  }

  let updatedCount = 0;
  for (const entry of students) {
    const resultId = uuidv4();
    await pool.query(
      `INSERT INTO exam_results
         (id, tenant_id, exam_subject_id, student_id, marks_obtained, is_absent,
          entered_by, entered_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())
       ON CONFLICT (exam_subject_id, student_id) DO UPDATE SET
         marks_obtained = EXCLUDED.marks_obtained,
         is_absent = EXCLUDED.is_absent,
         entered_by = EXCLUDED.entered_by,
         entered_at = NOW(),
         updated_at = NOW()`,
      [
        resultId,
        tenantId,
        subjectId,
        entry.studentId,
        entry.isAbsent ? null : entry.marksObtained,
        entry.isAbsent,
        userId,
      ],
    );
    updatedCount++;
  }

  // Check if all active students now have results — if so set marks_status = 'ENTERED'
  const totalStudentsResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM students
     WHERE class_id = $1 AND tenant_id = $2 AND status = 'Active' AND deleted_at IS NULL`,
    [exam.class_id, tenantId],
  );
  const totalStudents = parseInt(totalStudentsResult.rows[0]?.count ?? "0", 10);
  const enteredCountResult = await pool.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM exam_results WHERE exam_subject_id = $1 AND tenant_id = $2",
    [subjectId, tenantId],
  );
  const enteredCount = parseInt(enteredCountResult.rows[0]?.count ?? "0", 10);

  if (totalStudents > 0 && enteredCount >= totalStudents) {
    await pool.query(
      "UPDATE exam_subjects SET marks_status = 'ENTERED' WHERE id = $1 AND tenant_id = $2",
      [subjectId, tenantId],
    );
  }

  res.status(200).json({ updated: updatedCount });
}

// ═══════════════════════════════════════════════════════════════════
// GET /exams/:id/results
// ═══════════════════════════════════════════════════════════════════

export async function getResults(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };

  const examResult = await pool.query<ExamRow>(
    "SELECT * FROM exams WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  if ((examResult.rowCount ?? 0) === 0) {
    send404(res, "Exam not found");
    return;
  }
  const exam = examResult.rows[0]!;

  if (exam.status !== "PUBLISHED") {
    send409(
      res,
      "Results are only available for published exams",
      "NOT_PUBLISHED",
    );
    return;
  }

  const subjectsResult = await pool.query<ExamSubjectWithNames>(
    `SELECT es.*, s.name AS subject_name, u.name AS teacher_name
     FROM exam_subjects es
     JOIN subjects s ON s.id = es.subject_id
     JOIN users u ON u.id = es.teacher_id
     WHERE es.exam_id = $1 AND es.tenant_id = $2
     ORDER BY es.exam_date ASC`,
    [id, tenantId],
  );

  const resultsResult = await pool.query<ExamResultRow>(
    `SELECT er.*
     FROM exam_results er
     JOIN exam_subjects es ON er.exam_subject_id = es.id
     WHERE es.exam_id = $1 AND er.tenant_id = $2`,
    [id, tenantId],
  );

  const summariesResult = await pool.query<ExamStudentSummaryWithStudent>(
    `SELECT ess.*, s.name AS student_name, s.admission_number
     FROM exam_student_summaries ess
     JOIN students s ON s.id = ess.student_id
     WHERE ess.exam_id = $1 AND ess.tenant_id = $2
     ORDER BY ess.class_rank ASC NULLS LAST, s.name ASC`,
    [id, tenantId],
  );

  // Group results by student
  const resultsByStudent: Record<string, ExamResultRow[]> = {};
  for (const r of resultsResult.rows) {
    if (!resultsByStudent[r.student_id]) {
      resultsByStudent[r.student_id] = [];
    }
    resultsByStudent[r.student_id]!.push(r);
  }

  const subjects = subjectsResult.rows.map((s) => ({
    subjectId: s.subject_id,
    subjectName: s.subject_name,
    totalMarks: Number(s.total_marks),
    passMarks: Number(s.pass_marks),
  }));

  const students = summariesResult.rows.map((summary) => {
    const studentResults = resultsByStudent[summary.student_id] ?? [];
    const results: ApiExamResult[] = studentResults.map((r) => ({
      examSubjectId: r.exam_subject_id,
      marksObtained: r.marks_obtained,
      isAbsent: r.is_absent,
      grade: r.grade,
      isPass: r.is_pass,
    }));
    return {
      studentId: summary.student_id,
      studentName: summary.student_name,
      admissionNumber: summary.admission_number,
      results,
      summary: {
        totalMarksObtained: Number(summary.total_marks_obtained),
        totalMarksPossible: Number(summary.total_marks_possible),
        aggregatePercentage: Number(summary.aggregate_percentage),
        overallGrade: summary.overall_grade,
        overallResult: summary.overall_result,
        classRank: summary.class_rank,
      },
    };
  });

  const consolidatedResults: ApiConsolidatedResults = {
    examId: id,
    subjects,
    students,
  };

  res.status(200).json({ results: consolidatedResults });
}

// ═══════════════════════════════════════════════════════════════════
// GET /exams/:id/results/:studentId
// ═══════════════════════════════════════════════════════════════════

export async function getStudentResult(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRoles = req.userRoles ?? [];
  const isAdmin = userRoles.includes("Admin");
  const isTeacher = userRoles.includes("Teacher");
  const isStudent = userRoles.includes("Student") && !isAdmin && !isTeacher;
  const isGuardian = userRoles.includes("Guardian") && !isAdmin && !isTeacher;
  const { id, studentId } = req.params as { id: string; studentId: string };

  const examResult = await pool.query<ExamRow>(
    "SELECT * FROM exams WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  if ((examResult.rowCount ?? 0) === 0) {
    send404(res, "Exam not found");
    return;
  }
  const exam = examResult.rows[0]!;

  if (exam.status !== "PUBLISHED") {
    send404(res, "Exam not found");
    return;
  }

  // Access control
  if (isStudent) {
    const myStudent = await pool.query<{ id: string }>(
      "SELECT id FROM students WHERE user_id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [userId, tenantId],
    );
    if (myStudent.rows[0]?.id !== studentId) {
      send403(res, "You can only view your own results");
      return;
    }
  } else if (isGuardian) {
    const guardianCheck = await pool.query(
      `SELECT 1 FROM student_guardians sg
       JOIN guardians g ON g.id = sg.guardian_id
       WHERE g.user_id = $1 AND sg.student_id = $2 AND g.tenant_id = $3 AND g.deleted_at IS NULL`,
      [userId, studentId, tenantId],
    );
    if ((guardianCheck.rowCount ?? 0) === 0) {
      send403(res, "You are not authorized to view this student's results");
      return;
    }
  }

  const studentRow = await pool.query<{
    name: string;
    admission_number: string;
  }>(
    "SELECT name, admission_number FROM students WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [studentId, tenantId],
  );
  if ((studentRow.rowCount ?? 0) === 0) {
    send404(res, "Student not found");
    return;
  }

  const resultsResult = await pool.query<ExamResultRow>(
    `SELECT er.*
     FROM exam_results er
     JOIN exam_subjects es ON er.exam_subject_id = es.id
     WHERE es.exam_id = $1 AND er.student_id = $2 AND er.tenant_id = $3`,
    [id, studentId, tenantId],
  );

  const summaryResult = await pool.query<ExamStudentSummaryRow>(
    "SELECT * FROM exam_student_summaries WHERE exam_id = $1 AND student_id = $2 AND tenant_id = $3",
    [id, studentId, tenantId],
  );
  const summary = summaryResult.rows[0];

  const results: ApiExamResult[] = resultsResult.rows.map((r) => ({
    examSubjectId: r.exam_subject_id,
    marksObtained: r.marks_obtained,
    isAbsent: r.is_absent,
    grade: r.grade,
    isPass: r.is_pass,
  }));

  res.status(200).json({
    studentId,
    studentName: studentRow.rows[0]?.name ?? "",
    admissionNumber: studentRow.rows[0]?.admission_number ?? "",
    results,
    summary: summary
      ? {
          totalMarksObtained: Number(summary.total_marks_obtained),
          totalMarksPossible: Number(summary.total_marks_possible),
          aggregatePercentage: Number(summary.aggregate_percentage),
          overallGrade: summary.overall_grade,
          overallResult: summary.overall_result,
          classRank: summary.class_rank,
        }
      : null,
  });
}

// ═══════════════════════════════════════════════════════════════════
// POST /external-results
// ═══════════════════════════════════════════════════════════════════

export async function createExternalResult(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;

  const {
    studentId,
    sessionId,
    examName,
    conductedBy,
    resultSummary,
    documentUrl,
  } = req.body as {
    studentId?: string;
    sessionId?: string;
    examName?: string;
    conductedBy?: string;
    resultSummary?: string;
    documentUrl?: string;
  };

  if (!studentId || typeof studentId !== "string") {
    send400(res, "studentId is required");
    return;
  }
  if (!sessionId || typeof sessionId !== "string") {
    send400(res, "sessionId is required");
    return;
  }
  if (
    !examName ||
    typeof examName !== "string" ||
    examName.trim().length === 0
  ) {
    send400(res, "examName is required");
    return;
  }
  if (
    !conductedBy ||
    typeof conductedBy !== "string" ||
    conductedBy.trim().length === 0
  ) {
    send400(res, "conductedBy is required");
    return;
  }

  // Verify student exists
  const studentCheck = await pool.query(
    "SELECT id FROM students WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [studentId, tenantId],
  );
  if ((studentCheck.rowCount ?? 0) === 0) {
    send404(res, "Student not found");
    return;
  }

  const id = uuidv4();
  await pool.query(
    `INSERT INTO external_results
       (id, tenant_id, student_id, session_id, exam_name, conducted_by,
        result_summary, document_url, recorded_by, recorded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    [
      id,
      tenantId,
      studentId,
      sessionId,
      examName.trim(),
      conductedBy.trim(),
      resultSummary ?? null,
      documentUrl ?? null,
      userId,
    ],
  );

  const inserted = await pool.query<
    ExternalResultRow & { student_name: string }
  >(
    `SELECT er.*, s.name AS student_name
     FROM external_results er
     JOIN students s ON s.id = er.student_id
     WHERE er.id = $1`,
    [id],
  );

  res
    .status(201)
    .json({ externalResult: formatExternalResult(inserted.rows[0]!) });
}

// ═══════════════════════════════════════════════════════════════════
// GET /external-results
// ═══════════════════════════════════════════════════════════════════

export async function listExternalResults(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRoles = req.userRoles ?? [];
  const isAdmin = userRoles.includes("Admin");
  const isTeacher = userRoles.includes("Teacher");
  const isStudent = userRoles.includes("Student") && !isAdmin && !isTeacher;
  const isGuardian = userRoles.includes("Guardian") && !isAdmin && !isTeacher;

  const { sessionId, studentId: studentIdFilter } = req.query as {
    sessionId?: string;
    studentId?: string;
  };

  const conditions: string[] = ["er.tenant_id = $1"];
  const params: unknown[] = [tenantId];
  let paramIdx = 2;

  if (sessionId) {
    conditions.push(`er.session_id = $${paramIdx++}`);
    params.push(sessionId);
  }

  if (isStudent) {
    // Students can only see their own
    const myStudent = await pool.query<{ id: string }>(
      "SELECT id FROM students WHERE user_id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [userId, tenantId],
    );
    const myStudentId = myStudent.rows[0]?.id;
    if (!myStudentId) {
      res.status(200).json({ data: [] });
      return;
    }
    conditions.push(`er.student_id = $${paramIdx++}`);
    params.push(myStudentId);
  } else if (isGuardian) {
    // Guardians can only see their children's results
    const childrenResult = await pool.query<{ id: string }>(
      `SELECT s.id FROM students s
       JOIN student_guardians sg ON sg.student_id = s.id
       JOIN guardians g ON g.id = sg.guardian_id
       WHERE g.user_id = $1 AND g.tenant_id = $2 AND g.deleted_at IS NULL AND s.deleted_at IS NULL`,
      [userId, tenantId],
    );
    const childIds = childrenResult.rows.map((r) => r.id);
    if (childIds.length === 0) {
      res.status(200).json({ data: [] });
      return;
    }
    conditions.push(`er.student_id = ANY($${paramIdx++}::text[])`);
    params.push(childIds);
  } else if (studentIdFilter) {
    conditions.push(`er.student_id = $${paramIdx++}`);
    params.push(studentIdFilter);
  }

  const result = await pool.query<ExternalResultRow & { student_name: string }>(
    `SELECT er.*, s.name AS student_name
     FROM external_results er
     JOIN students s ON s.id = er.student_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY er.recorded_at DESC`,
    params,
  );

  res.status(200).json({ data: result.rows.map(formatExternalResult) });
}

// ═══════════════════════════════════════════════════════════════════
// DELETE /external-results/:id
// ═══════════════════════════════════════════════════════════════════

export async function deleteExternalResult(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };

  const result = await pool.query(
    "SELECT id FROM external_results WHERE id = $1 AND tenant_id = $2",
    [id, tenantId],
  );
  if ((result.rowCount ?? 0) === 0) {
    send404(res, "External result not found");
    return;
  }

  await pool.query(
    "DELETE FROM external_results WHERE id = $1 AND tenant_id = $2",
    [id, tenantId],
  );
  res.status(204).send();
}
