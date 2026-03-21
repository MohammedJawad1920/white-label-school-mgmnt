/**
 * Import Controller
 *
 * POST   /api/v1/import/preview        — upload CSV, validate rows, create PREVIEW job
 * POST   /api/v1/import/:jobId/confirm — confirm PREVIEW job, execute DB inserts
 * DELETE /api/v1/import/:jobId         — cancel PREVIEW job
 * GET    /api/v1/import/template/:entity — download CSV template
 * GET    /api/v1/import/history        — list import jobs for tenant
 */

import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { pool, withTransaction } from "../../db/pool";
import { PoolClient } from "pg";
import { config } from "../../config/env";
import { send400, send404, sendError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { ImportJobRow, ApiImportJob, ImportError } from "../../types";

// ─── Local CSV Row Interfaces ─────────────────────────────────────────────────

interface StudentCsvRow {
  name: string;
  admissionNumber: string;
  dob: string; // YYYY-MM-DD
  className?: string;
  batchName?: string;
}

interface UserCsvRow {
  name: string;
  email: string;
  role: string; // 'Teacher' | 'Admin'
}

// ─── Format Helper ────────────────────────────────────────────────────────────

function fmtJob(r: ImportJobRow): ApiImportJob {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    entityType: r.entity_type,
    status: r.status,
    totalRows: r.total_rows,
    validRows: r.valid_rows,
    errorRows: r.error_rows,
    previewData: r.preview_data,
    errors: r.error_data as ImportError[] | null,
    importedRows: r.imported_rows,
    createdBy: r.created_by,
    confirmedAt:
      r.confirmed_at instanceof Date
        ? r.confirmed_at.toISOString()
        : r.confirmed_at
          ? String(r.confirmed_at)
          : null,
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
    expiresAt:
      r.expires_at instanceof Date
        ? r.expires_at.toISOString()
        : String(r.expires_at),
  };
}

// ─── Email Validation ─────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Date Validation ──────────────────────────────────────────────────────────

