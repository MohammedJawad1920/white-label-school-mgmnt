/**
 * Students Controller
 *
 * KEY INVARIANT: student.batch_id MUST equal class.batch_id
 * WHY: A student belongs to a batch (academic year). Their class must be
 * from that same batch. Mismatches would corrupt attendance aggregation.
 * Validated on create (no PUT /students/:id in OpenAPI contract).
 */
import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../../db/pool";
import { send400, send404 } from "../../utils/errors";
import { bulkSoftDelete } from "../../utils/bulkDelete";
import { StudentRow, BulkDeleteRequest } from "../../types";

function fmt(s: StudentRow) {
  return {
    id: s.id,
    tenantId: s.tenant_id,
    name: s.name,
    classId: s.class_id,
    batchId: s.batch_id,
    createdAt: s.created_at.toISOString(),
    updatedAt: s.updated_at.toISOString(),
  };
}

export async function listStudents(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { classId, batchId } = req.query as {
    classId?: string;
    batchId?: string;
  };
  const params: unknown[] = [tenantId];
  const conditions = ["tenant_id = $1", "deleted_at IS NULL"];
  let idx = 2;
  if (classId) {
    conditions.push(`class_id = $${idx++}`);
    params.push(classId);
  }
  if (batchId) {
    conditions.push(`batch_id = $${idx++}`);
    params.push(batchId);
  }
  const result = await pool.query<StudentRow>(
    `SELECT id, tenant_id, name, class_id, batch_id, deleted_at, created_at, updated_at
     FROM students WHERE ${conditions.join(" AND ")} ORDER BY name ASC`,
    params,
  );
  res.status(200).json({ students: result.rows.map(fmt) });
}

export async function createStudent(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { name, classId, batchId } = req.body as {
    name?: string;
    classId?: string;
    batchId?: string;
  };

  if (!name || !classId || !batchId) {
    send400(res, "name, classId, and batchId are required");
    return;
  }

  // Verify class exists in this tenant
  const classResult = await pool.query<{ id: string; batch_id: string }>(
    "SELECT id, batch_id FROM classes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [classId, tenantId],
  );
  if ((classResult.rowCount ?? 0) === 0) {
    send404(res, "Class not found");
    return;
  }

  // ── BATCH/CLASS MISMATCH GUARD ─────────────────────────────────────
  // The class must belong to the same batch as the student.
  if (classResult.rows[0]!.batch_id !== batchId) {
    send400(
      res,
      "The selected class does not belong to the selected batch",
      "BATCH_CLASS_MISMATCH",
    );
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

  const id = `STU-${uuidv4()}`;
  const result = await pool.query<StudentRow>(
    `INSERT INTO students (id, tenant_id, name, class_id, batch_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING id, tenant_id, name, class_id, batch_id, deleted_at, created_at, updated_at`,
    [id, tenantId, name.trim(), classId, batchId],
  );
  res.status(201).json({ student: fmt(result.rows[0]!) });
}

export async function deleteStudent(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };
  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM students WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [id, tenantId],
  );
  if ((existing.rowCount ?? 0) === 0) {
    send404(res, "Student not found");
    return;
  }
  const arCheck = await pool.query<{ count: string }>(
    "SELECT COUNT(*) as count FROM attendance_records WHERE student_id = $1",
    [id],
  );
  if (parseInt(arCheck.rows[0]?.count ?? "0", 10) > 0) {
    res.status(409).json({
      error: {
        code: "HAS_REFERENCES",
        message: "Cannot delete: student has attendance records",
        details: {},
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }
  await pool.query(
    "UPDATE students SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
    [id, tenantId],
  );
  res.status(204).send();
}

export async function bulkDeleteStudents(
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
    "students",
    ids,
    tenantId,
    async (id, _tid, p) => {
      const check = await p.query<{ count: string }>(
        "SELECT COUNT(*) as count FROM attendance_records WHERE student_id = $1",
        [id],
      );
      return parseInt(check.rows[0]?.count ?? "0", 10) > 0
        ? "Cannot delete: student has attendance records"
        : null;
    },
  );
  res.status(200).json(result);
}
