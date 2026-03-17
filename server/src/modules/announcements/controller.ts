/**
 * Announcements Controller — v5.0
 *
 * POST   /api/v1/announcements      — createAnnouncement (Admin, Teacher)
 * GET    /api/v1/announcements      — listAnnouncements  (all roles — audience-filtered)
 * GET    /api/v1/announcements/:id  — getAnnouncement    (all roles — audience-filtered)
 * PUT    /api/v1/announcements/:id  — updateAnnouncement (Admin, Teacher — creator or Admin)
 * DELETE /api/v1/announcements/:id  — deleteAnnouncement (Admin, Teacher — creator or Admin)
 *
 * Audience filtering rules:
 *   Admin   → all announcements
 *   Teacher → 'All', 'TeachersOnly', 'Class' (own class only)
 *   Student → 'All', 'StudentsOnly', 'Class'/'Batch' (own class/batch)
 *   Guardian→ 'All', 'GuardiansOnly', 'Class'/'Batch' (children's class/batch)
 *
 * Only published announcements visible:
 *   publish_at <= NOW() AND (expires_at IS NULL OR expires_at > NOW())
 */

import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../../db/pool";
import { send400, send403, send404 } from "../../utils/errors";
import { AnnouncementRow, ApiAnnouncement, AudienceType } from "../../types";

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_AUDIENCE_TYPES: AudienceType[] = [
  "All",
  "Class",
  "Batch",
  "StudentsOnly",
  "TeachersOnly",
  "GuardiansOnly",
];

// ─── Extended row types ───────────────────────────────────────────────────────

