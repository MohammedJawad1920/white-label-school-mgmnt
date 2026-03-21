/**
 * Fees Controller — v5.0
 *
 * POST   /api/v1/fees/charges             — createCharge (Admin)
 * POST   /api/v1/fees/charges/bulk        — bulkCharge (Admin)
 * GET    /api/v1/fees/charges             — listCharges
 * DELETE /api/v1/fees/charges/:id         — deleteCharge (Admin)
 * POST   /api/v1/fees/charges/:id/payments — recordPayment (Admin)
 * GET    /api/v1/fees/summary             — feeSummary (Admin, Teacher)
 */

import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool, withTransaction } from "../../db/pool";
import { send400, send404 } from "../../utils/errors";
import { logger } from "../../utils/logger";
import {
  FeeChargeRow,
  FeePaymentRow,
  ApiFeeCharge,
  ApiFeePayment,
  FeeCategory,
} from "../../types";

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_CATEGORIES: FeeCategory[] = [
  "BoardExamFee",
  "UniversityExamFee",
  "InternalExamFee",
  "Books",
  "Other",
];

const VALID_PAYMENT_MODES = ["Cash", "SelfPaid"] as const;
type PaymentMode = (typeof VALID_PAYMENT_MODES)[number];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const VALID_TARGET_TYPES = ["students", "class", "level"] as const;
type TargetType = (typeof VALID_TARGET_TYPES)[number];

// ─── Extended row types ───────────────────────────────────────────────────────

