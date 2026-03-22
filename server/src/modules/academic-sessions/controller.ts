/**
 * Academic Sessions Controller (v5.0)
 *
 * Manages the lifecycle of academic sessions: UPCOMING → ACTIVE → COMPLETED.
 * One ACTIVE session per tenant at a time (enforced by DB partial unique index and app logic).
 *
 * Routes (all tenant-scoped):
 *   POST   /academic-sessions                          — create (Admin)
 *   GET    /academic-sessions                          — list (Admin)
 *   GET    /academic-sessions/current                  — current ACTIVE session (all roles)
 *   PUT    /academic-sessions/:id/activate             — activate (Admin)
 *   PUT    /academic-sessions/:id/close                — close → COMPLETED (Admin)
 *   POST   /academic-sessions/:id/copy-timetable       — copy timeslots from another session (Admin)
 *   POST   /academic-sessions/:id/transition/preview   — batch promotion preview (Admin)
 *   POST   /academic-sessions/:id/transition/commit    — commit promotion (Admin)
 *   POST   /promotions/:id/rollback                    — rollback a committed promotion (Admin)
 */

import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../../db/pool";
import {
  send400,
  send403,
  send404,
  send409,
  sendError,
} from "../../utils/errors";
import {
  AcademicSessionRow,
  AcademicSessionStatus,
  ApiAcademicSession,
  PromotionLogRow,
  PromotionPreviewRow,
} from "../../types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Level progression for batch promotion preview (StudentLevel enum order)
const LEVEL_PROGRESSION: Record<string, string | null> = {
  Std8: "Std9",
  Std9: "Std10",
  Std10: "PlusOne",
  PlusOne: "PlusTwo",
  PlusTwo: "Degree1",
  Degree1: "Degree2",
  Degree2: "Degree3",
  Degree3: "PG1",
  PG1: "PG2",
  PG2: null,
};

function formatSession(r: AcademicSessionRow): ApiAcademicSession {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    status: r.status,
    startDate: String(r.start_date).slice(0, 10),
    endDate: String(r.end_date).slice(0, 10),
    // H-05: is_current is optional on the type (computed column not in DB schema);
    // fall back to deriving from status when the query does not include it.
    isCurrent: r.is_current ?? r.status === "ACTIVE",
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
    updatedAt:
      r.updated_at instanceof Date
        ? r.updated_at.toISOString()
        : String(r.updated_at),
  };
}

// ─── POST /academic-sessions ────────────────────────────────────────────────

export async function createSession(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { name, startDate, endDate } = req.body as {
    name?: string;
    startDate?: string;
    endDate?: string;
  };

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    send400(res, "name is required");
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
  if (endDate <= startDate) {
    send400(res, "endDate must be after startDate");
    return;
  }

  const id = uuidv4();
  const result = await pool.query<AcademicSessionRow>(
    `INSERT INTO academic_sessions (id, tenant_id, name, status, start_date, end_date)
     VALUES ($1, $2, $3, 'UPCOMING', $4, $5)
     RETURNING *`,
    [id, tenantId, name.trim(), startDate, endDate],
  );

  res.status(201).json({ session: formatSession(result.rows[0]!) });
}

// ─── GET /academic-sessions ─────────────────────────────────────────────────

export async function listSessions(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;

  const result = await pool.query<AcademicSessionRow>(
    `SELECT * FROM academic_sessions
     WHERE tenant_id = $1 AND deleted_at IS NULL
     ORDER BY start_date DESC`,
    [tenantId],
  );

  res.status(200).json({
    sessions: result.rows.map(formatSession),
    total: result.rowCount ?? 0,
  });
}

// ─── GET /academic-sessions/current ─────────────────────────────────────────

export async function getCurrentSession(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;

  const result = await pool.query<AcademicSessionRow>(
    `SELECT * FROM academic_sessions
     WHERE tenant_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
     LIMIT 1`,
    [tenantId],
  );

  if (!result.rows[0]) {
    // H-06: OpenAPI requires 404 with NO_ACTIVE_SESSION when no session is active
    sendError(res, {
      code: "NO_ACTIVE_SESSION",
      message: "No session is currently active",
      status: 404,
    });
    return;
  }

  res.status(200).json({ data: formatSession(result.rows[0]) });
}