type AnnouncementWithCreator = AnnouncementRow & { creator_name: string };

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatAnnouncement(row: AnnouncementWithCreator): ApiAnnouncement {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sessionId: row.session_id,
    title: row.title,
    body: row.body,
    linkUrl: row.link_url,
    linkLabel: row.link_label,
    audienceType: row.audience_type,
    audienceClassId: row.audience_class_id,
    audienceBatchId: row.audience_batch_id,
    createdBy: row.created_by,
    createdByName: row.creator_name,
    publishAt:
      row.publish_at instanceof Date
        ? row.publish_at.toISOString()
        : String(row.publish_at),
    expiresAt: row.expires_at
      ? row.expires_at instanceof Date
        ? row.expires_at.toISOString()
        : String(row.expires_at)
      : null,
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ANNOUNCEMENT_SELECT = `
  SELECT a.*, u.name AS creator_name
  FROM announcements a
  JOIN users u ON u.id = a.created_by
`;

/**
 * Builds the audience WHERE fragment and appends extra params.
 * Returns { fragment, extraParams } where fragment is appended after base conditions.
 */
async function buildAudienceFilter(
  req: Request,
  tenantId: string,
  startParamIdx: number,
): Promise<{ fragment: string; extraParams: unknown[] }> {
  const activeRole = req.activeRole;
  const userId = req.userId!;
  const extraParams: unknown[] = [];
  let idx = startParamIdx;

  if (activeRole === "Admin") {
    return { fragment: "", extraParams };
  }

  if (activeRole === "Teacher") {
    const classTeacherOf = req.classTeacherOf;
    if (classTeacherOf) {
      extraParams.push(classTeacherOf);
      return {
        fragment: `AND (a.audience_type IN ('All', 'TeachersOnly') OR (a.audience_type = 'Class' AND a.audience_class_id = $${idx}))`,
        extraParams,
      };
    }
    return {
      fragment: `AND a.audience_type IN ('All', 'TeachersOnly')`,
      extraParams,
    };
  }

  if (activeRole === "Student") {
    const studentId = req.studentId;
    if (studentId) {
      const studentResult = await pool.query<{
        class_id: string | null;
        batch_id: string;
      }>(
        "SELECT class_id, batch_id FROM students WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
        [studentId, tenantId],
      );
      const student = studentResult.rows[0];
      if (student?.class_id) {
        extraParams.push(student.class_id, student.batch_id);
        return {
          fragment: `AND (a.audience_type IN ('All', 'StudentsOnly') OR (a.audience_type = 'Class' AND a.audience_class_id = $${idx}) OR (a.audience_type = 'Batch' AND a.audience_batch_id = $${idx + 1}))`,
          extraParams,
        };
      }
    }
    return {
      fragment: `AND a.audience_type IN ('All', 'StudentsOnly')`,
      extraParams,
    };
  }

  if (activeRole === "Guardian") {
    const childrenResult = await pool.query<{
      class_id: string | null;
      batch_id: string;
    }>(
      `SELECT s.class_id, s.batch_id FROM students s
       JOIN student_guardians sg ON sg.student_id = s.id
       JOIN guardians g ON g.id = sg.guardian_id
       WHERE g.user_id = $1 AND g.tenant_id = $2
         AND g.deleted_at IS NULL AND s.deleted_at IS NULL AND s.status = 'Active'`,
      [userId, tenantId],
    );

    const classIds = [
      ...new Set(
        childrenResult.rows
          .map((r) => r.class_id)
          .filter((cid): cid is string => cid !== null),
      ),
    ];
    const batchIds = [...new Set(childrenResult.rows.map((r) => r.batch_id))];

    if (classIds.length > 0 || batchIds.length > 0) {
      extraParams.push(classIds, batchIds);
      return {
        fragment: `AND (a.audience_type IN ('All', 'GuardiansOnly') OR (a.audience_type = 'Class' AND a.audience_class_id = ANY($${idx}::text[])) OR (a.audience_type = 'Batch' AND a.audience_batch_id = ANY($${idx + 1}::text[])))`,
        extraParams,
      };
    }
    return {
      fragment: `AND a.audience_type IN ('All', 'GuardiansOnly')`,
      extraParams,
    };
  }

  // Fallback: no access
  return {
    fragment: "AND FALSE",
    extraParams,
  };
}

// ═══════════════════════════════════════════════════════════════════
// POST /announcements
// ═══════════════════════════════════════════════════════════════════

export async function createAnnouncement(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const activeRole = req.activeRole!;

  const {
    title,
    body,
    audienceType,
    audienceClassId,
    audienceBatchId,
    linkUrl,
    linkLabel,
    publishAt,
    expiresAt,
  } = req.body as {
    title?: string;
    body?: string;
    audienceType?: string;
    audienceClassId?: string;
    audienceBatchId?: string;
    linkUrl?: string;
    linkLabel?: string;
    publishAt?: string;
    expiresAt?: string;
  };

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    send400(res, "title is required");
    return;
  }
  if (!body || typeof body !== "string" || body.trim().length === 0) {
    send400(res, "body is required");
    return;
  }
  if (
    !audienceType ||
    !VALID_AUDIENCE_TYPES.includes(audienceType as AudienceType)
  ) {
    send400(
      res,
      `audienceType must be one of: ${VALID_AUDIENCE_TYPES.join(", ")}`,
    );
    return;
  }
  if (audienceType === "Class" && !audienceClassId) {
    send400(res, "audienceClassId is required for audienceType 'Class'");
    return;
  }
  if (audienceType === "Batch" && !audienceBatchId) {
    send400(res, "audienceBatchId is required for audienceType 'Batch'");
    return;
  }

  // Teacher restrictions: can only create 'Class' audience for their own class
  if (activeRole === "Teacher") {
    if (audienceType !== "Class") {
      send403(
        res,
        "Teachers can only create announcements with 'Class' audience type",
      );
      return;
    }
    const classTeacherOf = req.classTeacherOf;
    if (!classTeacherOf || audienceClassId !== classTeacherOf) {
      send403(
        res,
        "Teachers can only create announcements for their own class",
      );
      return;
    }
  }

  // Get current active session for the tenant
  const sessionResult = await pool.query<{ id: string }>(
    `SELECT id FROM academic_sessions
     WHERE tenant_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
     LIMIT 1`,
    [tenantId],
  );
  if ((sessionResult.rowCount ?? 0) === 0) {
    send400(
      res,
      "No active academic session found. Cannot create announcement.",
      "NO_ACTIVE_SESSION",
    );
    return;
  }
  const sessionId = sessionResult.rows[0]!.id;

  // Verify audienceClassId belongs to tenant if provided
  if (audienceClassId) {
    const classCheck = await pool.query(
      "SELECT id FROM classes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [audienceClassId, tenantId],
    );
    if ((classCheck.rowCount ?? 0) === 0) {
      send400(res, "audienceClassId refers to an invalid class", "NOT_FOUND");
      return;
    }
  }

  // Verify audienceBatchId belongs to tenant if provided
  if (audienceBatchId) {
    const batchCheck = await pool.query(
      "SELECT id FROM batches WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [audienceBatchId, tenantId],
    );
    if ((batchCheck.rowCount ?? 0) === 0) {
      send400(res, "audienceBatchId refers to an invalid batch", "NOT_FOUND");
      return;
    }
  }

  const id = uuidv4();
  const resolvedPublishAt = publishAt ?? new Date().toISOString();

  await pool.query(
    `INSERT INTO announcements
       (id, tenant_id, session_id, title, body, link_url, link_label,
        audience_type, audience_class_id, audience_batch_id,
        created_by, created_by_role, publish_at, expires_at,
        push_sent, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, FALSE, NOW(), NOW())`,
    [
      id,
      tenantId,
      sessionId,
      title.trim(),
      body.trim(),
      linkUrl ?? null,
      linkLabel ?? null,
      audienceType,
      audienceType === "Class" ? (audienceClassId ?? null) : null,
      audienceType === "Batch" ? (audienceBatchId ?? null) : null,
      userId,
      activeRole,
      resolvedPublishAt,
      expiresAt ?? null,
    ],
  );

  const result = await pool.query<AnnouncementWithCreator>(
    `${ANNOUNCEMENT_SELECT} WHERE a.id = $1`,
    [id],
  );

  res.status(201).json({ announcement: formatAnnouncement(result.rows[0]!) });
}

