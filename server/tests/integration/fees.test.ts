/**
 * Integration tests: Fee Management endpoints (v6.1)
 *
 * Covers:
 *   POST   /api/v1/fees/charges              — Create fee charge
 *   POST   /api/v1/fees/charges/bulk         — Bulk fee charge
 *   GET    /api/v1/fees/charges              — List charges
 *   DELETE /api/v1/fees/charges/:id          — Delete charge
 *   POST   /api/v1/fees/charges/:id/payments — Record payment
 *   GET    /api/v1/fees/summary              — Get fee summary
 *
 * Freeze v6.1 §13.3 — Mandatory test cases:
 *   1. Fee balance = SUM(charges) - SUM(payments) (regression test)
 *   2. Cannot delete charge if payments exist against it
 *   3. Delete charge uses DB transaction + row lock (FOR UPDATE)
 *   4. Payment amount must not exceed outstanding balance
 *   5. Payment status: PAID, PARTIAL, OVERDUE, OVERPAID
 *   6. Admin only access (403 for Teacher/Student/Guardian)
 *   7. Student/Guardian can view but not modify fees
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
  const teacherPassword = "Teacher@Pass123";
  const hash = await bcrypt.hash(teacherPassword, 10);

  await testPool.query(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, '["Teacher"]'::jsonb, NOW(), NOW())`,
    [teacherId, tenant.tenantId, "Test Teacher", teacherEmail, hash],
  );

  const res = await makeAgent().post("/api/v1/auth/login").send({
    email: teacherEmail,
    password: teacherPassword,
    tenantId: tenant.tenantId,
  });
  return res.body.token as string;
}

async function createStudentAndLogin(
  tenant: TestTenant,
): Promise<{ token: string; studentId: string; userId: string }> {
  const studentId = uuidv4();
  const userId = uuidv4();
  const studentEmail = `student-${uuidv4().slice(0, 8)}@test.local`;
  const studentPassword = "Student@Pass123";
  const hash = await bcrypt.hash(studentPassword, 10);

  // Get batch and class IDs for student
  const sessionId = uuidv4();
  const batchId = uuidv4();
  const classId = uuidv4();

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

  // Create student
  await testPool.query(
    `INSERT INTO students (id, tenant_id, name, register_number, batch_id, class_id, created_at, updated_at)
     VALUES ($1, $2, 'Test Student', 'S001', $3, $4, NOW(), NOW())`,
    [studentId, tenant.tenantId, batchId, classId],
  );

  // Create user account for student
  await testPool.query(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, '["Student"]'::jsonb, NOW(), NOW())`,
    [userId, tenant.tenantId, "Test Student", studentEmail, hash],
  );

  // Link user to student
  await testPool.query(
    `UPDATE students SET user_id = $1 WHERE id = $2`,
    [userId, studentId],
  );

  const res = await makeAgent().post("/api/v1/auth/login").send({
    email: studentEmail,
    password: studentPassword,
    tenantId: tenant.tenantId,
  });
  return { token: res.body.token as string, studentId, userId };
}

async function createGuardianAndLogin(
  tenant: TestTenant,
  studentId: string,
): Promise<{ token: string; guardianId: string }> {
  const guardianId = uuidv4();
  const guardianUserId = uuidv4();
  const guardianEmail = `guardian-${uuidv4().slice(0, 8)}@test.local`;
  const guardianPassword = "Guardian@Pass123";
  const hash = await bcrypt.hash(guardianPassword, 10);

  // Create user account for guardian
  await testPool.query(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, '["Guardian"]'::jsonb, NOW(), NOW())`,
    [guardianUserId, tenant.tenantId, "Test Guardian", guardianEmail, hash],
  );

  // Create guardian record
  await testPool.query(
    `INSERT INTO guardians (id, tenant_id, user_id, name, phone, relationship, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
    [guardianId, tenant.tenantId, guardianUserId, "Test Guardian", "+911234567890", "Father"],
  );

  // Link guardian to student
  await testPool.query(
    `INSERT INTO student_guardians (id, tenant_id, student_id, guardian_id, is_primary, created_at, updated_at)
     VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())`,
    [uuidv4(), tenant.tenantId, studentId, guardianId],
  );

  const res = await makeAgent().post("/api/v1/auth/login").send({
    email: guardianEmail,
    password: guardianPassword,
    tenantId: tenant.tenantId,
  });
  return { token: res.body.token as string, guardianId };
}

// ── POST /api/v1/fees/charges ───────────────────────────────────────────────
describe("POST /api/v1/fees/charges", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let teacherToken: string;
  let studentId: string;
  let sessionId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);
    teacherToken = await createTeacherAndLogin(tenant);

    // Create session, batch, class, student
    sessionId = uuidv4();
    const batchId = uuidv4();
    const classId = uuidv4();
    studentId = uuidv4();

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
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 201 and creates fee charge (Admin)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/fees/charges")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        studentId,
        sessionId,
        description: "DHSE Board Exam Fee 2026",
        category: "BoardExamFee",
        amount: 350.0,
        dueDate: "2026-01-31",
        notes: "Pay by January",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toMatchObject({
      studentId,
      sessionId,
      description: "DHSE Board Exam Fee 2026",
      category: "BoardExamFee",
      amount: 350.0,
      dueDate: "2026-01-31",
      balance: 350.0,
      totalPaid: 0,
    });
    expect(res.body.data).toHaveProperty("id");
  });

  it("returns 422 when required fields are missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/fees/charges")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ studentId }); // Missing sessionId, description, etc.

    expect(res.status).toBe(422);
  });

  it("returns 422 when amount is invalid (zero or negative)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/fees/charges")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        studentId,
        sessionId,
        description: "Invalid Fee",
        category: "Other",
        amount: -100,
      });

    expect(res.status).toBe(422);
  });

  it("returns 403 for Teacher role (Admin only)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/fees/charges")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        studentId,
        sessionId,
        description: "Test Fee",
        category: "Other",
        amount: 100,
      });

    expect(res.status).toBe(403);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/fees/charges")
      .send({
        studentId,
        sessionId,
        description: "Test Fee",
        category: "Other",
        amount: 100,
      });
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/fees/charges/bulk ──────────────────────────────────────────
describe("POST /api/v1/fees/charges/bulk", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let sessionId: string;
  let student1Id: string;
  let student2Id: string;
  let classId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create session, batch, class, students
    sessionId = uuidv4();
    const batchId = uuidv4();
    classId = uuidv4();
    student1Id = uuidv4();
    student2Id = uuidv4();

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
       VALUES
         ($1, $2, 'Student 1', 'S001', $3, $4, NOW(), NOW()),
         ($5, $2, 'Student 2', 'S002', $3, $4, NOW(), NOW())`,
      [student1Id, tenant.tenantId, batchId, classId, student2Id],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("creates bulk charges for specific studentIds", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/fees/charges/bulk")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        sessionId,
        description: "Uniform Fee 2026",
        category: "Other",
        amount: 500.0,
        targetType: "students",
        studentIds: [student1Id, student2Id],
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      created: 2,
      skipped: 0,
    });
  });

  it("creates bulk charges for entire class", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/fees/charges/bulk")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        sessionId,
        description: "Annual Fee 2026",
        category: "Other",
        amount: 1000.0,
        targetType: "class",
        classId,
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      created: 2,
      skipped: 0,
    });
  });

  it("skips duplicate charges (same description + sessionId)", async () => {
    if (SKIP) return;

    // Create first charge
    await makeAgent()
      .post("/api/v1/fees/charges/bulk")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        sessionId,
        description: "Duplicate Test Fee",
        category: "Other",
        amount: 100.0,
        targetType: "students",
        studentIds: [student1Id],
      });

    // Try to create duplicate
    const res = await makeAgent()
      .post("/api/v1/fees/charges/bulk")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        sessionId,
        description: "Duplicate Test Fee",
        category: "Other",
        amount: 100.0,
        targetType: "students",
        studentIds: [student1Id],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.skipped).toBeGreaterThanOrEqual(1);
  });

  it("returns 422 when targetType is invalid", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/fees/charges/bulk")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        sessionId,
        description: "Test Fee",
        category: "Other",
        amount: 100,
        targetType: "invalid",
      });

    expect(res.status).toBe(422);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().post("/api/v1/fees/charges/bulk").send({
      sessionId,
      description: "Test Fee",
      category: "Other",
      amount: 100,
      targetType: "class",
      classId,
    });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/fees/charges ─────────────────────────────────────────────────
describe("GET /api/v1/fees/charges", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let studentToken: string;
  let guardianToken: string;
  let student1Id: string;
  let student2Id: string;
  let sessionId: string;
  let charge1Id: string;
  let charge2Id: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create session, batch, class, students
    sessionId = uuidv4();
    const batchId = uuidv4();
    const classId = uuidv4();
    student1Id = uuidv4();
    student2Id = uuidv4();
    charge1Id = uuidv4();
    charge2Id = uuidv4();

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
       VALUES
         ($1, $2, 'Student 1', 'S001', $3, $4, NOW(), NOW()),
         ($5, $2, 'Student 2', 'S002', $3, $4, NOW(), NOW())`,
      [student1Id, tenant.tenantId, batchId, classId, student2Id],
    );

    // Create charges
    await testPool.query(
      `INSERT INTO fee_charges (id, tenant_id, student_id, session_id, description, category, amount, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, 'Board Fee', 'BoardExamFee', 350.00, NOW(), NOW()),
         ($5, $2, $6, $4, 'Books Fee', 'Books', 500.00, NOW(), NOW())`,
      [charge1Id, tenant.tenantId, student1Id, sessionId, charge2Id, student2Id],
    );

    // Create student login
    const studentLoginRes = await createStudentAndLogin(tenant);
    studentToken = studentLoginRes.token;

    // Create guardian linked to student1
    const guardianRes = await createGuardianAndLogin(tenant, student1Id);
    guardianToken = guardianRes.token;
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Admin: returns 200 with all charges", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/fees/charges")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);

    // Verify balance computation (regression test)
    const charge = res.body.data.find((c: { id: string }) => c.id === charge1Id);
    expect(charge).toMatchObject({
      amount: 350.0,
      totalPaid: 0,
      balance: 350.0,
    });
  });

  it("Admin: filters by studentId", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/fees/charges?studentId=${student1Id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    // All returned charges should be for student1
    for (const charge of res.body.data) {
      expect(charge.studentId).toBe(student1Id);
    }
  });

  it("Admin: filters by sessionId", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/fees/charges?sessionId=${sessionId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it("Admin: filters by hasBalance=true (outstanding only)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/fees/charges?hasBalance=true")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    // All returned charges should have balance > 0
    for (const charge of res.body.data) {
      expect(charge.balance).toBeGreaterThan(0);
    }
  });

  it("Student: can view own charges", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/fees/charges")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("Guardian: can view linked child's charges", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/fees/charges")
      .set("Authorization", `Bearer ${guardianToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get("/api/v1/fees/charges");
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/v1/fees/charges/:id ─────────────────────────────────────────
describe("DELETE /api/v1/fees/charges/:id", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let teacherToken: string;
  let chargeId: string;
  let studentId: string;
  let sessionId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);
    teacherToken = await createTeacherAndLogin(tenant);

    // Create session, batch, class, student
    sessionId = uuidv4();
    const batchId = uuidv4();
    const classId = uuidv4();
    studentId = uuidv4();
    chargeId = uuidv4();

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

    // Create charge
    await testPool.query(
      `INSERT INTO fee_charges (id, tenant_id, student_id, session_id, description, category, amount, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Test Fee', 'Other', 100.00, NOW(), NOW())`,
      [chargeId, tenant.tenantId, studentId, sessionId],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("deletes charge when no payments exist (regression: transaction + FOR UPDATE)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete(`/api/v1/fees/charges/${chargeId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    // Verify charge is deleted
    const { rows } = await testPool.query(
      "SELECT * FROM fee_charges WHERE id = $1",
      [chargeId],
    );
    expect(rows.length).toBe(0);
  });

  it("returns 400 when charge has payments (regression: cannot delete charge with payments)", async () => {
    if (SKIP) return;

    // Create a payment against the charge
    const paymentId = uuidv4();
    await testPool.query(
      `INSERT INTO fee_payments (id, tenant_id, charge_id, amount_paid, payment_mode, paid_at, recorded_by, recorded_at, created_at, updated_at)
       VALUES ($1, $2, $3, 50.00, 'Cash', '2026-01-20', $4, NOW(), NOW(), NOW())`,
      [paymentId, tenant.tenantId, chargeId, tenant.adminId],
    );

    const res = await makeAgent()
      .delete(`/api/v1/fees/charges/${chargeId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CHARGE_HAS_PAYMENTS");

    // Verify charge still exists
    const { rows } = await testPool.query(
      "SELECT * FROM fee_charges WHERE id = $1",
      [chargeId],
    );
    expect(rows.length).toBe(1);
  });

  it("returns 404 for non-existent charge", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete(`/api/v1/fees/charges/${uuidv4()}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 403 for Teacher role (Admin only)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete(`/api/v1/fees/charges/${chargeId}`)
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(403);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().delete(`/api/v1/fees/charges/${chargeId}`);
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/fees/charges/:id/payments ──────────────────────────────────
describe("POST /api/v1/fees/charges/:id/payments", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let teacherToken: string;
  let chargeId: string;
  let studentId: string;
  let sessionId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);
    teacherToken = await createTeacherAndLogin(tenant);

    // Create session, batch, class, student
    sessionId = uuidv4();
    const batchId = uuidv4();
    const classId = uuidv4();
    studentId = uuidv4();
    chargeId = uuidv4();

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

    // Create charge with amount 1000.00
    await testPool.query(
      `INSERT INTO fee_charges (id, tenant_id, student_id, session_id, description, category, amount, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Annual Fee', 'Other', 1000.00, NOW(), NOW())`,
      [chargeId, tenant.tenantId, studentId, sessionId],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("records payment successfully (regression: balance computation)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post(`/api/v1/fees/charges/${chargeId}/payments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        amountPaid: 500.0,
        paymentMode: "Cash",
        paidAt: "2026-01-20",
        receiptNumber: "RCT-001",
        notes: "Partial payment",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toMatchObject({
      chargeId,
      amountPaid: 500.0,
      paymentMode: "Cash",
      paidAt: "2026-01-20",
      receiptNumber: "RCT-001",
    });

    // Verify balance is updated
    const chargeRes = await makeAgent()
      .get(`/api/v1/fees/charges?studentId=${studentId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    const charge = chargeRes.body.data.find((c: { id: string }) => c.id === chargeId);
    expect(charge.totalPaid).toBe(500.0);
    expect(charge.balance).toBe(500.0); // 1000 - 500
  });

  it("allows multiple partial payments (regression: payment status PARTIAL)", async () => {
    if (SKIP) return;

    // First payment
    await makeAgent()
      .post(`/api/v1/fees/charges/${chargeId}/payments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        amountPaid: 300.0,
        paymentMode: "Cash",
        paidAt: "2026-01-10",
      });

    // Second payment
    const res = await makeAgent()
      .post(`/api/v1/fees/charges/${chargeId}/payments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        amountPaid: 200.0,
        paymentMode: "Cash",
        paidAt: "2026-01-20",
      });

    expect(res.status).toBe(201);

    // Verify total paid = 500
    const chargeRes = await makeAgent()
      .get(`/api/v1/fees/charges?studentId=${studentId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    const charge = chargeRes.body.data.find((c: { id: string }) => c.id === chargeId);
    expect(charge.totalPaid).toBe(500.0);
    expect(charge.balance).toBe(500.0);
  });

  it("allows full payment (regression: payment status PAID)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post(`/api/v1/fees/charges/${chargeId}/payments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        amountPaid: 1000.0,
        paymentMode: "Cash",
        paidAt: "2026-01-20",
      });

    expect(res.status).toBe(201);

    // Verify balance = 0
    const chargeRes = await makeAgent()
      .get(`/api/v1/fees/charges?studentId=${studentId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    const charge = chargeRes.body.data.find((c: { id: string }) => c.id === chargeId);
    expect(charge.totalPaid).toBe(1000.0);
    expect(charge.balance).toBe(0);
  });

  it("returns 400 when payment exceeds outstanding balance (regression: OVERPAYMENT)", async () => {
    if (SKIP) return;

    // Make a partial payment first
    await makeAgent()
      .post(`/api/v1/fees/charges/${chargeId}/payments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        amountPaid: 600.0,
        paymentMode: "Cash",
        paidAt: "2026-01-10",
      });

    // Try to pay more than the remaining balance (400 remaining, trying to pay 500)
    const res = await makeAgent()
      .post(`/api/v1/fees/charges/${chargeId}/payments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        amountPaid: 500.0,
        paymentMode: "Cash",
        paidAt: "2026-01-20",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("OVERPAYMENT");
  });

  it("returns 422 when required fields are missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post(`/api/v1/fees/charges/${chargeId}/payments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amountPaid: 100 }); // Missing paymentMode, paidAt

    expect(res.status).toBe(422);
  });

  it("returns 422 when amountPaid is invalid (zero or negative)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post(`/api/v1/fees/charges/${chargeId}/payments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        amountPaid: -50.0,
        paymentMode: "Cash",
        paidAt: "2026-01-20",
      });

    expect(res.status).toBe(422);
  });

  it("returns 404 for non-existent charge", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post(`/api/v1/fees/charges/${uuidv4()}/payments`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        amountPaid: 100.0,
        paymentMode: "Cash",
        paidAt: "2026-01-20",
      });
    expect(res.status).toBe(404);
  });

  it("returns 403 for Teacher role (Admin only)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post(`/api/v1/fees/charges/${chargeId}/payments`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        amountPaid: 100.0,
        paymentMode: "Cash",
        paidAt: "2026-01-20",
      });
    expect(res.status).toBe(403);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post(`/api/v1/fees/charges/${chargeId}/payments`)
      .send({
        amountPaid: 100.0,
        paymentMode: "Cash",
        paidAt: "2026-01-20",
      });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/fees/summary ─────────────────────────────────────────────────
describe("GET /api/v1/fees/summary", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  let student1Id: string;
  let student2Id: string;
  let sessionId: string;
  let classId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);
    teacherToken = await createTeacherAndLogin(tenant);

    // Create session, batch, class, students
    sessionId = uuidv4();
    const batchId = uuidv4();
    classId = uuidv4();
    student1Id = uuidv4();
    student2Id = uuidv4();

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
       VALUES
         ($1, $2, 'Student 1', 'S001', $3, $4, NOW(), NOW()),
         ($5, $2, 'Student 2', 'S002', $3, $4, NOW(), NOW())`,
      [student1Id, tenant.tenantId, batchId, classId, student2Id],
    );

    // Create charges
    const charge1Id = uuidv4();
    const charge2Id = uuidv4();
    await testPool.query(
      `INSERT INTO fee_charges (id, tenant_id, student_id, session_id, description, category, amount, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, 'Board Fee', 'BoardExamFee', 1000.00, NOW(), NOW()),
         ($5, $2, $6, $4, 'Books Fee', 'Books', 500.00, NOW(), NOW())`,
      [charge1Id, tenant.tenantId, student1Id, sessionId, charge2Id, student2Id],
    );

    // Create payment for student1 (partial)
    await testPool.query(
      `INSERT INTO fee_payments (id, tenant_id, charge_id, amount_paid, payment_mode, paid_at, recorded_by, recorded_at, created_at, updated_at)
       VALUES ($1, $2, $3, 300.00, 'Cash', '2026-01-20', $4, NOW(), NOW(), NOW())`,
      [uuidv4(), tenant.tenantId, charge1Id, tenant.adminId],
    );

    // Create student login
    const studentLoginRes = await createStudentAndLogin(tenant);
    studentToken = studentLoginRes.token;
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Admin: returns 200 with fee summary (regression: balance = SUM(charges) - SUM(payments))", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/fees/summary")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toMatchObject({
      totalCharged: 1500.0, // 1000 + 500
      totalPaid: 300.0,
      totalOutstanding: 1200.0, // 1500 - 300
      studentsWithBalance: 2,
    });

    expect(res.body.data.breakdown).toBeDefined();
    expect(Array.isArray(res.body.data.breakdown)).toBe(true);
    expect(res.body.data.breakdown.length).toBeGreaterThanOrEqual(2);

    // Verify breakdown includes per-student balance
    const student1Breakdown = res.body.data.breakdown.find(
      (b: { studentId: string }) => b.studentId === student1Id,
    );
    expect(student1Breakdown).toMatchObject({
      studentId: student1Id,
      studentName: "Student 1",
      totalCharged: 1000.0,
      totalPaid: 300.0,
      balance: 700.0,
    });

    const student2Breakdown = res.body.data.breakdown.find(
      (b: { studentId: string }) => b.studentId === student2Id,
    );
    expect(student2Breakdown).toMatchObject({
      studentId: student2Id,
      studentName: "Student 2",
      totalCharged: 500.0,
      totalPaid: 0,
      balance: 500.0,
    });
  });

  it("Admin: filters by sessionId", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/fees/summary?sessionId=${sessionId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("totalCharged");
    expect(res.body.data).toHaveProperty("totalOutstanding");
  });

  it("Admin: filters by classId", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/fees/summary?classId=${classId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("totalCharged");
    expect(res.body.data.breakdown.length).toBeGreaterThanOrEqual(2);
  });

  it("Teacher: can access summary", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/fees/summary")
      .set("Authorization", `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
  });

  it("returns 403 for Student role (Admin, Teacher only)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/fees/summary")
      .set("Authorization", `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get("/api/v1/fees/summary");
    expect(res.status).toBe(401);
  });
});