function isValidDate(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/import/template/:entity
// ═══════════════════════════════════════════════════════════════════════════════

export async function downloadTemplate(
  req: Request,
  res: Response,
): Promise<void> {
  const { entity } = req.params as { entity: string };

  if (entity !== "Student" && entity !== "User") {
    send400(res, "Invalid entity. Must be 'Student' or 'User'");
    return;
  }

  let csvContent: string;
  if (entity === "Student") {
    csvContent =
      "name,admission_number,dob,class_name,batch_name\nJohn Doe,ADM001,2008-01-15,8A,2024";
  } else {
    csvContent = "name,email,role\nJohn Teacher,john@school.com,Teacher";
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${entity.toLowerCase()}_import_template.csv"`,
  );
  res.send(csvContent);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/v1/import/history
// ═══════════════════════════════════════════════════════════════════════════════

export async function importHistory(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { limit: limitStr = "20", offset: offsetStr = "0" } = req.query as {
    limit?: string;
    offset?: string;
  };

  const limit = Math.max(1, Math.min(100, parseInt(limitStr, 10) || 20));
  const offset = Math.max(0, parseInt(offsetStr, 10) || 0);

  const { rows } = await pool.query<ImportJobRow & { total_count: string }>(
    `SELECT *, COUNT(*) OVER() AS total_count
     FROM import_jobs
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [tenantId, limit, offset],
  );

  const total = rows.length > 0 ? parseInt(rows[0]!.total_count, 10) : 0;

  res.status(200).json({
    data: rows.map(fmtJob),
    total,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/v1/import/preview  (multipart/form-data)
// ═══════════════════════════════════════════════════════════════════════════════

export async function previewImport(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const entity = req.body.entity as string;

  // ── Validate entity ───────────────────────────────────────────────────────
  if (entity !== "Student" && entity !== "User") {
    send400(res, "Invalid entity. Must be 'Student' or 'User'");
    return;
  }

  // ── Validate file ─────────────────────────────────────────────────────────
  if (!req.file) {
    send400(res, "CSV file is required");
    return;
  }

  // ── Parse CSV ─────────────────────────────────────────────────────────────
  const csvContent = req.file.buffer.toString("utf-8");
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length < 2) {
    send400(res, "CSV must have a header row and at least one data row");
    return;
  }

  const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const dataRows = lines.slice(1);

  const errors: ImportError[] = [];

  if (entity === "Student") {
    // ── Validate Student headers ──────────────────────────────────────────
    const requiredHeaders = ["name", "admission_number", "dob"];
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      send400(
        res,
        `CSV is missing required columns: ${missingHeaders.join(", ")}`,
        "VALIDATION_ERROR",
        { missingHeaders },
      );
      return;
    }

    const nameIdx = headers.indexOf("name");
    const admNumIdx = headers.indexOf("admission_number");
    const dobIdx = headers.indexOf("dob");
    const classNameIdx = headers.indexOf("class_name");
    const batchNameIdx = headers.indexOf("batch_name");

    // Collect admission numbers to check uniqueness in DB
    const admissionNumbers: string[] = [];
    const parsedStudentRows: StudentCsvRow[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const cols = (dataRows[i] ?? "").split(",").map((c) => c.trim());
      const rowNum = i + 2; // 1-based, accounting for header

      const name = cols[nameIdx] ?? "";
      const admissionNumber = cols[admNumIdx] ?? "";
      const dob = cols[dobIdx] ?? "";
      const className =
        classNameIdx >= 0 ? (cols[classNameIdx] ?? "") : undefined;
      const batchName =
        batchNameIdx >= 0 ? (cols[batchNameIdx] ?? "") : undefined;

      if (!name) {
        errors.push({
          row: rowNum,
          field: "name",
          code: "REQUIRED",
          message: "Name is required",
        });
      }
      if (!admissionNumber) {
        errors.push({
          row: rowNum,
          field: "admission_number",
          code: "REQUIRED",
          message: "Admission number is required",
        });
      }
      if (!dob) {
        errors.push({
          row: rowNum,
          field: "dob",
          code: "REQUIRED",
          message: "Date of birth is required",
        });
      } else if (!isValidDate(dob)) {
        errors.push({
          row: rowNum,
          field: "dob",
          code: "INVALID_FORMAT",
          message: "Date of birth must be in YYYY-MM-DD format",
        });
      }

      if (admissionNumber) {
        admissionNumbers.push(admissionNumber);
      }

      parsedStudentRows.push({
        name,
        admissionNumber,
        dob,
        className: className || undefined,
        batchName: batchName || undefined,
      });
    }

    // ── Check admission_number uniqueness in DB ────────────────────────────
    if (admissionNumbers.length > 0) {
      const { rows: existingStudents } = await pool.query<{
        admission_number: string;
      }>(
        `SELECT admission_number FROM students
         WHERE tenant_id = $1 AND admission_number = ANY($2::text[]) AND deleted_at IS NULL`,
        [tenantId, admissionNumbers],
      );

      const existingAdmNums = new Set(
        existingStudents.map((s) => s.admission_number),
      );

      for (let i = 0; i < parsedStudentRows.length; i++) {
        const row = parsedStudentRows[i];
        if (
          row &&
          row.admissionNumber &&
          existingAdmNums.has(row.admissionNumber)
        ) {
          errors.push({
            row: i + 2,
            field: "admission_number",
            code: "CONFLICT",
            message: `Admission number '${row.admissionNumber}' already exists`,
          });
        }
      }
    }

    // ── Determine valid vs error rows ─────────────────────────────────────
    const errorRowNumbers = new Set(errors.map((e) => e.row));
    const validRows = parsedStudentRows.filter(
      (_, i) => !errorRowNumbers.has(i + 2),
    );
    const totalRows = parsedStudentRows.length;
    const validRowCount = validRows.length;
    const errorRowCount = totalRows - validRowCount;

    // ── Insert import_jobs record ─────────────────────────────────────────
    const jobId = uuidv4();
    const { rows: jobRows } = await pool.query<ImportJobRow>(
      `INSERT INTO import_jobs
         (id, tenant_id, entity_type, status, total_rows, valid_rows, error_rows,
          preview_data, error_data, created_by, expires_at)
       VALUES ($1, $2, 'Student', 'PREVIEW', $3, $4, $5, $6, $7, $8,
               NOW() + INTERVAL '30 minutes')
       RETURNING *`,
      [
        jobId,
        tenantId,
        totalRows,
        validRowCount,
        errorRowCount,
        JSON.stringify(validRows),
        JSON.stringify(errors),
        userId,
      ],
    );

    logger.info(
      { tenantId, action: "import.preview.created", jobId, entity: "Student" },
      "Import preview job created",
    );

    res.status(201).json({ data: fmtJob(jobRows[0]!), errors });
    return;
  }

  // ── User entity ───────────────────────────────────────────────────────────
  const requiredUserHeaders = ["name", "email", "role"];
  const missingUserHeaders = requiredUserHeaders.filter(
    (h) => !headers.includes(h),
  );
  if (missingUserHeaders.length > 0) {
    send400(
      res,
      `CSV is missing required columns: ${missingUserHeaders.join(", ")}`,
      "VALIDATION_ERROR",
      { missingHeaders: missingUserHeaders },
    );
    return;
  }

  const nameIdx = headers.indexOf("name");
  const emailIdx = headers.indexOf("email");
  const roleIdx = headers.indexOf("role");

  const emails: string[] = [];
  const parsedUserRows: UserCsvRow[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const cols = (dataRows[i] ?? "").split(",").map((c) => c.trim());
    const rowNum = i + 2;

    const name = cols[nameIdx] ?? "";
    const email = cols[emailIdx] ?? "";
    const role = cols[roleIdx] ?? "";

    if (!name) {
      errors.push({
        row: rowNum,
        field: "name",
        code: "REQUIRED",
        message: "Name is required",
      });
    }
    if (!email) {
      errors.push({
        row: rowNum,
        field: "email",
        code: "REQUIRED",
        message: "Email is required",
      });
    } else if (!isValidEmail(email)) {
      errors.push({
        row: rowNum,
        field: "email",
        code: "INVALID_FORMAT",
        message: "Email must be a valid email address",
      });
    }
    if (!role) {
      errors.push({
        row: rowNum,
        field: "role",
        code: "REQUIRED",
        message: "Role is required",
      });
    } else if (role !== "Teacher" && role !== "Admin") {
      errors.push({
        row: rowNum,
        field: "role",
        code: "INVALID_VALUE",
        message: "Role must be 'Teacher' or 'Admin'",
      });
    }

    if (email && isValidEmail(email)) {
      emails.push(email);
    }

    parsedUserRows.push({ name, email, role });
  }

  // ── Check email uniqueness in DB ──────────────────────────────────────────
  if (emails.length > 0) {
    const { rows: existingUsers } = await pool.query<{ email: string }>(
      `SELECT email FROM users
       WHERE tenant_id = $1 AND email = ANY($2::text[]) AND deleted_at IS NULL`,
      [tenantId, emails],
    );

    const existingEmails = new Set(existingUsers.map((u) => u.email));

    for (let i = 0; i < parsedUserRows.length; i++) {
      const row = parsedUserRows[i];
      if (row && row.email && existingEmails.has(row.email)) {
        errors.push({
          row: i + 2,
          field: "email",
          code: "CONFLICT",
          message: `Email '${row.email}' already exists`,
        });
      }
    }
  }

  // ── Determine valid vs error rows ─────────────────────────────────────────
  const errorRowNumbers = new Set(errors.map((e) => e.row));
  const validUserRows = parsedUserRows.filter(
    (_, i) => !errorRowNumbers.has(i + 2),
  );
  const totalRows = parsedUserRows.length;
  const validRowCount = validUserRows.length;
  const errorRowCount = totalRows - validRowCount;

  // ── Insert import_jobs record ─────────────────────────────────────────────
  const jobId = uuidv4();
  const { rows: jobRows } = await pool.query<ImportJobRow>(
    `INSERT INTO import_jobs
       (id, tenant_id, entity_type, status, total_rows, valid_rows, error_rows,
        preview_data, error_data, created_by, expires_at)
     VALUES ($1, $2, 'User', 'PREVIEW', $3, $4, $5, $6, $7, $8,
             NOW() + INTERVAL '30 minutes')
     RETURNING *`,
    [
      jobId,
      tenantId,
      totalRows,
      validRowCount,
      errorRowCount,
      JSON.stringify(validUserRows),
      JSON.stringify(errors),
      userId,
    ],
  );

  logger.info(
    { tenantId, action: "import.preview.created", jobId, entity: "User" },
    "Import preview job created",
  );

  res.status(201).json({ data: fmtJob(jobRows[0]!), errors });
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/v1/import/:jobId/confirm
// ═══════════════════════════════════════════════════════════════════════════════

export async function confirmImport(
  req: Request,
  res: Response,
): Promise<void> {
  const tenantId = req.tenantId!;
  const { jobId } = req.params as { jobId: string };

  if (!jobId) {
    send400(res, "jobId is required");
    return;
  }

  // ── Fetch job with PREVIEW status and lock it ────────────────────────────────
  const { rows: previewRows } = await pool.query<ImportJobRow>(
    `SELECT * FROM import_jobs WHERE id = $1 AND tenant_id = $2 AND status = 'PREVIEW' FOR UPDATE`,
    [jobId, tenantId],
  );

  if (previewRows.length === 0) {
    // Check if job exists at all (for richer error messages)
    const { rows: anyRows } = await pool.query<ImportJobRow>(
      `SELECT * FROM import_jobs WHERE id = $1 AND tenant_id = $2`,
      [jobId, tenantId],
    );

    if (anyRows.length === 0) {
      send404(res, "Import job not found");
      return;
    }

    const existing = anyRows[0]!;
    const now = new Date();
    const expiresAt =
      existing.expires_at instanceof Date
        ? existing.expires_at
        : new Date(existing.expires_at);

    if (expiresAt < now) {
      sendError(res, {
        code: "IMPORT_EXPIRED",
        message: "Import preview has expired",
        status: 410,
      });
      return;
    }

    send400(res, `Import cannot be confirmed`, "VALIDATION_ERROR", {
      currentStatus: existing.status,
    });
    return;
  }

  const job = previewRows[0]!;

  // ── Check expiry ──────────────────────────────────────────────────────────
  const now = new Date();
  const expiresAt =
    job.expires_at instanceof Date ? job.expires_at : new Date(job.expires_at);

  if (expiresAt < now) {
    sendError(res, {
      code: "IMPORT_EXPIRED",
      message: "Import preview has expired",
      status: 410,
    });
    return;
  }

  // ── Reject if job has validation errors ───────────────────────────────────
  if (job.error_rows > 0) {
    send400(res, "Import has validation errors", "IMPORT_HAS_ERRORS", {
      errorRows: job.error_rows,
    });
    return;
  }

  // ── Execute import in transaction ─────────────────────────────────────────
  let temporaryPassword: string | undefined;

  const updatedJob = await withTransaction(async (client: PoolClient) => {
    let importedCount = 0;

    if (job.entity_type === "Student") {
      const previewData = (job.preview_data ?? []) as StudentCsvRow[];

      for (const row of previewData) {
        const result = await client.query<{ id: string }>(
          `INSERT INTO students
             (id, tenant_id, name, admission_number, dob, batch_id, status)
           VALUES ($1, $2, $3, $4, $5::date,
             (SELECT id FROM batches WHERE tenant_id = $2 AND name = $6 AND deleted_at IS NULL LIMIT 1),
             'Active')
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [
            uuidv4(),
            tenantId,
            row.name,
            row.admissionNumber,
            row.dob,
            row.batchName ?? null,
          ],
        );
        if (result.rows.length > 0) {
          importedCount++;
        }
      }
    } else {
      // entityType === 'User'
      const previewData = (job.preview_data ?? []) as UserCsvRow[];
      const tempPassword = crypto.randomBytes(8).toString("hex").slice(0, 12);
      temporaryPassword = tempPassword;
      const passwordHash = await bcrypt.hash(
        tempPassword,
        config.BCRYPT_ROUNDS,
      );

      for (const row of previewData) {
        const result = await client.query<{ id: string }>(
          `INSERT INTO users
             (id, tenant_id, name, email, password_hash, roles, must_change_password, token_version)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, true, 1)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [
            uuidv4(),
            tenantId,
            row.name,
            row.email,
            passwordHash,
            JSON.stringify([row.role]),
          ],
        );
        if (result.rows.length > 0) {
          importedCount++;
        }
      }
    }

    // Update job to COMPLETED
    const { rows: updatedRows } = await client.query<ImportJobRow>(
      `UPDATE import_jobs
       SET status = 'COMPLETED', confirmed_at = NOW(), imported_rows = $1
       WHERE id = $2
       RETURNING *`,
      [importedCount, jobId],
    );

    return updatedRows[0]!;
  }).catch(async (err) => {
    // On transaction error, set job status to FAILED
    try {
      await pool.query(
        `UPDATE import_jobs SET status = 'FAILED', confirmed_at = NOW() WHERE id = $1`,
        [jobId],
      );
    } catch (updateErr) {
      logger.error(
        { err: updateErr, jobId },
        "Failed to mark import job as FAILED",
      );
    }
    throw err;
  });

  logger.info(
    {
      tenantId,
      action: "import.confirmed",
      jobId,
      importedRows: updatedJob.imported_rows,
    },
    "Import job confirmed",
  );

  const responseBody: { data: ApiImportJob; temporaryPassword?: string } = {
    data: fmtJob(updatedJob),
  };

  if (temporaryPassword !== undefined) {
    responseBody.temporaryPassword = temporaryPassword;
  }

  res.status(200).json(responseBody);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/v1/import/:jobId
// ═══════════════════════════════════════════════════════════════════════════════

export async function cancelImport(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantId!;
  const { jobId } = req.params as { jobId: string };

  if (!jobId) {
    send400(res, "jobId is required");
    return;
  }

  const { rows } = await pool.query<ImportJobRow>(
    `SELECT * FROM import_jobs WHERE id = $1 AND tenant_id = $2 AND status = 'PREVIEW'`,
    [jobId, tenantId],
  );

  if (rows.length === 0) {
    send404(res, "Import job not found or cannot be cancelled");
    return;
  }

  await pool.query(
    `UPDATE import_jobs SET status = 'CANCELLED' WHERE id = $1`,
    [jobId],
  );

  logger.info(
    { tenantId, action: "import.cancelled", jobId },
    "Import job cancelled",
  );

  res.status(204).send();
}
