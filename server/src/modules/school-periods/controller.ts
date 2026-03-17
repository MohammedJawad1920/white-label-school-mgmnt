/**
 * School Periods Controller (Phase 4 — v3.3 NEW)
 *
 * GET    /api/school-periods        — list all periods for tenant
 * POST   /api/school-periods        — create a new period
 * PUT    /api/school-periods/:id    — update label/startTime/endTime (periodNumber immutable)
 * DELETE /api/school-periods/:id    — hard delete (blocked if timeslots reference it)
 *
 * IMMUTABILITY RULE:
 * periodNumber cannot be changed after creation. It is the JOIN key between
 * timeslots and school_periods. Changing it would silently corrupt all timetable
 * data for that period. We enforce this at the app layer: PUT never touches
 * period_number regardless of what the body contains.
 *
 * NO SOFT DELETE:
 * school_periods has no deleted_at column (see DDL). Deletes are hard deletes.
 * The HAS_REFERENCES guard prevents orphaning timeslots.
 *
 * PERIOD_TIME_INVALID:
 * startTime must be strictly less than endTime. Validated on create AND update.
 */

import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../../db/pool";
import { send400, send404 } from "../../utils/errors";
import { SchoolPeriodRow } from "../../types";

// ── Time helpers ──────────────────────────────────────────────────────────────

/**
 * Validates "HH:MM" format and returns true if valid.
 * PostgreSQL TIME accepts "HH:MM" and stores as "HH:MM:SS".
 */
function isValidTimeFormat(t: string): boolean {
  return /^\d{2}:\d{2}$/.test(t);
}

/**
 * Compares two "HH:MM" strings. Returns true if a < b.
 * WHY string compare works: "08:00" < "08:45" lexicographically — valid for
 * same-day 24h time strings in HH:MM format.
 */
function isTimeBefore(a: string, b: string): boolean {
  return a < b;
}

/**
 * Strips seconds from PostgreSQL TIME output "HH:MM:SS" → "HH:MM".
 * WHY: DB stores TIME as "08:00:00", API contract requires "HH:MM".
 */
function trimTime(pgTime: string): string {
  return pgTime.slice(0, 5);
}

