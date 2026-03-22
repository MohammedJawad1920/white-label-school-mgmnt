/**
 * Students Controller — v3.5 CR-13
 *
 * KEY INVARIANTS:
 * - student.batch_id MUST equal class.batch_id (batch/class mismatch guard)
 * - POST /students atomically creates a linked users row (single transaction)
 * - Student login:  email = {admissionNumber.toLowerCase()}@{tenantSlug}.local
 *                   password = bcrypt(admissionNumber + DDMMYYYY(dob))
 * - PUT /students/:id — if dob or admissionNumber changes, recomputes
 *   linkedUser.password_hash (and email) in the same transaction
 * - PUT /students/:studentId/link-account — DEPRECATED in v3.5 (backend retained
 *   for migration only; removed from frontend)
 */
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { pool, withTransaction } from "../../db/pool";
import { config } from "../../config/env";
import { send400, send404, send409 } from "../../utils/errors";
import { bulkSoftDelete } from "../../utils/bulkDelete";
import { StudentRow, BulkDeleteRequest, StudentStatus } from "../../types";

// ── Row type returned by queries that JOIN on tenants ────────────────────────
type StudentFmtRow = StudentRow & {
  class_name?: string | null;
  batch_name?: string;
  tenant_slug: string;
};

// Helper: normalise pg DATE (may arrive as Date object or ISO string)
function dobToISODate(dob: Date | string): string {
  if (dob instanceof Date) return dob.toISOString().split("T")[0]!;
  return (dob as string).split("T")[0]!;
}

// Helper: DDMMYYYY from a YYYY-MM-DD string
function dDMMYYYY(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}${month}${year}`;
}

function fmt(s: StudentFmtRow) {
  const dobStr = dobToISODate(s.dob);
  const loginId = `${s.admission_number.toLowerCase()}@${s.tenant_slug}.local`;
  return {
    id: s.id,
    tenantId: s.tenant_id,
    name: s.name,
    classId: s.class_id, // v4.0 CR-21: may be null (graduated student)
    className: s.class_name ?? null, // null when class_id is null
    batchId: s.batch_id,
    batchName: s.batch_name,
    userId: s.user_id ?? null,
    admissionNumber: s.admission_number,
    dob: dobStr,
    status: s.status, // v4.0 CR-22
    loginId,
    createdAt: s.created_at.toISOString(),
    updatedAt: s.updated_at.toISOString(),
  };
}

// Base SELECT used by all handlers that call fmt()
const STUDENT_SELECT = `
  SELECT s.id, s.tenant_id, s.name, s.class_id, s.batch_id, s.user_id,
         s.admission_number, s.dob, s.status, s.deleted_at, s.created_at, s.updated_at,
         t.slug AS tenant_slug,
         c.name AS class_name,
         b.name AS batch_name
  FROM students s
  JOIN tenants t ON t.id = s.tenant_id
  LEFT JOIN classes c ON c.id = s.class_id
  LEFT JOIN batches b ON b.id = s.batch_id