// ═══════════════════════════════════════════════════════════════════
// GET /announcements
// ═══════════════════════════════════════════════════════════════════

export async function listAnnouncements(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;

  const { limit: limitParam, offset: offsetParam } = req.query as {
    limit?: string;
    offset?: string;
  };
  const limit = Math.min(parseInt(limitParam ?? "20", 10), 100);
  const offset = parseInt(offsetParam ?? "0", 10);

  // Build base conditions
  const baseParams: unknown[] = [tenantId];
  const baseConditions = [
    "a.tenant_id = $1",
    "a.publish_at <= NOW()",
    "(a.expires_at IS NULL OR a.expires_at > NOW())",
  ];

  // Build audience filter (params start at index 2)
  const { fragment: audienceFragment, extraParams } = await buildAudienceFilter(
    req,
    tenantId,
    2,
  );

  const allConditions = [...baseConditions];
  if (audienceFragment) {
    allConditions.push(audienceFragment.replace(/^AND\s+/, ""));
  }

  const allParams = [...baseParams, ...extraParams];
  const limitIdx = allParams.length + 1;
  const offsetIdx = allParams.length + 2;
  allParams.push(limit, offset);

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM announcements a
     WHERE ${allConditions.join(" AND ")}`,
    allParams.slice(0, allParams.length - 2), // exclude limit/offset
  );
  const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

  const result = await pool.query<AnnouncementWithCreator>(
    `${ANNOUNCEMENT_SELECT}
     WHERE ${allConditions.join(" AND ")}
     ORDER BY a.publish_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    allParams,
  );

  res.status(200).json({
    data: result.rows.map(formatAnnouncement),
    total,
  });
}

// ═══════════════════════════════════════════════════════════════════
// GET /announcements/:id
// ═══════════════════════════════════════════════════════════════════