// ─── PUT /academic-sessions/:id/activate ────────────────────────────────────

export async function activateSession(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  const sessionResult = await pool.query<AcademicSessionRow>(
    "SELECT * FROM academic_sessions WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  const session = sessionResult.rows[0];
  if (!session) {
    send404(res, "Academic session not found");
    return;
  }
  if (session.status === "ACTIVE") {
    send409(res, "Session is already ACTIVE", "CONFLICT");
    return;
  }
  if (session.status === "COMPLETED") {
    send409(res, "Cannot activate a COMPLETED session", "CONFLICT");
    return;
  }

  // Check no other ACTIVE session exists for this tenant
  const activeCheck = await pool.query<{ id: string }>(
    "SELECT id FROM academic_sessions WHERE tenant_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL AND id != $2 LIMIT 1",
    [tenantId, id],
  );
  if (activeCheck.rows[0]) {
    send409(
      res,
      "Another session is already ACTIVE. Close it first.",
      "SESSION_ALREADY_ACTIVE",
    );
    return;
  }

  const updated = await pool.query<AcademicSessionRow>(
    `UPDATE academic_sessions
     SET status = 'ACTIVE', updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [id, tenantId],
  );

  res.status(200).json({ session: formatSession(updated.rows[0]!) });
}

// ─── PUT /academic-sessions/:id/close ───────────────────────────────────────

export async function closeSession(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  const sessionResult = await pool.query<AcademicSessionRow>(
    "SELECT * FROM academic_sessions WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  const session = sessionResult.rows[0];
  if (!session) {
    send404(res, "Academic session not found");
    return;
  }
  if (session.status === "COMPLETED") {
    send409(res, "Session is already COMPLETED", "CONFLICT");
    return;
  }

  const updated = await pool.query<AcademicSessionRow>(
    `UPDATE academic_sessions
     SET status = 'COMPLETED', updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [id, tenantId],
  );

  res.status(200).json({ session: formatSession(updated.rows[0]!) });
}

// ─── POST /academic-sessions/:id/copy-timetable ─────────────────────────────
// Copies all active timeslots from sourceSessionId's classes to target session's
// classes. Matches classes by (batch_id, level, section) across sessions.

export async function copyTimetable(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { id: targetSessionId } = req.params;
  // C-04: OpenAPI requires `fromSessionId` (not `sourceSessionId`)
  const { fromSessionId } = req.body as { fromSessionId?: string };

  if (!fromSessionId || typeof fromSessionId !== "string") {
    send400(res, "fromSessionId is required");
    return;
  }
  if (fromSessionId === targetSessionId) {
    send400(res, "fromSessionId must differ from the target session");
    return;
  }

  // Verify both sessions belong to this tenant
  const sessionsResult = await pool.query<AcademicSessionRow>(
    `SELECT id, status FROM academic_sessions
     WHERE id = ANY($1::uuid[]) AND tenant_id = $2 AND deleted_at IS NULL`,
    [[fromSessionId, targetSessionId], tenantId],
  );
  const sessions = sessionsResult.rows;
  const source = sessions.find((s) => s.id === fromSessionId);
  const target = sessions.find((s) => s.id === targetSessionId);

  if (!source) {
    send404(res, "Source session not found");
    return;
  }
  if (!target) {
    send404(res, "Target session not found");
    return;
  }

  // Copy timeslots by matching source class → target class on (batch_id, level, section)
  const result = await pool.query<{ copied: number }>(
    `WITH source_slots AS (
       SELECT ts.subject_id, ts.teacher_id, ts.day_of_week, ts.period_number,
              c.batch_id, c.level, c.section
       FROM timeslots ts
       JOIN classes c ON c.id = ts.class_id
       WHERE c.session_id = $1
         AND c.tenant_id = $3
         AND ts.tenant_id = $3
         AND ts.deleted_at IS NULL
         AND c.deleted_at IS NULL
     ),
     target_classes AS (
       SELECT id, batch_id, level, section
       FROM classes
       WHERE session_id = $2 AND tenant_id = $3 AND deleted_at IS NULL
     ),
     matched AS (
       SELECT tc.id AS target_class_id,
              ss.subject_id, ss.teacher_id, ss.day_of_week, ss.period_number
       FROM source_slots ss
       JOIN target_classes tc
         ON tc.batch_id = ss.batch_id
        AND tc.level = ss.level
        AND COALESCE(tc.section, '') = COALESCE(ss.section, '')
     ),
     inserted AS (
       INSERT INTO timeslots (id, tenant_id, class_id, subject_id, teacher_id, day_of_week, period_number)
       SELECT gen_random_uuid()::text, $3, target_class_id, subject_id, teacher_id, day_of_week, period_number
       FROM matched
       ON CONFLICT DO NOTHING
       RETURNING id
     )
     SELECT COUNT(*) AS copied FROM inserted`,
    [fromSessionId, targetSessionId, tenantId],
  );

  const copied = parseInt(String(result.rows[0]?.copied ?? 0), 10);
  res.status(200).json({ copied });
}

// ─── POST /academic-sessions/:id/transition/preview ─────────────────────────
// Generates a promotion preview (per-batch list of students to promote).
// Preview expires in 10 minutes (enforced at commit time).
// C-05: Body requires `toSessionId`; response uses `promotionPreviewId`.

export async function transitionPreview(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const { id: sessionId } = req.params;
  // C-05: OpenAPI requires `toSessionId` in the request body
  const { toSessionId } = req.body as { toSessionId?: string };

  if (!toSessionId || typeof toSessionId !== "string") {
    send400(res, "toSessionId is required");
    return;
  }
  if (toSessionId === sessionId) {
    send400(res, "toSessionId must differ from the source session");
    return;
  }

  const sessionResult = await pool.query<AcademicSessionRow>(
    "SELECT * FROM academic_sessions WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [sessionId, tenantId],
  );
  const session = sessionResult.rows[0];
  if (!session) {
    send404(res, "Academic session not found");
    return;
  }
  if (session.status !== "ACTIVE") {
    send409(
      res,
      "Only the ACTIVE session can be transitioned",
      "SESSION_NOT_ACTIVE",
    );
    return;
  }

  // Validate target session belongs to tenant
  const targetResult = await pool.query<AcademicSessionRow>(
    "SELECT id FROM academic_sessions WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [toSessionId, tenantId],
  );
  if (!targetResult.rows[0]) {
    send404(res, "Target session not found");
    return;
  }

  // Query active students in each class for the active session, including class level
  const studentsResult = await pool.query<{
    batch_id: string;
    batch_name: string;
    class_id: string;
    level: string | null;
    student_id: string;
    student_name: string;
  }>(
    `SELECT b.id AS batch_id, b.name AS batch_name,
            c.id AS class_id, c.level,
            s.id AS student_id, s.name AS student_name
     FROM classes c
     JOIN batches b ON b.id = c.batch_id
     JOIN students s ON s.class_id = c.id AND s.tenant_id = $2 AND s.deleted_at IS NULL AND s.status = 'Active'
     WHERE c.session_id = $1
       AND c.tenant_id = $2
       AND c.deleted_at IS NULL
       AND b.deleted_at IS NULL
     ORDER BY b.name, c.level, s.name`,
    [sessionId, tenantId],
  );

  // Group by batch — store currentClassId in preview_data for use during commit
  const batchMap = new Map<
    string,
    {
      batchId: string;
      batchName: string;
      currentLevel: string | null;
      students: Array<{
        studentId: string;
        name: string;
        include: boolean;
        currentClassId: string;
      }>;
    }
  >();

  for (const row of studentsResult.rows) {
    if (!batchMap.has(row.batch_id)) {
      batchMap.set(row.batch_id, {
        batchId: row.batch_id,
        batchName: row.batch_name,
        currentLevel: row.level,
        students: [],
      });
    }
    batchMap.get(row.batch_id)!.students.push({
      studentId: row.student_id,
      name: row.student_name,
      include: true,
      currentClassId: row.class_id,
    });
  }

  const batchesForPreview = Array.from(batchMap.values());

  // Store full preview data (including currentClassId) for commit use
  const previewData = {
    toSessionId,
    sourceSessionId: sessionId,
    createdBy: userId,
    batches: batchesForPreview,
  };

  const promotionPreviewId = uuidv4();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await pool.query(
    `INSERT INTO promotion_previews (id, tenant_id, source_session_id, preview_data, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      promotionPreviewId,
      tenantId,
      sessionId,
      JSON.stringify(previewData),
      expiresAt,
    ],
  );

  // C-05: Response shape per OpenAPI — batches include currentLevel, nextLevel,
  // activeStudentCount, and students[{ studentId, name, include }]
  const responseBatches = batchesForPreview.map((batch) => ({
    batchId: batch.batchId,
    batchName: batch.batchName,
    currentLevel: batch.currentLevel,
    nextLevel: batch.currentLevel
      ? (LEVEL_PROGRESSION[batch.currentLevel] ?? null)
      : null,
    activeStudentCount: batch.students.length,
    students: batch.students.map(({ studentId, name, include }) => ({
      studentId,
      name,
      include,
    })),
  }));

  // C-05: Return HTTP 200 (not 201) with promotionPreviewId (not previewId)
  res.json({
    data: {
      promotionPreviewId,
      expiresAt: expiresAt.toISOString(),
      batches: responseBatches,
    },
  });
}

// ─── POST /academic-sessions/:id/transition/commit ───────────────────────────
// Commits a promotion based on a valid (non-expired) preview.
// C-06: Accepts { promotionPreviewId, batches[{ batchId, promotedStudentIds, skippedStudentIds }] }
// Only promotes students listed in promotedStudentIds; skips those in skippedStudentIds.

export async function transitionCommit(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const { id: sessionId } = req.params;
  const { promotionPreviewId, batches } = req.body as {
    promotionPreviewId?: string;
    batches?: Array<{
      batchId: string;
      promotedStudentIds: string[];
      skippedStudentIds: string[];
    }>;
  };

  // C-06: validate required fields
  if (!promotionPreviewId || typeof promotionPreviewId !== "string") {
    send400(res, "promotionPreviewId is required");
    return;
  }
  if (!batches || !Array.isArray(batches)) {
    send400(res, "batches is required and must be an array");
    return;
  }
  for (const batch of batches) {
    if (
      !batch.batchId ||
      !Array.isArray(batch.promotedStudentIds) ||
      !Array.isArray(batch.skippedStudentIds)
    ) {
      send400(
        res,
        "Each batch must have batchId, promotedStudentIds, and skippedStudentIds",
      );
      return;
    }
  }

  const previewResult = await pool.query<PromotionPreviewRow>(
    `SELECT * FROM promotion_previews
     WHERE id = $1 AND tenant_id = $2 AND source_session_id = $3`,
    [promotionPreviewId, tenantId, sessionId],
  );
  const preview = previewResult.rows[0];

  if (!preview) {
    send404(res, "Preview not found");
    return;
  }
  if (new Date(preview.expires_at) < new Date()) {
    sendError(res, {
      code: "PREVIEW_EXPIRED",
      message:
        "The promotion preview has expired. Generate a new preview and try again.",
      status: 410,
    });
    return;
  }

  // C-06: targetSessionId comes from preview_data.toSessionId (stored during preview)
  const previewData = preview.preview_data as {
    toSessionId: string;
    sourceSessionId: string;
    batches: Array<{
      batchId: string;
      students: Array<{ studentId: string; currentClassId: string }>;
    }>;
  };

  const targetSessionId = previewData.toSessionId;

  // Verify target session still exists
  const targetResult = await pool.query<AcademicSessionRow>(
    "SELECT id FROM academic_sessions WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [targetSessionId, tenantId],
  );
  if (!targetResult.rows[0]) {
    send404(res, "Target session not found");
    return;
  }

  // Build studentId → currentClassId map from preview data
  const studentClassMap = new Map<string, string>();
  for (const previewBatch of previewData.batches) {
    for (const student of previewBatch.students) {
      studentClassMap.set(student.studentId, student.currentClassId);
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let totalPromoted = 0;
    let totalSkipped = 0;

    for (const requestBatch of batches) {
      totalSkipped += requestBatch.skippedStudentIds.length;

      if (requestBatch.promotedStudentIds.length === 0) continue;

      // Find target classes for this batch in the target session
      const targetClassesResult = await client.query<{
        id: string;
        level: string | null;
        section: string | null;
      }>(
        `SELECT c.id, c.level, c.section
         FROM classes c
         WHERE c.batch_id = $1
           AND c.session_id = $2
           AND c.tenant_id = $3
           AND c.deleted_at IS NULL`,
        [requestBatch.batchId, targetSessionId, tenantId],
      );

      for (const studentId of requestBatch.promotedStudentIds) {
        const currentClassId = studentClassMap.get(studentId);
        if (!currentClassId) continue;

        // Get source class level/section to match with target class
        const sourceClassResult = await client.query<{
          level: string | null;
          section: string | null;
        }>(
          "SELECT level, section FROM classes WHERE id = $1 AND tenant_id = $2",
          [currentClassId, tenantId],
        );
        const srcClass = sourceClassResult.rows[0];
        if (!srcClass) continue;

        const targetClass = targetClassesResult.rows.find(
          (tc) =>
            tc.level === srcClass.level &&
            COALESCE(tc.section) === COALESCE(srcClass.section),
        );

        if (targetClass) {
          await client.query(
            "UPDATE students SET class_id = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3",
            [targetClass.id, studentId, tenantId],
          );
          totalPromoted++;
        }
      }
    }

    const logId = uuidv4();
    await client.query(
      `INSERT INTO promotion_logs
         (id, tenant_id, source_session_id, target_session_id, committed_by, snapshot)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        logId,
        tenantId,
        sessionId,
        targetSessionId,
        userId,
        JSON.stringify(previewData),
      ],
    );

    // Clean up the used preview
    await client.query("DELETE FROM promotion_previews WHERE id = $1", [
      promotionPreviewId,
    ]);

    await client.query("COMMIT");

    // C-06: Response shape per OpenAPI
    res.json({
      data: {
        promotionLogIds: [logId],
        totalPromoted,
        totalSkipped,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ─── POST /promotions/:id/rollback ───────────────────────────────────────────

export async function rollbackPromotion(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const { id: promotionLogId } = req.params;

  const logResult = await pool.query<PromotionLogRow>(
    "SELECT * FROM promotion_logs WHERE id = $1 AND tenant_id = $2",
    [promotionLogId, tenantId],
  );
  const log = logResult.rows[0];
  if (!log) {
    send404(res, "Promotion log not found");
    return;
  }
  if (log.rolled_back) {
    send409(
      res,
      "This promotion has already been rolled back",
      "ALREADY_ROLLED_BACK",
    );
    return;
  }

  const snapshot = log.snapshot as {
    batches: Array<{
      students: Array<{ studentId: string; currentClassId: string }>;
    }>;
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Restore each student's class_id to what it was before the promotion
    for (const batch of snapshot.batches) {
      for (const student of batch.students) {
        await client.query(
          "UPDATE students SET class_id = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3",
          [student.currentClassId, student.studentId, tenantId],
        );
      }
    }

    await client.query(
      `UPDATE promotion_logs
       SET rolled_back = true, rolled_back_at = NOW(), rolled_back_by = $1
       WHERE id = $2 AND tenant_id = $3`,
      [userId, promotionLogId, tenantId],
    );

    await client.query("COMMIT");

    res.json({ promotionLogId, rolledBack: true });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Helper used in transitionCommit to handle null/undefined sections
function COALESCE(val: string | null | undefined): string {
  return val ?? "";
}
