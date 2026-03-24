/**
 * Events Controller — Academic Calendar (v4.5 CR-37)
 *
 * POST   /api/events            — create an event (Admin only)
 * GET    /api/events            — list events for a date range (Admin, Teacher, Student)
 * PUT    /api/events/:eventId   — partial update (Admin only)
 * DELETE /api/events/:eventId   — soft-delete (Admin only)
 *
 * Events are tenant-scoped and soft-deleted only (deleted_at set; no hard delete).
 * GET filter: returns events where start_date <= :to AND end_date >= :from
 *   (range overlap — not just start-within-range).
 * Default range: current month start/end in tenant timezone.
 */

import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../../db/pool";
import { send400, send403, send404 } from "../../utils/errors";
import { EventRow, EventType, TenantRow } from "../../types";

const VALID_TYPES: EventType[] = ["Holiday", "Exam", "Event", "Other"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatEvent(r: EventRow) {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    startDate: String(r.start_date).slice(0, 10),
    endDate: String(r.end_date).slice(0, 10),
    description: r.description,
    createdBy: r.created_by,
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

// ═══════════════════════════════════════════════════════════════════
// POST /api/events
// ═══════════════════════════════════════════════════════════════════

export async function createEvent(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const callerRole = req.activeRole!;
  const callerId = req.userId!;

  if (callerRole !== "Admin") {
    send403(res, "Only Admins can create events", "FORBIDDEN");
    return;
  }

  const { title, type, startDate, endDate, description } = req.body as {
    title?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  };

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    send400(res, "title is required", "VALIDATION_ERROR");
    return;
  }
  if (title.trim().length > 255) {
    send400(res, "title must not exceed 255 characters", "VALIDATION_ERROR");
    return;
  }
  if (!type || !VALID_TYPES.includes(type as EventType)) {
    send400(
      res,
      `type must be one of: ${VALID_TYPES.join(", ")}`,
      "VALIDATION_ERROR",
    );
    return;
  }
  if (!startDate || !DATE_RE.test(startDate)) {
    send400(
      res,
      "startDate must be a valid date in YYYY-MM-DD format",
      "VALIDATION_ERROR",
    );
    return;
  }
  if (!endDate || !DATE_RE.test(endDate)) {
    send400(
      res,
      "endDate must be a valid date in YYYY-MM-DD format",
      "VALIDATION_ERROR",
    );
    return;
  }
  if (endDate < startDate) {
    send400(
      res,
      "endDate must be greater than or equal to startDate",
      "VALIDATION_ERROR",
    );
    return;
  }
  if (
    description !== undefined &&
    description !== null &&
    typeof description === "string" &&
    description.length > 1000
  ) {
    send400(
      res,
      "description must not exceed 1000 characters",
      "VALIDATION_ERROR",
    );
    return;
  }

  const id = uuidv4();

  const result = await pool.query<EventRow>(
    `INSERT INTO events
       (id, tenant_id, title, type, start_date, end_date, description, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
     RETURNING *`,
    [
      id,
      tenantId,
      title.trim(),
      type,
      startDate,
      endDate,
      description?.trim() ?? null,
      callerId,
    ],
  );

  const data = formatEvent(result.rows[0]!);
  res.status(201).json({ data, event: data });
}

// ═══════════════════════════════════════════════════════════════════
// GET /api/events
// ═══════════════════════════════════════════════════════════════════

export async function listEvents(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const callerRole = req.activeRole!;

  if (
    callerRole === "Admin" ||
    callerRole === "Teacher" ||
    callerRole === "Student"
  ) {
    // allowed — fall through
  } else {
    send403(res, "Access denied", "FORBIDDEN");
    return;
  }

  const {
    from: fromParam,
    to: toParam,
    type: typeParam,
  } = req.query as {
    from?: string;
    to?: string;
    type?: string;
  };

  // Validate optional type filter
  if (typeParam && !VALID_TYPES.includes(typeParam as EventType)) {
    send400(
      res,
      `type must be one of: ${VALID_TYPES.join(", ")}`,
      "VALIDATION_ERROR",
    );
    return;
  }

  // Resolve default range: need tenant timezone for calendar semantics
  let from = fromParam;
  let to = toParam;

  if (!from || !to) {
    // Get tenant timezone
    const tzResult = await pool.query<Pick<TenantRow, "timezone">>(
      "SELECT timezone FROM tenants WHERE id = $1",
      [tenantId],
    );
    const timezone = tzResult.rows[0]?.timezone ?? "UTC";

    // Compute current month in tenant timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(now);
    const year =
      parts.find((p) => p.type === "year")?.value ?? String(now.getFullYear());
    const month = parts.find((p) => p.type === "month")?.value ?? "01";
    const daysInMonth = new Date(
      parseInt(year, 10),
      parseInt(month, 10),
      0,
    ).getDate();

    if (!from) from = `${year}-${month}-01`;
    if (!to) to = `${year}-${month}-${String(daysInMonth).padStart(2, "0")}`;
  }

  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
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

  const conditions = [
    "tenant_id = $1",
    "deleted_at IS NULL",
    "start_date <= $3",
    "end_date   >= $2",
  ];
  const params: unknown[] = [tenantId, from, to];

  if (typeParam) {
    conditions.push(`type = $${params.length + 1}`);
    params.push(typeParam);
  }

  const result = await pool.query<EventRow>(
    `SELECT * FROM events
     WHERE ${conditions.join(" AND ")}
     ORDER BY start_date ASC, title ASC`,
    params,
  );

  const events = result.rows.map(formatEvent);
  res.status(200).json({ data: events, total: events.length, events });
}

// ═══════════════════════════════════════════════════════════════════
// PUT /api/events/:eventId
// ═══════════════════════════════════════════════════════════════════

export async function updateEvent(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const callerRole = req.activeRole!;
  const { eventId } = req.params as { eventId: string };

  if (callerRole !== "Admin") {
    send403(res, "Only Admins can update events", "FORBIDDEN");
    return;
  }

  // Fetch existing event
  const existing = await pool.query<EventRow>(
    "SELECT * FROM events WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [eventId, tenantId],
  );
  if ((existing.rowCount ?? 0) === 0) {
    send404(res, "Event not found");
    return;
  }
  const evt = existing.rows[0]!;

  const patch = req.body as {
    title?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    description?: string | null;
  };

  // Validate patch fields where present
  const title = patch.title ?? evt.title;
  const type = patch.type ?? evt.type;
  const startDate = patch.startDate ?? String(evt.start_date).slice(0, 10);
  const endDate = patch.endDate ?? String(evt.end_date).slice(0, 10);
  const description =
    "description" in patch ? (patch.description ?? null) : evt.description;

  if (typeof title !== "string" || title.trim().length === 0) {
    send400(res, "title must not be empty", "VALIDATION_ERROR");
    return;
  }
  if (title.trim().length > 255) {
    send400(res, "title must not exceed 255 characters", "VALIDATION_ERROR");
    return;
  }
  if (!VALID_TYPES.includes(type as EventType)) {
    send400(
      res,
      `type must be one of: ${VALID_TYPES.join(", ")}`,
      "VALIDATION_ERROR",
    );
    return;
  }
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    send400(
      res,
      "startDate and endDate must be valid dates in YYYY-MM-DD format",
      "VALIDATION_ERROR",
    );
    return;
  }
  if (endDate < startDate) {
    send400(
      res,
      "endDate must be greater than or equal to startDate",
      "VALIDATION_ERROR",
    );
    return;
  }
  if (
    description !== null &&
    typeof description === "string" &&
    description.length > 1000
  ) {
    send400(
      res,
      "description must not exceed 1000 characters",
      "VALIDATION_ERROR",
    );
    return;
  }

  const updated = await pool.query<EventRow>(
    `UPDATE events
     SET title = $1, type = $2, start_date = $3, end_date = $4,
         description = $5, updated_at = NOW()
     WHERE id = $6 AND tenant_id = $7
     RETURNING *`,
    [
      title.trim(),
      type,
      startDate,
      endDate,
      typeof description === "string" ? description.trim() : null,
      eventId,
      tenantId,
    ],
  );

  const data = formatEvent(updated.rows[0]!);
  res.status(200).json({ data, event: data });
}

// ═══════════════════════════════════════════════════════════════════
// DELETE /api/events/:eventId
// ═══════════════════════════════════════════════════════════════════

export async function deleteEvent(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const callerRole = req.activeRole!;
  const { eventId } = req.params as { eventId: string };

  if (callerRole !== "Admin") {
    send403(res, "Only Admins can delete events", "FORBIDDEN");
    return;
  }

  const result = await pool.query(
    "SELECT id FROM events WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [eventId, tenantId],
  );
  if ((result.rowCount ?? 0) === 0) {
    send404(res, "Event not found");
    return;
  }

  await pool.query(
    "UPDATE events SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2",
    [eventId, tenantId],
  );

  res.status(204).send();
}