export async function getAnnouncement(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };

  const result = await pool.query<AnnouncementWithCreator>(
    `${ANNOUNCEMENT_SELECT}
     WHERE a.id = $1 AND a.tenant_id = $2
       AND a.publish_at <= NOW()
       AND (a.expires_at IS NULL OR a.expires_at > NOW())`,
    [id, tenantId],
  );
  if ((result.rowCount ?? 0) === 0) {
    send404(res, "Announcement not found");
    return;
  }

  res.status(200).json({ announcement: formatAnnouncement(result.rows[0]!) });
}

// ═══════════════════════════════════════════════════════════════════
// PUT /announcements/:id
// ═══════════════════════════════════════════════════════════════════

export async function updateAnnouncement(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRoles = req.userRoles ?? [];
  const isAdmin = userRoles.includes("Admin");
  const { id } = req.params as { id: string };

  const existingResult = await pool.query<AnnouncementRow>(
    "SELECT * FROM announcements WHERE id = $1 AND tenant_id = $2",
    [id, tenantId],
  );
  if ((existingResult.rowCount ?? 0) === 0) {
    send404(res, "Announcement not found");
    return;
  }
  const existing = existingResult.rows[0]!;

  // Only creator or Admin can update
  if (!isAdmin && existing.created_by !== userId) {
    send403(res, "You can only edit your own announcements");
    return;
  }

  // Cannot edit already-published announcements
  const publishAt =
    existing.publish_at instanceof Date
      ? existing.publish_at
      : new Date(String(existing.publish_at));
  if (publishAt < new Date()) {
    send403(
      res,
      "Cannot edit an announcement that has already been published",
      "ALREADY_PUBLISHED",
    );
    return;
  }

  const {
    title,
    body,
    linkUrl,
    linkLabel,
    publishAt: newPublishAt,
    expiresAt,
  } = req.body as {
    title?: string;
    body?: string;
    linkUrl?: string | null;
    linkLabel?: string | null;
    publishAt?: string;
    expiresAt?: string | null;
  };

  await pool.query(
    `UPDATE announcements
     SET title = $1, body = $2, link_url = $3, link_label = $4,
         publish_at = $5, expires_at = $6, updated_at = NOW()
     WHERE id = $7 AND tenant_id = $8`,
    [
      title !== undefined ? title.trim() : existing.title,
      body !== undefined ? body.trim() : existing.body,
      linkUrl !== undefined ? linkUrl : existing.link_url,
      linkLabel !== undefined ? linkLabel : existing.link_label,
      newPublishAt !== undefined ? newPublishAt : existing.publish_at,
      expiresAt !== undefined ? expiresAt : existing.expires_at,
      id,
      tenantId,
    ],
  );

  const withCreator = await pool.query<AnnouncementWithCreator>(
    `${ANNOUNCEMENT_SELECT} WHERE a.id = $1`,
    [id],
  );

  res
    .status(200)
    .json({ announcement: formatAnnouncement(withCreator.rows[0]!) });
}

// ═══════════════════════════════════════════════════════════════════
// DELETE /announcements/:id
// ═══════════════════════════════════════════════════════════════════

export async function deleteAnnouncement(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRoles = req.userRoles ?? [];
  const isAdmin = userRoles.includes("Admin");
  const { id } = req.params as { id: string };

  const result = await pool.query<AnnouncementRow>(
    "SELECT * FROM announcements WHERE id = $1 AND tenant_id = $2",
    [id, tenantId],
  );
  if ((result.rowCount ?? 0) === 0) {
    send404(res, "Announcement not found");
    return;
  }
  const announcement = result.rows[0]!;

  if (!isAdmin && announcement.created_by !== userId) {
    send403(res, "You can only delete your own announcements");
    return;
  }

  // Hard delete
  await pool.query(
    "DELETE FROM announcements WHERE id = $1 AND tenant_id = $2",
    [id, tenantId],
  );
  res.status(204).send();
}