type FeeChargeWithComputed = FeeChargeRow & {
  student_name: string;
  total_paid: string; // SUM returns string from pg
};

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatFeeCharge(row: FeeChargeWithComputed): ApiFeeCharge {
  const amount = Number(row.amount);
  const totalPaid = parseFloat(row.total_paid ?? "0");
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_id,
    studentName: row.student_name,
    sessionId: row.session_id,
    description: row.description,
    category: row.category,
    amount,
    dueDate: row.due_date ? String(row.due_date).slice(0, 10) : null,
    totalPaid,
    balance: amount - totalPaid,
    notes: row.notes,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

function formatFeePayment(row: FeePaymentRow): ApiFeePayment {
  return {
    id: row.id,
    chargeId: row.charge_id,
    amountPaid: Number(row.amount_paid),
    paymentMode: row.payment_mode,
    paidAt: String(row.paid_at).slice(0, 10),
    receiptNumber: row.receipt_number,
    recordedBy: row.recorded_by,
    notes: row.notes,
    recordedAt:
      row.recorded_at instanceof Date
        ? row.recorded_at.toISOString()
        : String(row.recorded_at),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Query that returns a fee charge with computed totalPaid and balance */
const CHARGE_SELECT = `
  SELECT fc.*,
         s.name AS student_name,
         COALESCE(SUM(fp.amount_paid), 0) AS total_paid
  FROM fee_charges fc
  JOIN students s ON s.id = fc.student_id
  LEFT JOIN fee_payments fp ON fp.charge_id = fc.id
`;

// ═══════════════════════════════════════════════════════════════════
// POST /fees/charges
// ═══════════════════════════════════════════════════════════════════

export async function createCharge(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;

  const {
    studentId,
    sessionId,
    description,
    category,
    amount,
    dueDate,
    notes,
  } = req.body as {
    studentId?: string;
    sessionId?: string;
    description?: string;
    category?: string;
    amount?: number;
    dueDate?: string;
    notes?: string;
  };

  if (!studentId || typeof studentId !== "string") {
    send400(res, "studentId is required");
    return;
  }
  if (!sessionId || typeof sessionId !== "string") {
    send400(res, "sessionId is required");
    return;
  }
  if (
    !description ||
    typeof description !== "string" ||
    description.trim().length === 0
  ) {
    send400(res, "description is required");
    return;
  }
  if (!category || !VALID_CATEGORIES.includes(category as FeeCategory)) {
    send400(res, `category must be one of: ${VALID_CATEGORIES.join(", ")}`);
    return;
  }
  if (amount === undefined || typeof amount !== "number" || amount <= 0) {
    send400(res, "amount must be a positive number");
    return;
  }
  if (dueDate !== undefined && dueDate !== null && !DATE_RE.test(dueDate)) {
    send400(res, "dueDate must be a valid date in YYYY-MM-DD format");
    return;
  }

  // Verify student exists in tenant
  const studentCheck = await pool.query(
    "SELECT id FROM students WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [studentId, tenantId],
  );
  if ((studentCheck.rowCount ?? 0) === 0) {
    send404(res, "Student not found");
    return;
  }

  // Verify session exists in tenant
  const sessionCheck = await pool.query(
    "SELECT id FROM academic_sessions WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [sessionId, tenantId],
  );
  if ((sessionCheck.rowCount ?? 0) === 0) {
    send404(res, "Academic session not found");
    return;
  }

  const id = uuidv4();
  await pool.query(
    `INSERT INTO fee_charges
       (id, tenant_id, student_id, session_id, description, category, amount,
        due_date, raised_by, notes, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
    [
      id,
      tenantId,
      studentId,
      sessionId,
      description.trim(),
      category,
      amount,
      dueDate ?? null,
      userId,
      notes ?? null,
    ],
  );

  const result = await pool.query<FeeChargeWithComputed>(
    `${CHARGE_SELECT}
     WHERE fc.id = $1
     GROUP BY fc.id, s.name`,
    [id],
  );

  res.status(201).json({ charge: formatFeeCharge(result.rows[0]!) });
}

// ═══════════════════════════════════════════════════════════════════
// POST /fees/charges/bulk
// ═══════════════════════════════════════════════════════════════════

export async function bulkCharge(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;

  const {
    targetType,
    studentIds,
    classId,
    level,
    sessionId,
    description,
    category,
    amount,
    dueDate,
  } = req.body as {
    targetType?: string;
    studentIds?: string[];
    classId?: string;
    level?: string;
    sessionId?: string;
    description?: string;
    category?: string;
    amount?: number;
    dueDate?: string;
  };

  if (!targetType || !VALID_TARGET_TYPES.includes(targetType as TargetType)) {
    send400(res, `targetType must be one of: ${VALID_TARGET_TYPES.join(", ")}`);
    return;
  }
  if (!sessionId || typeof sessionId !== "string") {
    send400(res, "sessionId is required");
    return;
  }
  if (
    !description ||
    typeof description !== "string" ||
    description.trim().length === 0
  ) {
    send400(res, "description is required");
    return;
  }
  if (!category || !VALID_CATEGORIES.includes(category as FeeCategory)) {
    send400(res, `category must be one of: ${VALID_CATEGORIES.join(", ")}`);
    return;
  }
  if (amount === undefined || typeof amount !== "number" || amount <= 0) {
    send400(res, "amount must be a positive number");
    return;
  }
  if (dueDate !== undefined && dueDate !== null && !DATE_RE.test(dueDate)) {
    send400(res, "dueDate must be a valid date in YYYY-MM-DD format");
    return;
  }

  // Verify session exists in tenant
  const sessionCheck = await pool.query(
    "SELECT id FROM academic_sessions WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    [sessionId, tenantId],
  );
  if ((sessionCheck.rowCount ?? 0) === 0) {
    send404(res, "Academic session not found");
    return;
  }

  // Resolve target student IDs
  let resolvedStudentIds: string[] = [];

  if (targetType === "students") {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      send400(res, "studentIds array is required for targetType 'students'");
      return;
    }
    resolvedStudentIds = studentIds;
  } else if (targetType === "class") {
    if (!classId || typeof classId !== "string") {
      send400(res, "classId is required for targetType 'class'");
      return;
    }
    const studentsResult = await pool.query<{ id: string }>(
      `SELECT id FROM students
       WHERE class_id = $1 AND tenant_id = $2 AND status = 'Active' AND deleted_at IS NULL`,
      [classId, tenantId],
    );
    resolvedStudentIds = studentsResult.rows.map((r) => r.id);
  } else if (targetType === "level") {
    if (!level || typeof level !== "string") {
      send400(res, "level is required for targetType 'level'");
      return;
    }
    const studentsResult = await pool.query<{ id: string }>(
      `SELECT DISTINCT s.id FROM students s
       JOIN classes c ON c.id = s.class_id
       WHERE c.level = $1 AND s.tenant_id = $2 AND s.status = 'Active' AND s.deleted_at IS NULL`,
      [level, tenantId],
    );
    resolvedStudentIds = studentsResult.rows.map((r) => r.id);
  }

  if (resolvedStudentIds.length === 0) {
    res.status(201).json({ charged: 0, skipped: 0 });
    return;
  }

  // Find which students already have a charge with same description+session
  const existingResult = await pool.query<{ student_id: string }>(
    `SELECT student_id FROM fee_charges
     WHERE tenant_id = $1 AND session_id = $2 AND description = $3
       AND student_id = ANY($4::text[])`,
    [tenantId, sessionId, description.trim(), resolvedStudentIds],
  );
  const alreadyCharged = new Set(existingResult.rows.map((r) => r.student_id));

  const toCharge = resolvedStudentIds.filter((sid) => !alreadyCharged.has(sid));
  let charged = 0;

  for (const sid of toCharge) {
    const chargeId = uuidv4();
    try {
      await pool.query(
        `INSERT INTO fee_charges
           (id, tenant_id, student_id, session_id, description, category, amount,
            due_date, raised_by, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, NOW(), NOW())`,
        [
          chargeId,
          tenantId,
          sid,
          sessionId,
          description.trim(),
          category,
          amount,
          dueDate ?? null,
          userId,
        ],
      );
      charged++;
    } catch (err) {
      logger.warn(
        { err, action: "fees.bulkCharge", studentId: sid },
        "Failed to insert charge for student",
      );
    }
  }

  res.status(201).json({
    charged,
    skipped: resolvedStudentIds.length - charged,
  });
}

// ═══════════════════════════════════════════════════════════════════
// GET /fees/charges
// ═══════════════════════════════════════════════════════════════════

export async function listCharges(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRoles = req.userRoles ?? [];
  const isAdmin = userRoles.includes("Admin");
  const isTeacher = userRoles.includes("Teacher");
  const isStudent = userRoles.includes("Student") && !isAdmin && !isTeacher;
  const isGuardian = userRoles.includes("Guardian") && !isAdmin && !isTeacher;

  const {
    sessionId,
    studentId: studentIdFilter,
    classId,
    hasBalance,
  } = req.query as {
    sessionId?: string;
    studentId?: string;
    classId?: string;
    hasBalance?: string;
  };

  const conditions: string[] = ["fc.tenant_id = $1"];
  const params: unknown[] = [tenantId];
  let paramIdx = 2;

  if (sessionId) {
    conditions.push(`fc.session_id = $${paramIdx++}`);
    params.push(sessionId);
  }
  if (classId) {
    conditions.push(`s.class_id = $${paramIdx++}`);
    params.push(classId);
  }

  if (isStudent) {
    // Student: only own charges
    const myStudent = await pool.query<{ id: string }>(
      "SELECT id FROM students WHERE user_id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [userId, tenantId],
    );
    const myStudentId = myStudent.rows[0]?.id;
    if (!myStudentId) {
      res.status(200).json({ data: [] });
      return;
    }
    conditions.push(`fc.student_id = $${paramIdx++}`);
    params.push(myStudentId);
  } else if (isGuardian) {
    // Guardian: only children's charges
    const childrenResult = await pool.query<{ id: string }>(
      `SELECT s.id FROM students s
       JOIN student_guardians sg ON sg.student_id = s.id
       JOIN guardians g ON g.id = sg.guardian_id
       WHERE g.user_id = $1 AND g.tenant_id = $2 AND g.deleted_at IS NULL AND s.deleted_at IS NULL`,
      [userId, tenantId],
    );
    const childIds = childrenResult.rows.map((r) => r.id);
    if (childIds.length === 0) {
      res.status(200).json({ data: [] });
      return;
    }
    conditions.push(`fc.student_id = ANY($${paramIdx++}::text[])`);
    params.push(childIds);
  } else if (studentIdFilter) {
    conditions.push(`fc.student_id = $${paramIdx++}`);
    params.push(studentIdFilter);
  }

  const havingClause =
    hasBalance === "true"
      ? "HAVING COALESCE(SUM(fp.amount_paid), 0) < fc.amount"
      : "";

  const result = await pool.query<FeeChargeWithComputed>(
    `${CHARGE_SELECT}
     WHERE ${conditions.join(" AND ")}
     GROUP BY fc.id, s.name
     ${havingClause}
     ORDER BY fc.created_at DESC`,
    params,
  );

  res.status(200).json({ data: result.rows.map(formatFeeCharge) });
}

// ═══════════════════════════════════════════════════════════════════
// DELETE /fees/charges/:id
// ═══════════════════════════════════════════════════════════════════

export async function deleteCharge(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params as { id: string };

  const result = await withTransaction(async (client) => {
    // Lock the charge row to prevent concurrent modifications
    const chargeResult = await client.query<FeeChargeRow>(
      "SELECT * FROM fee_charges WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
      [id, tenantId],
    );
    if ((chargeResult.rowCount ?? 0) === 0) {
      return { notFound: true };
    }

    // Check if any payments have been made
    const paidResult = await client.query<{ total_paid: string }>(
      "SELECT COALESCE(SUM(amount_paid), 0) AS total_paid FROM fee_payments WHERE charge_id = $1 AND tenant_id = $2",
      [id, tenantId],
    );
    const totalPaid = parseFloat(paidResult.rows[0]?.total_paid ?? "0");

    if (totalPaid > 0) {
      return { hasPayments: true };
    }

    // Hard delete — no audit trail needed for unrecorded charge
    await client.query("DELETE FROM fee_charges WHERE id = $1 AND tenant_id = $2", [
      id,
      tenantId,
    ]);

    return { success: true };
  });

  if ("notFound" in result) {
    send404(res, "Fee charge not found");
    return;
  }

  if ("hasPayments" in result) {
    send400(res, "Cannot delete a charge with payments", "CHARGE_HAS_PAYMENTS");
    return;
  }

  res.status(204).send();
}

// ═══════════════════════════════════════════════════════════════════
// POST /fees/charges/:id/payments
// ═══════════════════════════════════════════════════════════════════

export async function recordPayment(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const { id: chargeId } = req.params as { id: string };

  const { amountPaid, paymentMode, paidAt, receiptNumber, notes } =
    req.body as {
      amountPaid?: number;
      paymentMode?: string;
      paidAt?: string;
      receiptNumber?: string;
      notes?: string;
    };

  if (
    amountPaid === undefined ||
    typeof amountPaid !== "number" ||
    amountPaid <= 0
  ) {
    send400(res, "amountPaid must be a positive number");
    return;
  }
  if (
    !paymentMode ||
    !VALID_PAYMENT_MODES.includes(paymentMode as PaymentMode)
  ) {
    send400(
      res,
      `paymentMode must be one of: ${VALID_PAYMENT_MODES.join(", ")}`,
    );
    return;
  }
  if (!paidAt || !DATE_RE.test(paidAt)) {
    send400(res, "paidAt must be a valid date in YYYY-MM-DD format");
    return;
  }

  // Verify charge exists in tenant
  const chargeResult = await pool.query<FeeChargeRow>(
    "SELECT * FROM fee_charges WHERE id = $1 AND tenant_id = $2",
    [chargeId, tenantId],
  );
  if ((chargeResult.rowCount ?? 0) === 0) {
    send404(res, "Fee charge not found");
    return;
  }

  // Compute current balance
  const balanceResult = await pool.query<{ balance: string }>(
    `SELECT fc.amount - COALESCE(SUM(fp.amount_paid), 0) AS balance
     FROM fee_charges fc
     LEFT JOIN fee_payments fp ON fp.charge_id = fc.id
     WHERE fc.id = $1 AND fc.tenant_id = $2
     GROUP BY fc.amount`,
    [chargeId, tenantId],
  );
  const balance = parseFloat(balanceResult.rows[0]?.balance ?? "0");

  if (amountPaid > balance) {
    send400(res, "Payment exceeds outstanding balance", "OVERPAYMENT");
    return;
  }

  const paymentId = uuidv4();
  await pool.query(
    `INSERT INTO fee_payments
       (id, tenant_id, charge_id, student_id, amount_paid, payment_mode,
        paid_at, receipt_number, recorded_by, notes, recorded_at)
     SELECT $1, $2, $3, fc.student_id, $4, $5, $6, $7, $8, $9, NOW()
     FROM fee_charges fc WHERE fc.id = $3 AND fc.tenant_id = $2`,
    [
      paymentId,
      tenantId,
      chargeId,
      amountPaid,
      paymentMode,
      paidAt,
      receiptNumber ?? null,
      userId,
      notes ?? null,
    ],
  );

  const result = await pool.query<FeePaymentRow>(
    "SELECT * FROM fee_payments WHERE id = $1",
    [paymentId],
  );

  res.status(201).json({ payment: formatFeePayment(result.rows[0]!) });
}

// ═══════════════════════════════════════════════════════════════════
// GET /fees/summary
// ═══════════════════════════════════════════════════════════════════

export async function feeSummary(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;

  const { sessionId, classId } = req.query as {
    sessionId?: string;
    classId?: string;
  };

  const conditions: string[] = ["fc.tenant_id = $1"];
  const params: unknown[] = [tenantId];
  let paramIdx = 2;

  if (sessionId) {
    conditions.push(`fc.session_id = $${paramIdx++}`);
    params.push(sessionId);
  }
  if (classId) {
    conditions.push(`s.class_id = $${paramIdx++}`);
    params.push(classId);
  }

  const result = await pool.query<{
    student_id: string;
    student_name: string;
    admission_number: string;
    class_name: string | null;
    total_charged: string;
    total_paid: string;
    outstanding: string;
  }>(
    `SELECT
       s.id AS student_id,
       s.name AS student_name,
       s.admission_number,
       c.name AS class_name,
       COALESCE(SUM(fc.amount), 0) AS total_charged,
       COALESCE(SUM(fp_totals.paid), 0) AS total_paid,
       COALESCE(SUM(fc.amount), 0) - COALESCE(SUM(fp_totals.paid), 0) AS outstanding
     FROM fee_charges fc
     JOIN students s ON s.id = fc.student_id
     LEFT JOIN classes c ON c.id = s.class_id
     LEFT JOIN (
       SELECT charge_id, SUM(amount_paid) AS paid
       FROM fee_payments
       WHERE tenant_id = $1
       GROUP BY charge_id
     ) fp_totals ON fp_totals.charge_id = fc.id
     WHERE ${conditions.join(" AND ")}
     GROUP BY s.id, s.name, s.admission_number, c.name
     ORDER BY s.name ASC`,
    params,
  );

  const data = result.rows.map((row) => ({
    studentId: row.student_id,
    studentName: row.student_name,
    admissionNumber: row.admission_number,
    className: row.class_name,
    totalCharged: parseFloat(row.total_charged),
    totalPaid: parseFloat(row.total_paid),
    outstanding: parseFloat(row.outstanding),
  }));

  res.status(200).json({ data });
}
