/**
 * Integration tests: Security Regression Tests (v6.1)
 *
 * Freeze v6.1 §13.3 — Security Regression Test Suite
 *
 * These tests verify critical security boundaries are not accidentally
 * broken during development. Each test targets a specific security
 * invariant that MUST hold.
 *
 * Categories:
 *   1. Multi-tenant isolation (tenant_id filtering)
 *   2. Role-based access control (RBAC)
 *   3. Resource ownership verification
 *   4. Token validation
 *   5. Cross-tenant data access prevention
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

// ── 1. Multi-Tenant Isolation ───────────────────────────────────────────────
describe("Security: Multi-Tenant Isolation", () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let tokenA: string;
  let tokenB: string;
  let studentIdA: string;

  beforeAll(async () => {
    if (SKIP) return;

    tenantA = await createTestTenant();
    tenantB = await createTestTenant();

    tokenA = await loginAsAdmin(tenantA);
    tokenB = await loginAsAdmin(tenantB);

    // Create student in tenant A
    const sessionId = uuidv4();
    const batchId = uuidv4();
    const classId = uuidv4();
    studentIdA = uuidv4();

    await testPool.query(
      `INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, created_at, updated_at)
       VALUES ($1, $2, '2026-27', '2026-06-01', '2027-05-31', 'ACTIVE', NOW(), NOW())`,
      [sessionId, tenantA.tenantId],
    );

    await testPool.query(
      `INSERT INTO batches (id, tenant_id, name, level, created_at, updated_at)
       VALUES ($1, $2, 'Batch A', 'Std8', NOW(), NOW())`,
      [batchId, tenantA.tenantId],
    );

    await testPool.query(
      `INSERT INTO classes (id, tenant_id, batch_id, session_id, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Class 8A', NOW(), NOW())`,
      [classId, tenantA.tenantId, batchId, sessionId],
    );

    await testPool.query(
      `INSERT INTO students (id, tenant_id, name, register_number, batch_id, class_id, created_at, updated_at)
       VALUES ($1, $2, 'Student A', 'S001', $3, $4, NOW(), NOW())`,
      [studentIdA, tenantA.tenantId, batchId, classId],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenantA.tenantId);
    await cleanupTenant(tenantB.tenantId);
  });

  it("CRITICAL: Tenant B admin cannot access Tenant A student", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/students/${studentIdA}`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect([403, 404]).toContain(res.status);
  });

  it("CRITICAL: Tenant B admin cannot list Tenant A students", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/students")
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    const studentIds = res.body.students?.map((s: { id: string }) => s.id) ?? [];
    expect(studentIds).not.toContain(studentIdA);
  });

  it("CRITICAL: Tenant B cannot update Tenant A student", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .patch(`/api/v1/students/${studentIdA}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Hacked Name" });

    expect([403, 404]).toContain(res.status);

    const student = await testPool.query(
      "SELECT name FROM students WHERE id = $1",
      [studentIdA],
    );
    expect(student.rows[0]?.name).toBe("Student A");
  });
});

// ── 2. Role-Based Access Control ────────────────────────────────────────────
describe("Security: Role-Based Access Control", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let teacherToken: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);
    teacherToken = await createTeacherAndLogin(tenant);
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("CRITICAL: Teacher cannot access admin-only endpoints", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .patch("/api/v1/settings/features")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ features: { timetable: true } });

    expect(res.status).toBe(403);
  });

  it("CRITICAL: Teacher cannot create users", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        name: "Unauthorized User",
        email: "unauth@test.local",
        roles: ["Admin"],
      });

    expect(res.status).toBe(403);
  });

  it("Admin can access settings", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/settings")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});

// ── 3. Token Validation ─────────────────────────────────────────────────────
describe("Security: Token Validation", () => {
  let tenant: TestTenant;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("CRITICAL: Rejects malformed JWT", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/students")
      .set("Authorization", "Bearer malformed.jwt.token");

    expect(res.status).toBe(401);
  });

  it("CRITICAL: Rejects missing Authorization header", async () => {
    if (SKIP) return;
    const res = await makeAgent().get("/api/v1/students");

    expect(res.status).toBe(401);
  });

  it("CRITICAL: Rejects expired token (token_version increment on logout)", async () => {
    if (SKIP) return;

    const loginRes = await makeAgent().post("/api/v1/auth/login").send({
      email: tenant.adminEmail,
      password: tenant.adminPassword,
      tenantId: tenant.tenantId,
    });

    const token = loginRes.body.token;

    // Verify token works
    const beforeLogout = await makeAgent()
      .get("/api/v1/students")
      .set("Authorization", `Bearer ${token}`);
    expect(beforeLogout.status).toBe(200);

    // Logout
    await makeAgent()
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    // Old token should be rejected
    const afterLogout = await makeAgent()
      .get("/api/v1/students")
      .set("Authorization", `Bearer ${token}`);

    expect(afterLogout.status).toBe(401);
  });
});

// ── 4. SuperAdmin vs Tenant Token Separation ────────────────────────────────
describe("Security: SuperAdmin vs Tenant Token Separation", () => {
  let tenant: TestTenant;
  let tenantToken: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    tenantToken = await loginAsAdmin(tenant);
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("CRITICAL: Tenant token cannot access SuperAdmin routes", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/superadmin/tenants")
      .set("Authorization", `Bearer ${tenantToken}`);

    expect([401, 403]).toContain(res.status);
  });

  it("CRITICAL: Tenant token cannot create tenants", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/superadmin/tenants")
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({
        name: "Unauthorized Tenant",
        slug: "unauthorized",
      });

    expect([401, 403]).toContain(res.status);
  });
});

// ── 5. Soft Delete Visibility ───────────────────────────────────────────────
describe("Security: Soft Delete Visibility", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let deletedStudentId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    const sessionId = uuidv4();
    const batchId = uuidv4();
    const classId = uuidv4();
    deletedStudentId = uuidv4();

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
      `INSERT INTO students (id, tenant_id, name, register_number, batch_id, class_id, deleted_at, created_at, updated_at)
       VALUES ($1, $2, 'Deleted Student', 'SDEL', $3, $4, NOW(), NOW(), NOW())`,
      [deletedStudentId, tenant.tenantId, batchId, classId],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Soft-deleted records not returned in list queries", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/students")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const studentIds = res.body.students?.map((s: { id: string }) => s.id) ?? [];
    expect(studentIds).not.toContain(deletedStudentId);
  });

  it("Soft-deleted records return 404 on direct access", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/students/${deletedStudentId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

// ── 6. Query Parameter Injection Prevention ─────────────────────────────────
describe("Security: Query Parameter Validation", () => {
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

  it("Rejects invalid UUID in path parameter", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/students/not-a-uuid")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it("Handles malicious query parameters safely", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/students?search='; DROP TABLE students;--")
      .set("Authorization", `Bearer ${adminToken}`);

    // Should either return 200 (safe) or 400 (invalid), never execute injection
    expect([200, 400]).toContain(res.status);

    // Verify table still exists
    const verify = await makeAgent()
      .get("/api/v1/students")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(verify.status).toBe(200);
  });
});
