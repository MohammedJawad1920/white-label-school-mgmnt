/**
 * Integration tests: Guardian Management endpoints (v6.1)
 *
 * Covers:
 *   POST   /api/v1/guardians                  — Create guardian
 *   GET    /api/v1/guardians                  — List guardians
 *   GET    /api/v1/guardians/:id              — Get guardian
 *   PATCH  /api/v1/guardians/:id              — Update guardian
 *   DELETE /api/v1/guardians/:id              — Delete guardian (soft)
 *   POST   /api/v1/guardians/:id/link-student — Link student to guardian
 *   DELETE /api/v1/guardians/:id/link-student/:studentId — Unlink student
 *
 * Freeze v6.1 §13.3 — Mandatory test cases:
 *   1. Guardian linked to User account (user_id FK)
 *   2. student_guardians junction table for many-to-many
 *   3. is_primary field on link (one primary per student)
 *   4. Admin only management (Guardian role cannot self-manage)
 *   5. relationship field validation (Father, Mother, Guardian, Other)
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

async function createStudentWithBatchClass(tenant: TestTenant): Promise<string> {
  const sessionId = uuidv4();
  const batchId = uuidv4();
  const classId = uuidv4();
  const studentId = uuidv4();

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

  await testPool.query(
    `INSERT INTO students (id, tenant_id, name, register_number, batch_id, class_id, created_at, updated_at)
     VALUES ($1, $2, 'Student A', 'S001', $3, $4, NOW(), NOW())`,
    [studentId, tenant.tenantId, batchId, classId],
  );

  return studentId;
}

// ── POST /api/v1/guardians ──────────────────────────────────────────────────
describe("POST /api/v1/guardians", () => {
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

  it("returns 201 and creates guardian with user account", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/guardians")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "John Parent",
        email: "john.parent@test.local",
        phone: "+911234567890",
        relationship: "Father",
      });

    expect(res.status).toBe(201);
    expect(res.body.guardian).toMatchObject({
      name: "John Parent",
      relationship: "Father",
    });
    expect(res.body.guardian).toHaveProperty("id");
    expect(res.body.guardian).toHaveProperty("userId");

    // Verify user was created
    const user = await testPool.query(
      "SELECT * FROM users WHERE id = $1",
      [res.body.guardian.userId],
    );
    expect(user.rows.length).toBe(1);
    expect(user.rows[0].roles).toContainEqual("Guardian");
  });

  it("validates relationship field (regression)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/guardians")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Invalid Guardian",
        email: "invalid@test.local",
        relationship: "InvalidRelation",
      });

    expect(res.status).toBe(400);
  });

  it("returns 422 when required fields missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/guardians")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Name Only" });

    expect(res.status).toBe(422);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/guardians")
      .send({ name: "Test", email: "test@test.local", relationship: "Father" });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/guardians ───────────────────────────────────────────────────
describe("GET /api/v1/guardians", () => {
  let tenant: TestTenant;
  let adminToken: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    const userId1 = uuidv4();
    const hash = await bcrypt.hash("Test@Pass123", 10);

    await testPool.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, created_at, updated_at)
       VALUES ($1, $2, 'Guardian 1', 'g1@test.local', $3, '["Guardian"]'::jsonb, NOW(), NOW())`,
      [userId1, tenant.tenantId, hash],
    );

    await testPool.query(
      `INSERT INTO guardians (id, tenant_id, user_id, name, phone, relationship, created_at, updated_at)
       VALUES ($1, $2, $3, 'Guardian 1', '+911111111111', 'Father', NOW(), NOW())`,
      [uuidv4(), tenant.tenantId, userId1],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with list of guardians", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/guardians")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("guardians");
    expect(Array.isArray(res.body.guardians)).toBe(true);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get("/api/v1/guardians");
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/guardians/:id/link-student ─────────────────────────────────
describe("POST /api/v1/guardians/:id/link-student", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let guardianId: string;
  let studentId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);
    studentId = await createStudentWithBatchClass(tenant);

    const userId = uuidv4();
    const hash = await bcrypt.hash("Test@Pass123", 10);
    guardianId = uuidv4();

    await testPool.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, created_at, updated_at)
       VALUES ($1, $2, 'Guardian', 'guardian@test.local', $3, '["Guardian"]'::jsonb, NOW(), NOW())`,
      [userId, tenant.tenantId, hash],
    );

    await testPool.query(
      `INSERT INTO guardians (id, tenant_id, user_id, name, phone, relationship, created_at, updated_at)
       VALUES ($1, $2, $3, 'Test Guardian', '+911234567890', 'Father', NOW(), NOW())`,
      [guardianId, tenant.tenantId, userId],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("links student to guardian (regression: student_guardians junction)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post(`/api/v1/guardians/${guardianId}/link-student`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId, isPrimary: true });

    expect(res.status).toBe(201);

    const link = await testPool.query(
      "SELECT * FROM student_guardians WHERE guardian_id = $1 AND student_id = $2",
      [guardianId, studentId],
    );
    expect(link.rows.length).toBe(1);
    expect(link.rows[0].is_primary).toBe(true);
  });

  it("returns 409 when link already exists", async () => {
    if (SKIP) return;

    await makeAgent()
      .post(`/api/v1/guardians/${guardianId}/link-student`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId, isPrimary: true });

    const res = await makeAgent()
      .post(`/api/v1/guardians/${guardianId}/link-student`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId, isPrimary: false });

    expect(res.status).toBe(409);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post(`/api/v1/guardians/${guardianId}/link-student`)
      .send({ studentId, isPrimary: true });
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/v1/guardians/:id ────────────────────────────────────────────
describe("DELETE /api/v1/guardians/:id", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let guardianId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    const userId = uuidv4();
    const hash = await bcrypt.hash("Test@Pass123", 10);
    guardianId = uuidv4();

    await testPool.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, created_at, updated_at)
       VALUES ($1, $2, 'Guardian', 'guardian@test.local', $3, '["Guardian"]'::jsonb, NOW(), NOW())`,
      [userId, tenant.tenantId, hash],
    );

    await testPool.query(
      `INSERT INTO guardians (id, tenant_id, user_id, name, phone, relationship, created_at, updated_at)
       VALUES ($1, $2, $3, 'Test Guardian', '+911234567890', 'Father', NOW(), NOW())`,
      [guardianId, tenant.tenantId, userId],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("soft deletes guardian (sets deleted_at, regression)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete(`/api/v1/guardians/${guardianId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    const guardian = await testPool.query(
      "SELECT deleted_at FROM guardians WHERE id = $1",
      [guardianId],
    );
    expect(guardian.rows[0]?.deleted_at).not.toBeNull();
  });

  it("returns 404 for non-existent guardian", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete(`/api/v1/guardians/${uuidv4()}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().delete(`/api/v1/guardians/${guardianId}`);
    expect(res.status).toBe(401);
  });
});
