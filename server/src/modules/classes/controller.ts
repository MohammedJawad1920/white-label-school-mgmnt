import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../../db/pool";
import { send400, send404 } from "../../utils/errors";
import { bulkSoftDelete } from "../../utils/bulkDelete";
import { ClassRow, BulkDeleteRequest } from "../../types";

function fmt(c: ClassRow) {
  return {
    id: c.id,
    tenantId: c.tenant_id,
    name: c.name,
    batchId: c.batch_id,
    createdAt: c.created_at.toISOString(),
    updatedAt: c.updated_at.toISOString(),
  };
}

export async function listClasses(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { batchId } = req.query as { batchId?: string };
  const params: unknown[] = [tenantId];
  let where = "tenant_id = $1 AND deleted_at IS NULL";
  if (batchId) {
    where += " AND batch_id = $2";
    params.push(batchId);
  }
  const result = await pool.query<ClassRow>(
    `SELECT id, tenant_id, name, batch_id, deleted_at, created_at, updated_at
     FROM classes WHERE ${where} ORDER BY name ASC`,
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
  const batchCheck = await pool.query<{ id: string }>(
    "SELECT id FROM batches WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
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
  res.status(201).json({ class: fmt(result.rows[0]!) });
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
  res.status(200).json({ class: fmt(result.rows[0]!) });
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
