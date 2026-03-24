/**
 * Guardians Controller
 *
 * POST   /api/v1/guardians          — create guardian, link to student, optionally create user account
 * PUT    /api/v1/guardians/:id      — update guardian fields (partial)
 * DELETE /api/v1/guardians/:id      — soft-delete guardian + remove student links
 *
 * listStudentGuardians              — exported for students module
 *   GET /api/v1/students/:id/guardians
 */

import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { pool, withTransaction } from "../../db/pool";
import { PoolClient } from "pg";
import { send400, send404, send409 } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { config } from "../../config/env";
import { GuardianRow, ApiGuardian } from "../../types";

// ─── Formatter ───────────────────────────────────────────────────────────────

function fmtGuardian(r: GuardianRow): ApiGuardian {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    relationship: r.relationship,
    isPrimary: r.is_primary,
    canSubmitLeave: r.can_submit_leave,
    userId: r.user_id,
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
  };
}

// ═══════════════════════════════════════════════════════════════════
// POST /api/v1/guardians
// ═══════════════════════════════════════════════════════════════════

export async function createGuardian(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;

  const {
    studentId,
    name,
    phone,
    email,
    relationship,
    isPrimary,
    canSubmitLeave,
    createUserAccount,
  } = req.body as {
    studentId?: string;
    name?: string;
    phone?: string;
    email?: string;
    relationship?: string;
    isPrimary?: boolean;
    canSubmitLeave?: boolean;
    createUserAccount?: boolean;
  };

  // ── Validation ────────────────────────────────────────────────────
  if (!studentId || typeof studentId !== "string" || studentId.trim() === "") {
    send400(res, "studentId is required", "VALIDATION_ERROR", {
      field: "studentId",
      issue: "required",
    });
    return;
  }
  if (!name || typeof name !== "string" || name.trim() === "") {
    send400(res, "name is required", "VALIDATION_ERROR", {
      field: "name",
      issue: "required",
    });
    return;
  }
  if (!phone || typeof phone !== "string" || phone.trim().length < 6) {
    send400(res, "phone must be at least 6 characters", "VALIDATION_ERROR", {
      field: "phone",
      issue: "minLength",
    });
    return;
  }
  if (email !== undefined && email !== null && !String(email).includes("@")) {
    send400(res, "email must be a valid email address", "VALIDATION_ERROR", {
      field: "email",
      issue: "format",
    });
    return;
  }

  // ── Verify student exists ─────────────────────────────────────────
  const studentCheck = await pool.query<{ id: string }>(
    `SELECT id FROM students WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [studentId.trim(), tenantId],
  );
  if (studentCheck.rows.length === 0) {
    send404(res, "Student not found");
    return;
  }

  // ── If creating user account, validate email provided ─────────────
  if (createUserAccount === true) {
    if (!email || !String(email).includes("@")) {
      send400(
        res,
        "email is required when createUserAccount is true",
        "VALIDATION_ERROR",
        { field: "email", issue: "required" },
      );
      return;
    }
  }

  // ── Transactional write ───────────────────────────────────────────
  let temporaryPassword: string | undefined;

  const guardian = await withTransaction(async (client: PoolClient) => {
    const guardianId = uuidv4();

    // 1. Insert guardian
    const guardianResult = await client.query<GuardianRow>(
      `INSERT INTO guardians
         (id, tenant_id, name, phone, email, relationship, is_primary, can_submit_leave)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        guardianId,
        tenantId,
        name.trim(),
        phone.trim(),
        email ?? null,
        relationship ?? null,
        isPrimary ?? false,
        canSubmitLeave ?? true,
      ],
    );
    const guardianRow = guardianResult.rows[0]!;

    // 2. Link guardian to student
    await client.query(
      `INSERT INTO student_guardians (student_id, guardian_id, tenant_id)
       VALUES ($1, $2, $3)`,
      [studentId.trim(), guardianId, tenantId],
    );

    // 3. Optionally create user account
    if (createUserAccount === true && email) {
      // Check no existing user with this email in tenant
      const existingUser = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE email = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        [email, tenantId],
      );
      if (existingUser.rows.length > 0) {
        throw Object.assign(new Error("EMAIL_CONFLICT"), {
          statusConflict: true,
        });
      }

      // Generate temporary password
      const tmpPassword = crypto.randomBytes(8).toString("hex").slice(0, 12);
      temporaryPassword = tmpPassword;
      const passwordHash = await bcrypt.hash(tmpPassword, config.BCRYPT_ROUNDS);

      const userId = uuidv4();
      await client.query(
        `INSERT INTO users
           (id, tenant_id, name, email, password_hash, roles, token_version, must_change_password)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          tenantId,
          name.trim(),
          email,
          passwordHash,
          JSON.stringify(["Guardian"]),
          0,
          true,
        ],
      );

      // Link user to guardian
      await client.query(`UPDATE guardians SET user_id = $1 WHERE id = $2`, [
        userId,
        guardianId,
      ]);

      guardianRow.user_id = userId;
    }

    return guardianRow;
  }).catch((err: unknown) => {
    if (
      err instanceof Error &&
      (err as Error & { statusConflict?: boolean }).statusConflict
    ) {
      send409(res, "A user with this email already exists");
      return null;
    }
    throw err;
  });

  if (guardian === null) {
    return;
  }

  logger.info(
    { tenantId, action: "guardian.created", guardianId: guardian.id },
    "guardian.created",
  );

  const responseBody: { guardian: ApiGuardian; temporaryPassword?: string } = {
    guardian: fmtGuardian(guardian),
  };
  if (temporaryPassword !== undefined) {
    responseBody.temporaryPassword = temporaryPassword;
  }

  res.status(201).json(responseBody);
}

// ═══════════════════════════════════════════════════════════════════
// PUT /api/v1/guardians/:id
// ═══════════════════════════════════════════════════════════════════

export async function updateGuardian(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  const { name, phone, email, relationship, isPrimary, canSubmitLeave } =
    req.body as {
      name?: string;
      phone?: string;
      email?: string;
      relationship?: string;
      isPrimary?: boolean;
      canSubmitLeave?: boolean;
    };

  // ── Validate email format if provided ────────────────────────────
  if (email !== undefined && email !== null && !String(email).includes("@")) {
    send400(res, "email must be a valid email address", "VALIDATION_ERROR", {
      field: "email",
      issue: "format",
    });
    return;
  }

  // ── Check guardian exists ─────────────────────────────────────────
  const existing = await pool.query<GuardianRow>(
    `SELECT * FROM guardians WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  if (existing.rows.length === 0) {
    send404(res, "Guardian not found");
    return;
  }

  // ── Build dynamic UPDATE ──────────────────────────────────────────
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (name !== undefined) {
    setClauses.push(`name = $${paramIdx++}`);
    values.push(name.trim());
  }
  if (phone !== undefined) {
    setClauses.push(`phone = $${paramIdx++}`);
    values.push(phone.trim());
  }
  if (email !== undefined) {
    setClauses.push(`email = $${paramIdx++}`);
    values.push(email);
  }
  if (relationship !== undefined) {
    setClauses.push(`relationship = $${paramIdx++}`);
    values.push(relationship);
  }
  if (isPrimary !== undefined) {
    setClauses.push(`is_primary = $${paramIdx++}`);
    values.push(isPrimary);
  }
  if (canSubmitLeave !== undefined) {
    setClauses.push(`can_submit_leave = $${paramIdx++}`);
    values.push(canSubmitLeave);
  }

  if (setClauses.length === 0) {
    // Nothing to update — return current state
    res.status(200).json(fmtGuardian(existing.rows[0]!));
    return;
  }

  values.push(id);
  values.push(tenantId);

  const result = await pool.query<GuardianRow>(
    `UPDATE guardians
     SET ${setClauses.join(", ")}
     WHERE id = $${paramIdx++} AND tenant_id = $${paramIdx}
     RETURNING *`,
    values,
  );

  logger.info(
    { tenantId, action: "guardian.updated", guardianId: id },
    "guardian.updated",
  );

  res.status(200).json(fmtGuardian(result.rows[0]!));
}

