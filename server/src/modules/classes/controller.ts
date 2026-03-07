import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../../db/pool";
import { send400, send404 } from "../../utils/errors";
import { bulkSoftDelete } from "../../utils/bulkDelete";
import { ClassRow, BulkDeleteRequest } from "../../types";

// D-09 fix: accept optional batch_name from a JOIN so all class responses
// include batchName per the OpenAPI Class schema.
type ClassWithBatch = ClassRow & { batch_name?: string | null };

function fmt(c: ClassWithBatch) {
  return {
    id: c.id,
    tenantId: c.tenant_id,
    name: c.name,
    batchId: c.batch_id,
    batchName: c.batch_name ?? null,
    createdAt: c.created_at.toISOString(),
    updatedAt: c.updated_at.toISOString(),
  };
}

export async function listClasses(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { batchId } = req.query as { batchId?: string };
  const params: unknown[] = [tenantId];
  let where = "c.tenant_id = $1 AND c.deleted_at IS NULL";
  if (batchId) {
    where += " AND c.batch_id = $2";
    params.push(batchId);
  }
  const result = await pool.query<ClassWithBatch>(
    `SELECT c.id, c.tenant_id, c.name, c.batch_id, c.deleted_at, c.created_at, c.updated_at,
            b.name AS batch_name
     FROM classes c
     LEFT JOIN batches b ON b.id = c.batch_id AND b.deleted_at IS NULL
     WHERE ${where} ORDER BY c.name ASC`,
    params,
  );
  res.status(200).json({ classes: result.rows.map(fmt) });
}

export async function createClass(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { name, batchId } = req.body as { name?: string; batchId?: string };
  if (!name || !batchId) {
    send400(res, "name and batchId are required");
    return;
  }
  // Verify batch exists in this tenant
  const batchCheck = await pool.query<{ id: string; name: string }>(
    "SELECT id, name FROM batches WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [batchId, tenantId],
  );
  if ((batchCheck.rowCount ?? 0) === 0) {
    send404(res, "Batch not found");
    return;
  }
  const id = `CLS-${uuidv4()}`;
  const result = await pool.query<ClassRow>(
    `INSERT INTO classes (id, tenant_id, name, batch_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING id, tenant_id, name, batch_id, deleted_at, created_at, updated_at`,
    [id, tenantId, name.trim(), batchId],
  );
  const batchName = batchCheck.rows[0]!.name;
  res
    .status(201)
    .json({ class: fmt({ ...result.rows[0]!, batch_name: batchName }) });
}

export async function updateClass(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };
  const { name } = req.body as { name?: string };
  if (!name) {
    send400(res, "name is required");
    return;
  }
  const result = await pool.query<ClassRow>(
    `UPDATE classes SET name = $1, updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
     RETURNING id, tenant_id, name, batch_id, deleted_at, created_at, updated_at`,
    [name.trim(), id, tenantId],
  );
  if ((result.rowCount ?? 0) === 0) {
    send404(res, "Class not found");
    return;
  }
  const updated = result.rows[0]!;
  const batchRow = await pool.query<{ name: string }>(
    "SELECT name FROM batches WHERE id = $1 AND deleted_at IS NULL",
    [updated.batch_id],
  );
  res
    .status(200)
    .json({
      class: fmt({ ...updated, batch_name: batchRow.rows[0]?.name ?? null }),
    });
}