`;

// ── GET /api/students ────────────────────────────────────────────────────────
export async function listStudents(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { classId, batchId, search, status } = req.query as {
    classId?: string;
    batchId?: string;
    search?: string;
    status?: string; // v4.0 CR-22
  };
  const params: unknown[] = [tenantId];
  const conditions = ["s.tenant_id = $1", "s.deleted_at IS NULL"];
  let idx = 2;
  if (classId) {
    conditions.push(`s.class_id = $${idx++}`);
    params.push(classId);
  }
  if (batchId) {
    conditions.push(`s.batch_id = $${idx++}`);
    params.push(batchId);
  }
  if (search) {
    conditions.push(
      `(s.name ILIKE $${idx} OR s.admission_number ILIKE $${idx})`,
    );
    params.push(`%${search}%`);
    idx++;
  }
  // v4.0 CR-22: filter by status
  if (
    status === "Active" ||
    status === "DroppedOff" ||
    status === "Graduated"
  ) {
    conditions.push(`s.status = $${idx++}`);
    params.push(status);
  }
  const result = await pool.query<StudentFmtRow>(
    `${STUDENT_SELECT} WHERE ${conditions.join(" AND ")} ORDER BY s.name ASC`,
    params,
  );
  res.status(200).json({ students: result.rows.map(fmt) });
}
// ── GET /api/students/:id ─────────────────────────────────────────────────
// CR-15: Admin—any student; Teacher—scoped to class; Student—own record only
export async function getStudent(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRoles = req.userRoles ?? [];
  const { id } = req.params as { id: string };

  const result = await pool.query<StudentFmtRow>(
    `${STUDENT_SELECT}
     WHERE s.id = $1 AND s.tenant_id = $2 AND s.deleted_at IS NULL`,
    [id, tenantId],
  );
  const student = result.rows[0];

  if (!student) {
    send404(res, "Student not found");
    return;
  }

  // Student role: only own record
  if (userRoles.includes("Student")) {
    if (student.user_id !== userId) {
      res.status(403).json({
        error: {
          code: "STUDENT_ACCESS_DENIED",
          message: "You can only view your own student record",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }
    res.status(200).json({ student: fmt(student) });
    return;
  }

  // Teacher: scoped to classes they are currently assigned to teach
  if (userRoles.includes("Teacher") && !userRoles.includes("Admin")) {
    const classCheck = await pool.query<{ class_id: string }>(
      `SELECT DISTINCT s2.class_id
       FROM students s2
       JOIN timeslots ts ON ts.class_id = s2.class_id
       WHERE s2.id = $1
         AND ts.teacher_id = $2
         AND ts.tenant_id = $3
         AND ts.deleted_at IS NULL`,
      [id, userId, tenantId],
    );
    if ((classCheck.rowCount ?? 0) === 0) {
      res.status(403).json({
        error: {
          code: "STUDENT_ACCESS_DENIED",
          message: "You can only view students in your assigned classes",
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }
  }

  res.status(200).json({ student: fmt(student) });
}
// ── POST /api/students ───────────────────────────────────────────────────────
// v3.5 CR-13: atomically creates a users row + students row in one transaction
export async function createStudent(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { name, classId, batchId, admissionNumber, dob } = req.body as {
    name?: string;
    classId?: string;
    batchId?: string;
    admissionNumber?: string;
    dob?: string;
  };

  if (!name || !classId || !batchId || !admissionNumber || !dob) {
    send400(
      res,
      "name, classId, batchId, admissionNumber, and dob are required",
    );
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    send400(res, "dob must be a valid date in YYYY-MM-DD format");
    return;
  }

  const trimmedAdmission = admissionNumber.trim();
  if (trimmedAdmission.length === 0 || trimmedAdmission.length > 50) {
    send400(res, "admissionNumber must be between 1 and 50 characters");
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

  // ── BATCH/CLASS MISMATCH GUARD ───────────────────────────────────────────
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

  // Check admissionNumber uniqueness
  const conflict = await pool.query<{ id: string }>(
    `SELECT id FROM students WHERE tenant_id = $1 AND admission_number = $2 AND deleted_at IS NULL`,
    [tenantId, trimmedAdmission],
  );
  if ((conflict.rowCount ?? 0) > 0) {
    send409(
      res,
      "Admission number already exists for this school",
      "ADMISSIONNUMBERCONFLICT",
    );
    return;
  }

  // Get tenant slug for loginId derivation
  const tenantResult = await pool.query<{ slug: string }>(
    "SELECT slug FROM tenants WHERE id = $1",
    [tenantId],
  );
  const tenantSlug = tenantResult.rows[0]!.slug;
  const loginId = `${trimmedAdmission.toLowerCase()}@${tenantSlug}.local`;
  const rawPassword = `${trimmedAdmission}${dDMMYYYY(dob)}`;
  const passwordHash = await bcrypt.hash(rawPassword, config.BCRYPT_ROUNDS);

  const userId = uuidv4();
  const studentId = uuidv4();

  try {
    await withTransaction(async (client) => {
      // 1. Create the user row (roles: ["Student"])
      await client.query(
        `INSERT INTO users
           (id, tenant_id, name, email, password_hash, roles, must_change_password, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, '["Student"]'::jsonb, true, NOW(), NOW())`,
        [userId, tenantId, name.trim(), loginId, passwordHash],
      );
      // 2. Create the student row referencing the new user
      await client.query(
        `INSERT INTO students (id, tenant_id, name, class_id, batch_id, user_id,
                               admission_number, dob, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [
          studentId,
          tenantId,
          name.trim(),
          classId,
          batchId,
          userId,
          trimmedAdmission,
          dob,
        ],
      );
    });
  } catch (err) {
    // PG unique_violation (23505): derived loginId already taken by an active user
    // (e.g. admissionNumber reused after a soft-delete of a previous student).
    if ((err as { code?: string }).code === "23505") {
      send409(
        res,
        "Admission number already exists for this school",
        "ADMISSIONNUMBERCONFLICT",
      );
      return;
    }
    throw err;
  }

  const created = await pool.query<StudentFmtRow>(
    `${STUDENT_SELECT} WHERE s.id = $1 AND s.tenant_id = $2`,
    [studentId, tenantId],
  );
  res.status(201).json({ student: fmt(created.rows[0]!) });
}