// ═══════════════════════════════════════════════════════════════════
// DELETE /api/v1/guardians/:id
// ═══════════════════════════════════════════════════════════════════

export async function deleteGuardian(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { id } = req.params;

  // ── Check guardian exists ─────────────────────────────────────────
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM guardians WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  if (existing.rows.length === 0) {
    send404(res, "Guardian not found");
    return;
  }

  // ── Soft-delete guardian + remove student links ───────────────────
  await withTransaction(async (client: PoolClient) => {
    await client.query(
      `UPDATE guardians SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    await client.query(
      `DELETE FROM student_guardians WHERE guardian_id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
  });

  logger.info(
    { tenantId, action: "guardian.deleted", guardianId: id },
    "guardian.deleted",
  );

  res.status(204).send();
}

// ═══════════════════════════════════════════════════════════════════
// GET /api/v1/students/:id/guardians  (exported for students module)
// ═══════════════════════════════════════════════════════════════════

export async function listStudentGuardians(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const studentId = req.params["id"]!;

  const result = await pool.query<GuardianRow>(
    `SELECT g.*
     FROM guardians g
     JOIN student_guardians sg ON sg.guardian_id = g.id
     WHERE sg.student_id = $1
       AND sg.tenant_id = $2
       AND g.deleted_at IS NULL
     ORDER BY g.is_primary DESC, g.created_at ASC`,
    [studentId, tenantId],
  );

  res.status(200).json({ data: result.rows.map(fmtGuardian) });
}
