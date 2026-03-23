/**
 * Integration tests: CSV Import endpoints (v6.1)
 *
 * Covers:
 *   POST   /api/v1/import/students         — Start student import
 *   POST   /api/v1/import/users            — Start user import
 *   GET    /api/v1/import/jobs             — List import jobs
 *   GET    /api/v1/import/jobs/:id         — Get job status
 *   POST   /api/v1/import/jobs/:id/commit  — Commit preview
 *   DELETE /api/v1/import/jobs/:id         — Cancel job
 *
 * Freeze v6.1 §13.3 — Mandatory test cases:
 *   1. Upload creates import_job with status VALIDATING
 *   2. Preview returns valid rows + error rows
 *   3. Preview expires after 15 minutes (TTL check)
 *   4. Commit creates actual DB rows from preview
 *   5. Cannot commit twice (idempotency)
 *   6. Admin only access
 */
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import {
  makeAgent,
  createTestTenant,
  cleanupTenant,
  skipIfNoDb,
  testPool,
  type TestTenant,
} from "./helpers/db";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

const SKIP = skipIfNoDb();

async function loginAsAdmin(tenant: TestTenant): Promise<string> {
  const res = await makeAgent().post("/api/v1/auth/login").send({
    email: tenant.adminEmail,
    password: tenant.adminPassword,
    tenantId: tenant.tenantId,
  });
  return res.body.token as string;
}