// ── PUT /api/students/:id ────────────────────────────────────────────────────
// v3.5 CR-13: updates student; resets linked user credentials when dob/admissionNumber changes
export async function updateStudent(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };
  const { name, classId, batchId, admissionNumber, dob, status } = req.body as {
    name?: string;
    classId?: string;
    batchId?: string;
    admissionNumber?: string;
    dob?: string;
    status?: string; // v4.0 CR-22
  };

  if (!name && !classId && !batchId && !admissionNumber && !dob && !status) {
    send400(res, "At least one field must be provided");
    return;
  }

  // v4.0 CR-22: Graduated status is system-set only via graduation action; reject here
  if (status === "Graduated") {
    send400(
      res,
      "status 'Graduated' cannot be set directly. Use the graduation action on the class.",
      "VALIDATION_ERROR",
    );
    return;
  }

  // Validate status value if provided
  if (status !== undefined && status !== "Active" && status !== "DroppedOff") {
    send400(
      res,
      "status must be one of: Active, DroppedOff",
      "VALIDATION_ERROR",
    );
    return;
  }

  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    send400(res, "dob must be a valid date in YYYY-MM-DD format");
    return;
  }

  if (admissionNumber !== undefined) {
    const t = admissionNumber.trim();
    if (t.length === 0 || t.length > 50) {
      send400(res, "admissionNumber must be between 1 and 50 characters");
      return;
    }
  }

  // Fetch current student (with tenant slug)
  const studentResult = await pool.query<StudentFmtRow>(
    `${STUDENT_SELECT} WHERE s.id = $1 AND s.tenant_id = $2 AND s.deleted_at IS NULL`,
    [id, tenantId],
  );
  if ((studentResult.rowCount ?? 0) === 0) {
    send404(res, "Student not found");
    return;
  }
  const current = studentResult.rows[0]!;
  const currentDob = dobToISODate(current.dob);

  const finalAdmission = admissionNumber?.trim() ?? current.admission_number;
  const finalDob = dob ?? currentDob;
  const finalName = name?.trim() ?? current.name;

  // Validate class if provided
  let finalClassId = current.class_id;
  let resolvedBatchId = current.batch_id;
  if (classId) {
    const classResult = await pool.query<{ id: string; batch_id: string }>(
      "SELECT id, batch_id FROM classes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [classId, tenantId],
    );
    if ((classResult.rowCount ?? 0) === 0) {
      send404(res, "Class not found");
      return;
    }
    finalClassId = classId;
    resolvedBatchId = classResult.rows[0]!.batch_id;
  }

  const finalBatchId = batchId ?? resolvedBatchId;

  if (classId && batchId && batchId !== resolvedBatchId) {
    send400(
      res,
      "The selected class does not belong to the selected batch",
      "BATCH_CLASS_MISMATCH",
    );
    return;
  }

  // Independent batchId change (without classId)
  if (batchId && !classId) {
    const batchCheck = await pool.query<{ id: string }>(
      "SELECT id FROM batches WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [batchId, tenantId],
    );
    if ((batchCheck.rowCount ?? 0) === 0) {
      send404(res, "Batch not found");
      return;
    }
  }

  // Admission number uniqueness check (excluding self)
  if (admissionNumber && finalAdmission !== current.admission_number) {
    const conflict = await pool.query<{ id: string }>(
      `SELECT id FROM students
       WHERE tenant_id = $1 AND admission_number = $2 AND deleted_at IS NULL AND id != $3`,
      [tenantId, finalAdmission, id],
    );
    if ((conflict.rowCount ?? 0) > 0) {
      send409(
        res,
        "Admission number already exists for this school",
        "ADMISSIONNUMBERCONFLICT",
      );
      return;
    }
  }

  const credentialsChanged =
    finalAdmission !== current.admission_number || finalDob !== currentDob;
  const shouldUpdateCredentials =
    current.user_id !== null && credentialsChanged;

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE students
       SET name = $1, class_id = $2, batch_id = $3,
           admission_number = $4, dob = $5, status = $6, updated_at = NOW()
       WHERE id = $7 AND tenant_id = $8`,
      [
        finalName,
        finalClassId,
        finalBatchId,
        finalAdmission,
        finalDob,
        status ?? current.status, // v4.0 CR-22: preserve existing status if not changing
        id,
        tenantId,
      ],
    );

    if (shouldUpdateCredentials) {
      const newLoginId = `${finalAdmission.toLowerCase()}@${current.tenant_slug}.local`;
      const rawPassword = `${finalAdmission}${dDMMYYYY(finalDob)}`;
      const passwordHash = await bcrypt.hash(rawPassword, config.BCRYPT_ROUNDS);
      await client.query(
        `UPDATE users SET email = $1, password_hash = $2, updated_at = NOW()
         WHERE id = $3 AND tenant_id = $4`,
        [newLoginId, passwordHash, current.user_id, tenantId],
      );
    }
  });

  const updated = await pool.query<StudentFmtRow>(
    `${STUDENT_SELECT} WHERE s.id = $1 AND s.tenant_id = $2`,
    [id, tenantId],
  );
  res.status(200).json({ student: fmt(updated.rows[0]!) });
}

// ── PUT /api/students/:studentId/link-account  (v3.4 CR-08 — DEPRECATED v3.5) ──
export async function linkStudentAccount(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { studentId } = req.params as { studentId: string };
  const { userId } = req.body as { userId?: string };

  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    send400(res, "userId is required");
    return;
  }

  const studentResult = await pool.query<StudentFmtRow>(
    `${STUDENT_SELECT} WHERE s.id = $1 AND s.tenant_id = $2 AND s.deleted_at IS NULL`,
    [studentId, tenantId],
  );
  if ((studentResult.rowCount ?? 0) === 0) {
    send404(res, "Student not found");
    return;
  }
  const student = studentResult.rows[0]!;

  const userResult = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [userId.trim(), tenantId],
  );
  if ((userResult.rowCount ?? 0) === 0) {
    send404(res, "User not found");
    return;
  }

  if (student.user_id !== null) {
    send409(
      res,
      "This student is already linked to a user account",
      "USER_ALREADY_LINKED",
    );
    return;
  }

  const alreadyLinked = await pool.query<{ id: string }>(
    "SELECT id FROM students WHERE user_id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [userId.trim(), tenantId],
  );
  if ((alreadyLinked.rowCount ?? 0) > 0) {
    send409(
      res,
      "This user is already linked to another student record",
      "USER_ALREADY_LINKED",
    );
    return;
  }

  await pool.query(
    `UPDATE students SET user_id = $1, updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3`,
    [userId.trim(), studentId, tenantId],
  );

  const updated = await pool.query<StudentFmtRow>(
    `${STUDENT_SELECT} WHERE s.id = $1 AND s.tenant_id = $2`,
    [studentId, tenantId],
  );
  res.status(200).json({ student: fmt(updated.rows[0]!) });
}

// ── DELETE /api/students/:id ─────────────────────────────────────────────────
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

// ── POST /api/students/bulk — CR-27 ─────────────────────────────────────────
export async function bulkDeleteStudents(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { studentIds } = req.body as { studentIds?: unknown };
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    send400(res, "studentIds must be a non-empty array");
    return;
  }
  if (studentIds.length > 100) {
    send400(res, "Cannot bulk delete more than 100 records at once");
    return;
  }
  const result = await bulkSoftDelete(
    pool,
    "students",
    studentIds as string[],
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
  res.status(200).json({ deletedCount: result.deleted.length });
}
