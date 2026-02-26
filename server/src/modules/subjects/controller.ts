import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../../db/pool";
import { send400, send404 } from "../../utils/errors";
import { bulkSoftDelete } from "../../utils/bulkDelete";
import { SubjectRow, BulkDeleteRequest } from "../../types";

function fmt(s: SubjectRow) {
  return {
    id: s.id,
    tenantId: s.tenant_id,
    name: s.name,
    code: s.code ?? null,
    createdAt: s.created_at.toISOString(),
    updatedAt: s.updated_at.toISOString(),
  };
}

export async function listSubjects(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const result = await pool.query<SubjectRow>(
    `SELECT id, tenant_id, name, code, deleted_at, created_at, updated_at
     FROM subjects WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY name ASC`,
    [tenantId],
  );
  res.status(200).json({ subjects: result.rows.map(fmt) });
}

export async function createSubject(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { name, code } = req.body as { name?: string; code?: string };
  if (!name) {
    send400(res, "name is required");
    return;
  }
  const id = `SUB-${uuidv4()}`;
  const result = await pool.query<SubjectRow>(
    `INSERT INTO subjects (id, tenant_id, name, code, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING id, tenant_id, name, code, deleted_at, created_at, updated_at`,
    [id, tenantId, name.trim(), code?.trim() ?? null],
  );
  res.status(201).json({ subject: fmt(result.rows[0]!) });
}

export async function updateSubject(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };
  const { name, code } = req.body as { name?: string; code?: string };
  if (!name && code === undefined) {
    send400(res, "At least one of name or code is required");
    return;
  }
  const sets: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [];
  let idx = 1;
  if (name) {
    sets.push(`name = $${idx++}`);
    params.push(name.trim());
  }
  if (code !== undefined) {
    sets.push(`code = $${idx++}`);
    params.push(code.trim() || null);
  }
  params.push(id, tenantId);
  const result = await pool.query<SubjectRow>(
    `UPDATE subjects SET ${sets.join(", ")}
     WHERE id = $${idx} AND tenant_id = $${idx + 1} AND deleted_at IS NULL
     RETURNING id, tenant_id, name, code, deleted_at, created_at, updated_at`,
    params,
  );
  if ((result.rowCount ?? 0) === 0) {
    send404(res, "Subject not found");
    return;
  }
  res.status(200).json({ subject: fmt(result.rows[0]!) });
}

export async function deleteSubject(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };
  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM subjects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  if ((existing.rowCount ?? 0) === 0) {
    send404(res, "Subject not found");
    return;
  }
  const tsCheck = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM timeslots
     WHERE subject_id = $1 AND effective_to IS NULL AND deleted_at IS NULL`,
    [id],
  );
  if (parseInt(tsCheck.rows[0]?.count ?? "0", 10) > 0) {
    res.status(409).json({
      error: {
        code: "HAS_REFERENCES",
        message: "Cannot delete: subject has active timeslot assignments",
        details: {},
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }
  await pool.query(
    "UPDATE subjects SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
    [id, tenantId],
  );
  res.status(204).send();
}

export async function bulkDeleteSubjects(
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
    "subjects",
    ids,
    tenantId,
    async (id, _tid, p) => {
      const check = await p.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM timeslots
       WHERE subject_id = $1 AND effective_to IS NULL AND deleted_at IS NULL`,
        [id],
      );
      return parseInt(check.rows[0]?.count ?? "0", 10) > 0
        ? "Cannot delete: subject has active timeslot assignments"
        : null;
    },
  );
  res.status(200).json(result);
}