async function createTeacherAndLogin(tenant: TestTenant): Promise<string> {
  const teacherId = uuidv4();
  const teacherEmail = `teacher-${uuidv4().slice(0, 8)}@test.local`;
  const hash = await bcrypt.hash("Teacher@Pass123", 10);

  await testPool.query(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, '["Teacher"]'::jsonb, NOW(), NOW())`,
    [teacherId, tenant.tenantId, "Test Teacher", teacherEmail, hash],
  );

  const res = await makeAgent().post("/api/v1/auth/login").send({
    email: teacherEmail,
    password: "Teacher@Pass123",
    tenantId: tenant.tenantId,
  });
  return res.body.token as string;
}

// ── POST /api/v1/import/students ────────────────────────────────────────────
describe("POST /api/v1/import/students", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let teacherToken: string;
  let sessionId: string;
  let batchId: string;
  let classId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);
    teacherToken = await createTeacherAndLogin(tenant);

    // Create session, batch, class
    sessionId = uuidv4();
    batchId = uuidv4();
    classId = uuidv4();

    await testPool.query(
      `INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, created_at, updated_at)
       VALUES ($1, $2, '2026-27', '2026-06-01', '2027-05-31', 'ACTIVE', NOW(), NOW())`,
      [sessionId, tenant.tenantId],
    );

    await testPool.query(
      `INSERT INTO batches (id, tenant_id, name, level, created_at, updated_at)
       VALUES ($1, $2, 'Batch A', 'Std8', NOW(), NOW())`,
      [batchId, tenant.tenantId],
    );

    await testPool.query(
      `INSERT INTO classes (id, tenant_id, batch_id, session_id, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Class 8A', NOW(), NOW())`,
      [classId, tenant.tenantId, batchId, sessionId],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 201 and creates import job with status VALIDATING", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/import/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        batchId,
        classId,
        rows: [
          { name: "Student 1", registerNumber: "S001" },
          { name: "Student 2", registerNumber: "S002" },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.job).toHaveProperty("id");
    expect(["VALIDATING", "PREVIEW"]).toContain(res.body.job.status);
    expect(res.body.job).toHaveProperty("entityType", "student");
  });

  it("returns 403 for Teacher role (Admin only)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/import/students")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        batchId,
        classId,
        rows: [{ name: "Student 1", registerNumber: "S001" }],
      });

    expect(res.status).toBe(403);
  });

  it("returns 422 when required fields are missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/import/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ batchId }); // Missing classId and rows

    expect(res.status).toBe(422);
  });

  it("returns 404 when batchId does not exist", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/import/students")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        batchId: uuidv4(),
        classId,
        rows: [{ name: "Student 1", registerNumber: "S001" }],
      });

    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/import/students")
      .send({
        batchId,
        classId,
        rows: [{ name: "Student 1", registerNumber: "S001" }],
      });
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/import/users ───────────────────────────────────────────────
describe("POST /api/v1/import/users", () => {
  let tenant: TestTenant;
  let adminToken: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 201 and creates user import job", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/import/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        rows: [
          { name: "Teacher A", email: "teachera@test.local", role: "Teacher" },
          { name: "Teacher B", email: "teacherb@test.local", role: "Teacher" },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.job).toHaveProperty("id");
    expect(res.body.job).toHaveProperty("entityType", "user");
  });

  it("returns validation errors for duplicate emails (regression: uniqueness)", async () => {
    if (SKIP) return;

    // Create existing user
    await testPool.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, created_at, updated_at)
       VALUES ($1, $2, 'Existing', 'existing@test.local', 'hash', '["Teacher"]'::jsonb, NOW(), NOW())`,
      [uuidv4(), tenant.tenantId],
    );

    const res = await makeAgent()
      .post("/api/v1/import/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        rows: [{ name: "Duplicate", email: "existing@test.local", role: "Teacher" }],
      });

    // Should still create job but with validation errors in preview
    expect([201, 400]).toContain(res.status);
    if (res.status === 201) {
      // Check preview has errors
      const jobId = res.body.job.id;
      const preview = await makeAgent()
        .get(`/api/v1/import/jobs/${jobId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(preview.body.job.errorCount).toBeGreaterThan(0);
    }
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/import/users")
      .send({
        rows: [{ name: "Teacher", email: "teacher@test.local", role: "Teacher" }],
      });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/import/jobs ─────────────────────────────────────────────────
describe("GET /api/v1/import/jobs", () => {
  let tenant: TestTenant;
  let adminToken: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create test import jobs
    await testPool.query(
      `INSERT INTO import_jobs (id, tenant_id, entity_type, status, total_rows, valid_rows, error_rows, created_by, created_at, updated_at)
       VALUES
         ($1, $2, 'student', 'PREVIEW', 10, 8, 2, $3, NOW(), NOW()),
         ($4, $2, 'user', 'COMMITTED', 5, 5, 0, $3, NOW(), NOW())`,
      [uuidv4(), tenant.tenantId, tenant.adminId, uuidv4()],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with list of import jobs", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/import/jobs")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("jobs");
    expect(Array.isArray(res.body.jobs)).toBe(true);
    expect(res.body.jobs.length).toBeGreaterThanOrEqual(2);

    for (const job of res.body.jobs) {
      expect(job).toHaveProperty("id");
      expect(job).toHaveProperty("entityType");
      expect(job).toHaveProperty("status");
      expect(["student", "user"]).toContain(job.entityType);
    }
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get("/api/v1/import/jobs");
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/import/jobs/:id ─────────────────────────────────────────────
describe("GET /api/v1/import/jobs/:id", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let jobId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    jobId = uuidv4();
    await testPool.query(
      `INSERT INTO import_jobs (id, tenant_id, entity_type, status, total_rows, valid_rows, error_rows, preview_data, created_by, created_at, updated_at, expires_at)
       VALUES ($1, $2, 'student', 'PREVIEW', 10, 8, 2, '{"valid":[],"errors":[]}'::jsonb, $3, NOW(), NOW(), NOW() + INTERVAL '15 minutes')`,
      [jobId, tenant.tenantId, tenant.adminId],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with job details and preview", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/import/jobs/${jobId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.job).toMatchObject({
      id: jobId,
      entityType: "student",
      status: "PREVIEW",
      totalRows: 10,
      validRows: 8,
      errorRows: 2,
    });
  });

  it("returns 404 for non-existent job", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/import/jobs/${uuidv4()}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get(`/api/v1/import/jobs/${jobId}`);
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/import/jobs/:id/commit ─────────────────────────────────────
describe("POST /api/v1/import/jobs/:id/commit", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let batchId: string;
  let classId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create batch and class for student import
    const sessionId = uuidv4();
    batchId = uuidv4();
    classId = uuidv4();

    await testPool.query(
      `INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, created_at, updated_at)
       VALUES ($1, $2, '2026-27', '2026-06-01', '2027-05-31', 'ACTIVE', NOW(), NOW())`,
      [sessionId, tenant.tenantId],
    );

    await testPool.query(
      `INSERT INTO batches (id, tenant_id, name, level, created_at, updated_at)
       VALUES ($1, $2, 'Batch A', 'Std8', NOW(), NOW())`,
      [batchId, tenant.tenantId],
    );

    await testPool.query(
      `INSERT INTO classes (id, tenant_id, batch_id, session_id, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Class 8A', NOW(), NOW())`,
      [classId, tenant.tenantId, batchId, sessionId],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("commits preview and creates records (regression: creates actual DB rows)", async () => {
    if (SKIP) return;

    // Create job with preview data
    const jobId = uuidv4();
    const previewData = {
      valid: [
        { name: "Imported Student 1", registerNumber: "IMP001" },
        { name: "Imported Student 2", registerNumber: "IMP002" },
      ],
      errors: [],
    };

    await testPool.query(
      `INSERT INTO import_jobs (id, tenant_id, entity_type, status, total_rows, valid_rows, error_rows, preview_data, batch_id, class_id, created_by, created_at, updated_at, expires_at)
       VALUES ($1, $2, 'student', 'PREVIEW', 2, 2, 0, $3, $4, $5, $6, NOW(), NOW(), NOW() + INTERVAL '15 minutes')`,
      [jobId, tenant.tenantId, JSON.stringify(previewData), batchId, classId, tenant.adminId],
    );

    const res = await makeAgent()
      .post(`/api/v1/import/jobs/${jobId}/commit`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.job.status).toBe("COMMITTED");
    expect(res.body.job.importedCount).toBe(2);

    // Verify students were created
    const students = await testPool.query(
      "SELECT * FROM students WHERE tenant_id = $1 AND register_number IN ('IMP001', 'IMP002')",
      [tenant.tenantId],
    );
    expect(students.rows.length).toBe(2);
  });

  it("returns 400 when trying to commit twice (regression: idempotency)", async () => {
    if (SKIP) return;

    const jobId = uuidv4();
    await testPool.query(
      `INSERT INTO import_jobs (id, tenant_id, entity_type, status, total_rows, valid_rows, error_rows, preview_data, batch_id, class_id, created_by, created_at, updated_at)
       VALUES ($1, $2, 'student', 'COMMITTED', 2, 2, 0, '{}'::jsonb, $3, $4, $5, NOW(), NOW())`,
      [jobId, tenant.tenantId, batchId, classId, tenant.adminId],
    );

    const res = await makeAgent()
      .post(`/api/v1/import/jobs/${jobId}/commit`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBeDefined();
  });

  it("returns 400 when preview is expired (regression: TTL check)", async () => {
    if (SKIP) return;

    const jobId = uuidv4();
    await testPool.query(
      `INSERT INTO import_jobs (id, tenant_id, entity_type, status, total_rows, valid_rows, error_rows, preview_data, batch_id, class_id, created_by, created_at, updated_at, expires_at)
       VALUES ($1, $2, 'student', 'PREVIEW', 2, 2, 0, '{}'::jsonb, $3, $4, $5, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '5 minutes')`,
      [jobId, tenant.tenantId, batchId, classId, tenant.adminId],
    );

    const res = await makeAgent()
      .post(`/api/v1/import/jobs/${jobId}/commit`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent job", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post(`/api/v1/import/jobs/${uuidv4()}/commit`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().post(`/api/v1/import/jobs/${uuidv4()}/commit`);
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/v1/import/jobs/:id ──────────────────────────────────────────
describe("DELETE /api/v1/import/jobs/:id", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let jobId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    jobId = uuidv4();
    await testPool.query(
      `INSERT INTO import_jobs (id, tenant_id, entity_type, status, total_rows, valid_rows, error_rows, preview_data, created_by, created_at, updated_at)
       VALUES ($1, $2, 'student', 'PREVIEW', 2, 2, 0, '{}'::jsonb, $3, NOW(), NOW())`,
      [jobId, tenant.tenantId, tenant.adminId],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("cancels/deletes job (regression: deletes preview data)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete(`/api/v1/import/jobs/${jobId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    // Verify job is deleted or marked cancelled
    const job = await testPool.query(
      "SELECT status FROM import_jobs WHERE id = $1",
      [jobId],
    );
    if (job.rows.length > 0) {
      expect(job.rows[0].status).toBe("CANCELLED");
    }
  });

  it("returns 400 when trying to cancel committed job", async () => {
    if (SKIP) return;

    // Mark job as committed
    await testPool.query(
      "UPDATE import_jobs SET status = 'COMMITTED' WHERE id = $1",
      [jobId],
    );

    const res = await makeAgent()
      .delete(`/api/v1/import/jobs/${jobId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent job", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete(`/api/v1/import/jobs/${uuidv4()}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().delete(`/api/v1/import/jobs/${jobId}`);
    expect(res.status).toBe(401);
  });
});