function fmt(p: SchoolPeriodRow) {
  return {
    id: p.id,
    tenantId: p.tenant_id,
    periodNumber: p.period_number,
    label: p.label,
    startTime: trimTime(p.start_time),
    endTime: trimTime(p.end_time),
    createdAt: p.created_at.toISOString(),
    updatedAt: p.updated_at.toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════
// GET /api/school-periods
// ═══════════════════════════════════════════════════════════════════

export async function listPeriods(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;

  const result = await pool.query<SchoolPeriodRow>(
    `SELECT id, tenant_id, period_number, label, start_time, end_time, created_at, updated_at
     FROM school_periods
     WHERE tenant_id = $1
     ORDER BY period_number ASC`,
    [tenantId],
  );

  res.status(200).json({ periods: result.rows.map(fmt) });
}

// ═══════════════════════════════════════════════════════════════════
// POST /api/school-periods
// ═══════════════════════════════════════════════════════════════════

export async function createPeriod(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { periodNumber, label, startTime, endTime } = req.body as {
    periodNumber?: unknown;
    label?: string;
    startTime?: string;
    endTime?: string;
  };

  // ── Validation ────────────────────────────────────────────────────
  if (periodNumber === undefined || periodNumber === null) {
    send400(res, "periodNumber is required");
    return;
  }
  const periodNum = Number(periodNumber);
  if (!Number.isInteger(periodNum) || periodNum < 1) {
    send400(res, "periodNumber must be a positive integer");
    return;
  }
  if (!startTime || !endTime) {
    send400(res, "startTime and endTime are required");
    return;
  }
  if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
    send400(
      res,
      "startTime and endTime must be in HH:MM format",
      "PERIOD_TIME_INVALID",
    );
    return;
  }
  if (!isTimeBefore(startTime, endTime)) {
    res.status(400).json({
      error: {
        code: "PERIOD_TIME_INVALID",
        message: "startTime must be before endTime",
        details: { startTime, endTime },
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  const id = uuidv4();

  try {
    const result = await pool.query<SchoolPeriodRow>(
      `INSERT INTO school_periods
         (id, tenant_id, period_number, label, start_time, end_time, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, tenant_id, period_number, label, start_time, end_time, created_at, updated_at`,
      [id, tenantId, periodNum, (label ?? "").trim(), startTime, endTime],
    );

    res.status(201).json({ period: fmt(result.rows[0]!) });
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "23505"
    ) {
      res.status(409).json({
        error: {
          code: "DUPLICATE_PERIOD_NUMBER",
          message: `Period number ${periodNum} already exists for this school`,
          details: { periodNumber: periodNum },
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PUT /api/school-periods/:id
// NOTE: periodNumber is intentionally NOT in the update set.
// ═══════════════════════════════════════════════════════════════════

export async function updatePeriod(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };
  const { label, startTime, endTime } = req.body as {
    label?: string;
    startTime?: string;
    endTime?: string;
  };

  if (label === undefined && !startTime && !endTime) {
    send400(res, "At least one of label, startTime, or endTime is required");
    return;
  }

  // Fetch existing to merge times for cross-field validation
  const existing = await pool.query<SchoolPeriodRow>(
    `SELECT id, tenant_id, period_number, label, start_time, end_time, created_at, updated_at
     FROM school_periods WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId],
  );
  if ((existing.rowCount ?? 0) === 0) {
    send404(res, "School period not found");
    return;
  }

  const current = existing.rows[0]!;
  const newStart = startTime ?? trimTime(current.start_time);
  const newEnd = endTime ?? trimTime(current.end_time);

  if (!isValidTimeFormat(newStart) || !isValidTimeFormat(newEnd)) {
    send400(
      res,
      "startTime and endTime must be in HH:MM format",
      "PERIOD_TIME_INVALID",
    );
    return;
  }
  if (!isTimeBefore(newStart, newEnd)) {
    res.status(400).json({
      error: {
        code: "PERIOD_TIME_INVALID",
        message: "startTime must be before endTime",
        details: { startTime: newStart, endTime: newEnd },
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Build dynamic SET — periodNumber is NEVER included here
  const sets: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [];
  let idx = 1;

  if (label !== undefined) {
    sets.push(`label = $${idx++}`);
    params.push(label.trim());
  }
  if (startTime) {
    sets.push(`start_time = $${idx++}`);
    params.push(startTime);
  }
  if (endTime) {
    sets.push(`end_time = $${idx++}`);
    params.push(endTime);
  }

  params.push(id, tenantId);

  const result = await pool.query<SchoolPeriodRow>(
    `UPDATE school_periods SET ${sets.join(", ")}
     WHERE id = $${idx} AND tenant_id = $${idx + 1}
     RETURNING id, tenant_id, period_number, label, start_time, end_time, created_at, updated_at`,
    params,
  );

  res.status(200).json({ period: fmt(result.rows[0]!) });
}

// ═══════════════════════════════════════════════════════════════════
// DELETE /api/school-periods/:id
// Hard delete — blocked if active timeslots reference this period_number
// ═══════════════════════════════════════════════════════════════════

export async function deletePeriod(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };

  // Fetch the period to get period_number for the timeslot reference check
  const existing = await pool.query<
    Pick<SchoolPeriodRow, "id" | "period_number">
  >(
    "SELECT id, period_number FROM school_periods WHERE id = $1 AND tenant_id = $2",
    [id, tenantId],
  );
  if ((existing.rowCount ?? 0) === 0) {
    send404(res, "School period not found");
    return;
  }

  const periodNumber = existing.rows[0]!.period_number;

  // Check for active timeslots that reference this period_number
  // WHY check period_number not period id: timeslots store period_number (the JOIN key),
  // not the school_period.id. Deleting a period while timeslots reference its number
  // would leave those timeslots unresolvable.
  const tsCheck = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM timeslots
     WHERE tenant_id = $1
       AND period_number = $2
       AND deleted_at IS NULL`,
    [tenantId, periodNumber],
  );

  if (parseInt(tsCheck.rows[0]?.count ?? "0", 10) > 0) {
    res.status(409).json({
      error: {
        code: "HAS_REFERENCES",
        message: `Cannot delete: active timeslots are assigned to period ${periodNumber}`,
        details: { periodNumber },
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  await pool.query(
    "DELETE FROM school_periods WHERE id = $1 AND tenant_id = $2",
    [id, tenantId],
  );

  res.status(204).send();
}
