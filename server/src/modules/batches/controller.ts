import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../../db/pool";
import { send400, send404 } from "../../utils/errors";
import { bulkSoftDelete } from "../../utils/bulkDelete";
import { BatchRow, BatchStatus, BulkDeleteRequest } from "../../types";

function fmt(b: BatchRow) {
  return {
    id: b.id,
    tenantId: b.tenant_id,
    name: b.name,
    startYear: b.start_year,
    endYear: b.end_year,
    status: b.status,
    createdAt: b.created_at.toISOString(),
    updatedAt: b.updated_at.toISOString(),
  };
}

export async function listBatches(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { status } = req.query as { status?: string };
  const params: unknown[] = [tenantId];
  let where = "tenant_id = $1 AND deleted_at IS NULL";
  if (status === "Active" || status === "Graduated") {
    where += " AND status = $2";
    params.push(status);
  }
  const result = await pool.query<BatchRow>(
    `SELECT id, tenant_id, name, start_year, end_year, status, deleted_at, created_at, updated_at
     FROM batches WHERE ${where} ORDER BY start_year DESC`,
    params,
  );
  res.status(200).json({ batches: result.rows.map(fmt) });
}

export async function createBatch(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { name, startYear, endYear, status } = req.body as {
    name?: string;
    startYear?: number;
    endYear?: number;
    status?: string;
  };
  if (!name || !startYear || !endYear) {
    send400(res, "name, startYear, and endYear are required");
    return;
  }
  if (endYear <= startYear) {
    send400(res, "endYear must be greater than startYear");
    return;
  }
  const batchStatus: BatchStatus =
    status === "Graduated" ? "Graduated" : "Active";
  const id = `B-${uuidv4()}`;
  const result = await pool.query<BatchRow>(
    `INSERT INTO batches (id, tenant_id, name, start_year, end_year, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING id, tenant_id, name, start_year, end_year, status, deleted_at, created_at, updated_at`,
    [id, tenantId, name.trim(), startYear, endYear, batchStatus],
  );
  res.status(201).json({ batch: fmt(result.rows[0]!) });
}

export async function updateBatch(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };
  const { name, status } = req.body as { name?: string; status?: string };
  if (!name && !status) {
    send400(res, "At least one of name or status is required");
    return;
  }
  const sets: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [];
  let idx = 1;
  if (name) {
    sets.push(`name = $${idx++}`);
    params.push(name.trim());
  }
  if (status === "Active" || status === "Graduated") {
    sets.push(`status = $${idx++}`);
    params.push(status);
  }
  params.push(id, tenantId);
  const result = await pool.query<BatchRow>(
    `UPDATE batches SET ${sets.join(", ")}
     WHERE id = $${idx} AND tenant_id = $${idx + 1} AND deleted_at IS NULL
     RETURNING id, tenant_id, name, start_year, end_year, status, deleted_at, created_at, updated_at`,
    params,
  );
  if ((result.rowCount ?? 0) === 0) {
    send404(res, "Batch not found");
    return;
  }
  res.status(200).json({ batch: fmt(result.rows[0]!) });
}

export async function deleteBatch(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };
  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM batches WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  if ((existing.rowCount ?? 0) === 0) {
    send404(res, "Batch not found");
    return;
  }
  const classCheck = await pool.query<{ count: string }>(
    "SELECT COUNT(*) as count FROM classes WHERE batch_id = $1 AND deleted_at IS NULL",
    [id],
  );
  if (parseInt(classCheck.rows[0]?.count ?? "0", 10) > 0) {
    res.status(409).json({
      error: {
        code: "HAS_REFERENCES",
        message: "Cannot delete: classes are assigned to this batch",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }
  await pool.query(
    "UPDATE batches SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
    [id, tenantId],
  );
  res.status(204).send();
}

export async function bulkDeleteBatches(
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
    "batches",
    ids,
    tenantId,
    async (id, _tid, p) => {
      const check = await p.query<{ count: string }>(
        "SELECT COUNT(*) as count FROM classes WHERE batch_id = $1 AND deleted_at IS NULL",
        [id],
      );
      return parseInt(check.rows[0]?.count ?? "0", 10) > 0
        ? "Cannot delete: classes reference this batch"
        : null;
    },
  );
  res.status(200).json(result);
}