export async function deleteClass(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };
  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM classes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  if ((existing.rowCount ?? 0) === 0) {
    send404(res, "Class not found");
    return;
  }
  const studentCheck = await pool.query<{ count: string }>(
    "SELECT COUNT(*) as count FROM students WHERE class_id = $1 AND deleted_at IS NULL",
    [id],
  );
  if (parseInt(studentCheck.rows[0]?.count ?? "0", 10) > 0) {
    res.status(409).json({
      error: {
        code: "HAS_REFERENCES",
        message: "Cannot delete: students are enrolled in this class",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }
  await pool.query(
    "UPDATE classes SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
    [id, tenantId],
  );
  res.status(204).send();
}

export async function bulkDeleteClasses(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { ids } = req.body as BulkDeleteRequest;
  if (!Array.isArray(ids) || ids.length === 0) {
    send400(res, "ids must be a non-empty array");
    return;
  }
  if (ids.length > 100) {
    send400(res, "Cannot bulk delete more than 100 records at once");
    return;
  }
  const result = await bulkSoftDelete(
    pool,
    "classes",
    ids,
    tenantId,
    async (id, _tid, p) => {
      const check = await p.query<{ count: string }>(
        "SELECT COUNT(*) as count FROM students WHERE class_id = $1 AND deleted_at IS NULL",
        [id],
      );
      return parseInt(check.rows[0]?.count ?? "0", 10) > 0
        ? "Cannot delete: students are enrolled in this class"
        : null;
    },
  );
  res.status(200).json(result);
}

// PUT /api/classes/:sourceClassId/promote — v4.0 CR-21
// Bulk year-end student class promotion OR graduation. Admin only.
// Body: { targetClassId: string } → promote   (updates class_id)
//       { action: "graduate" }  → graduate  (sets class_id = NULL, status = 'Graduated')
export async function promoteClass(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { sourceClassId } = req.params as { sourceClassId: string };
  const body = req.body as
    | { targetClassId?: string; action?: string }
    | undefined;

  const hasTargetClassId =
    body && "targetClassId" in body && typeof body.targetClassId === "string";
  const isGraduate = body && "action" in body && body.action === "graduate";

  // CR-21: must be one or the other — reject both absent or invalid combos
  if (!hasTargetClassId && !isGraduate) {
    res.status(400).json({
      error: {
        code: "INVALID_PROMOTION_ACTION",
        message:
          'Request body must contain either targetClassId (string) or action: "graduate"',
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  const targetClassId = hasTargetClassId
    ? (body as { targetClassId: string }).targetClassId
    : null;

  // SAME_CLASS guard (promote only)
  if (hasTargetClassId && sourceClassId === targetClassId) {
    res.status(400).json({
      error: {
        code: "SAME_CLASS",
        message: "Source and target class cannot be the same",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Verify source class exists in tenant
  const sourceCheck = await pool.query<{ id: string }>(
    "SELECT id FROM classes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [sourceClassId, tenantId],
  );
  if ((sourceCheck.rowCount ?? 0) === 0) {
    send404(res, "Source class not found");
    return;
  }

  if (isGraduate) {
    // ── GRADUATION: set class_id = NULL, status = 'Graduated' for Active students ──
    const graduateResult = await pool.query<{ id: string }>(
      `UPDATE students
       SET class_id = NULL, status = 'Graduated', updated_at = NOW()
       WHERE class_id = $1 AND tenant_id = $2 AND deleted_at IS NULL AND status = 'Active'
       RETURNING id`,
      [sourceClassId, tenantId],
    );
    res.status(200).json({
      graduated: graduateResult.rowCount ?? 0,
      failed: [],
    });
  } else {
    // ── PROMOTE: move students to targetClass ─────────────────────────────────────
    const existingTarget = await pool.query<{ id: string }>(
      "SELECT id FROM classes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [targetClassId, tenantId],
    );
    if ((existingTarget.rowCount ?? 0) === 0) {
      send404(res, "Target class not found");
      return;
    }

    const promoteResult = await pool.query<{ id: string }>(
      `UPDATE students
       SET class_id = $1, updated_at = NOW()
       WHERE class_id = $2 AND tenant_id = $3 AND deleted_at IS NULL AND status = 'Active'
       RETURNING id`,
      [targetClassId, sourceClassId, tenantId],
    );
    res.status(200).json({
      updated: promoteResult.rowCount ?? 0,
      failed: [],
    });
  }
}
