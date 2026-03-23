/**
 * Integration tests: Leave Management endpoints (v6.1)
 *
 * Covers:
 *   POST   /api/v1/leave                    — Submit leave request (Guardian)
 *   GET    /api/v1/leave                    — List leave requests
 *   GET    /api/v1/leave/:id                — Get leave request
 *   PATCH  /api/v1/leave/:id/approve        — Approve leave (Class Teacher)
 *   PATCH  /api/v1/leave/:id/reject         — Reject leave (Class Teacher)
 *   PATCH  /api/v1/leave/:id/mark-departed  — Mark departed (Class Teacher)
 *   PATCH  /api/v1/leave/:id/mark-returned  — Mark returned (Class Teacher)
 *   PATCH  /api/v1/leave/:id/cancel         — Cancel leave
 *
 * Freeze v6.1 §13.3 — Mandatory test cases:
 *   1. State machine: PENDING → APPROVED → ACTIVE → COMPLETED
 *   2. Cannot approve/reject unless PENDING
 *   3. Cannot mark departed unless APPROVED
 *   4. Cannot mark returned unless ACTIVE
 *   5. Guardian can only submit for linked child (same tenant)
 *   6. Class Teacher can only approve for own class
 *   7. Admin can approve any leave
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

async function createClassTeacherAndLogin(
  tenant: TestTenant,
  classId: string,
): Promise<{ token: string; userId: string }> {
  const teacherId = uuidv4();
  const teacherEmail = `ct-${uuidv4().slice(0, 8)}@test.local`;
  const teacherPassword = "Teacher@Pass123";
  const hash = await bcrypt.hash(teacherPassword, 10);

  await testPool.query(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, class_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, '["Teacher"]'::jsonb, $6, NOW(), NOW())`,
    [teacherId, tenant.tenantId, "Class Teacher", teacherEmail, hash, classId],
  );

  const res = await makeAgent().post("/api/v1/auth/login").send({
    email: teacherEmail,
    password: teacherPassword,
    tenantId: tenant.tenantId,
  });
  return { token: res.body.token as string, userId: teacherId };
}

async function createGuardianAndLogin(
  tenant: TestTenant,
  studentId: string,
): Promise<{ token: string; guardianId: string; guardianUserId: string }> {
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
  return { token: res.body.token as string, guardianId, guardianUserId };
}

// ── POST /api/v1/leave ───────────────────────────────────────────────────────
describe("POST /api/v1/leave", () => {
  let tenant: TestTenant;
  let guardianToken: string;
  let studentId: string;
  let classId: string;
  let sessionId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();

    // Create session, batch, class, student
    sessionId = uuidv4();
    const batchId = uuidv4();
    classId = uuidv4();
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

    const guardian = await createGuardianAndLogin(tenant, studentId);
    guardianToken = guardian.token;
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 201 and creates leave request with status PENDING", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/leave")
      .set("Authorization", `Bearer ${guardianToken}`)
      .send({
        studentId,
        startDate: "2026-09-01",
        endDate: "2026-09-03",
        reason: "Family function",
      });

    expect(res.status).toBe(201);
    expect(res.body.leave).toMatchObject({
      studentId,
      startDate: "2026-09-01",
      endDate: "2026-09-03",
      reason: "Family function",
      status: "PENDING",
    });
    expect(res.body.leave).toHaveProperty("id");
  });

  it("returns 403 when Guardian tries to submit leave for unlinked student (security regression)", async () => {
    if (SKIP) return;

    // Create another student not linked to guardian
    const otherStudentId = uuidv4();
    await testPool.query(
      `INSERT INTO students (id, tenant_id, name, register_number, batch_id, class_id, created_at, updated_at)
       VALUES ($1, $2, 'Other Student', 'S999', $3, $4, NOW(), NOW())`,
      [otherStudentId, tenant.tenantId, (await testPool.query(`SELECT id FROM batches WHERE tenant_id = $1 LIMIT 1`, [tenant.tenantId])).rows[0]!.id, classId],
    );

    const res = await makeAgent()
      .post("/api/v1/leave")
      .set("Authorization", `Bearer ${guardianToken}`)
      .send({
        studentId: otherStudentId,
        startDate: "2026-09-01",
        endDate: "2026-09-03",
        reason: "Unauthorized request",
      });

    expect(res.status).toBe(403);
  });

  it("returns 400 when endDate is before startDate", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/leave")
      .set("Authorization", `Bearer ${guardianToken}`)
      .send({
        studentId,
        startDate: "2026-09-05",
        endDate: "2026-09-01", // Before start
        reason: "Invalid dates",
      });

    expect(res.status).toBe(400);
  });

  it("returns 422 when required fields are missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/leave")
      .set("Authorization", `Bearer ${guardianToken}`)
      .send({ studentId }); // Missing dates and reason

    expect(res.status).toBe(422);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/leave")
      .send({
        studentId,
        startDate: "2026-09-01",
        endDate: "2026-09-03",
        reason: "Test",
      });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/leave ────────────────────────────────────────────────────────
describe("GET /api/v1/leave", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let guardianToken: string;
  let studentId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create student
    const sessionId = uuidv4();
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

    const guardian = await createGuardianAndLogin(tenant, studentId);
    guardianToken = guardian.token;

    // Create test leave requests
    await testPool.query(
      `INSERT INTO leave_requests (id, tenant_id, student_id, submitted_by_guardian_id, start_date, end_date, reason, status, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, '2026-09-01', '2026-09-03', 'Test leave 1', 'PENDING', NOW(), NOW()),
         ($5, $2, $3, $4, '2026-10-01', '2026-10-03', 'Test leave 2', 'APPROVED', NOW(), NOW())`,
      [uuidv4(), tenant.tenantId, studentId, guardian.guardianId, uuidv4()],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Admin: returns 200 with all leave requests", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/leave")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("leaves");
    expect(Array.isArray(res.body.leaves)).toBe(true);
    expect(res.body.leaves.length).toBeGreaterThanOrEqual(2);
  });

  it("Guardian: returns only leaves for linked children", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/leave")
      .set("Authorization", `Bearer ${guardianToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.leaves)).toBe(true);

    // All returned leaves should be for the guardian's linked student
    for (const leave of res.body.leaves) {
      expect(leave.studentId).toBe(studentId);
    }
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get("/api/v1/leave");
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/leave/:id/approve ──────────────────────────────────────────
describe("PATCH /api/v1/leave/:id/approve", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let classTeacherToken: string;
  let otherClassTeacherToken: string;
  let studentId: string;
  let leaveId: string;
  let classId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create session, batch, class, student
    const sessionId = uuidv4();
    const batchId = uuidv4();
    classId = uuidv4();
    studentId = uuidv4();
    leaveId = uuidv4();

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

    // Create guardian
    const guardianId = uuidv4();
    await testPool.query(
      `INSERT INTO guardians (id, tenant_id, user_id, name, phone, relationship, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [guardianId, tenant.tenantId, uuidv4(), "Guardian", "+911234567890", "Father"],
    );

    // Create leave request
    await testPool.query(
      `INSERT INTO leave_requests (id, tenant_id, student_id, submitted_by_guardian_id, start_date, end_date, reason, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, '2026-09-01', '2026-09-03', 'Family function', 'PENDING', NOW(), NOW())`,
      [leaveId, tenant.tenantId, studentId, guardianId],
    );

    // Create class teacher for this class
    const ct = await createClassTeacherAndLogin(tenant, classId);
    classTeacherToken = ct.token;

    // Create another class and class teacher
    const otherClassId = uuidv4();
    await testPool.query(
      `INSERT INTO classes (id, tenant_id, batch_id, session_id, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Class 8B', NOW(), NOW())`,
      [otherClassId, tenant.tenantId, batchId, sessionId],
    );
    const otherCt = await createClassTeacherAndLogin(tenant, otherClassId);
    otherClassTeacherToken = otherCt.token;
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Class Teacher: approves leave for own class (status PENDING → APPROVED, regression: state machine)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .patch(`/api/v1/leave/${leaveId}/approve`)
      .set("Authorization", `Bearer ${classTeacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.leave.status).toBe("APPROVED");
    expect(res.body.leave.approvedAt).toBeTruthy();
  });

  it("Admin: can approve any leave", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .patch(`/api/v1/leave/${leaveId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.leave.status).toBe("APPROVED");
  });

  it("returns 403 when Class Teacher tries to approve leave for different class (security regression)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .patch(`/api/v1/leave/${leaveId}/approve`)
      .set("Authorization", `Bearer ${otherClassTeacherToken}`);

    expect(res.status).toBe(403);
  });

  it("returns 400 when leave is not in PENDING status (regression: cannot approve already approved leave)", async () => {
    if (SKIP) return;

    // First approval
    await makeAgent()
      .patch(`/api/v1/leave/${leaveId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);

    // Try to approve again
    const res = await makeAgent()
      .patch(`/api/v1/leave/${leaveId}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent leave", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .patch(`/api/v1/leave/${uuidv4()}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().patch(`/api/v1/leave/${leaveId}/approve`);
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/leave/:id/reject ───────────────────────────────────────────
describe("PATCH /api/v1/leave/:id/reject", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let leaveId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create minimal data for leave
    const sessionId = uuidv4();
    const batchId = uuidv4();
    const classId = uuidv4();
    const studentId = uuidv4();
    leaveId = uuidv4();
    const guardianId = uuidv4();

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

    await testPool.query(
      `INSERT INTO guardians (id, tenant_id, user_id, name, phone, relationship, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [guardianId, tenant.tenantId, uuidv4(), "Guardian", "+911234567890", "Father"],
    );

    await testPool.query(
      `INSERT INTO leave_requests (id, tenant_id, student_id, submitted_by_guardian_id, start_date, end_date, reason, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, '2026-09-01', '2026-09-03', 'Test', 'PENDING', NOW(), NOW())`,
      [leaveId, tenant.tenantId, studentId, guardianId],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("rejects leave (status PENDING → REJECTED, regression: state machine)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .patch(`/api/v1/leave/${leaveId}/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ rejectionReason: "Date conflict" });

    expect(res.status).toBe(200);
    expect(res.body.leave.status).toBe("REJECTED");
    expect(res.body.leave.rejectedAt).toBeTruthy();
    expect(res.body.leave.rejectionReason).toBe("Date conflict");
  });

  it("returns 400 when leave is not in PENDING status", async () => {
    if (SKIP) return;

    // Approve first
    await testPool.query(
      "UPDATE leave_requests SET status = 'APPROVED', approved_at = NOW() WHERE id = $1",
      [leaveId],
    );

    // Try to reject
    const res = await makeAgent()
      .patch(`/api/v1/leave/${leaveId}/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ rejectionReason: "Too late" });

    expect(res.status).toBe(400);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .patch(`/api/v1/leave/${leaveId}/reject`)
      .send({ rejectionReason: "Test" });
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/leave/:id/mark-departed ───────────────────────────────────
describe("PATCH /api/v1/leave/:id/mark-departed", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let leaveId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create approved leave
    const sessionId = uuidv4();
    const batchId = uuidv4();
    const classId = uuidv4();
    const studentId = uuidv4();
    leaveId = uuidv4();
    const guardianId = uuidv4();

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

    await testPool.query(
      `INSERT INTO guardians (id, tenant_id, user_id, name, phone, relationship, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [guardianId, tenant.tenantId, uuidv4(), "Guardian", "+911234567890", "Father"],
    );

    await testPool.query(
      `INSERT INTO leave_requests (id, tenant_id, student_id, submitted_by_guardian_id, start_date, end_date, reason, status, approved_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, '2026-09-01', '2026-09-03', 'Test', 'APPROVED', NOW(), NOW(), NOW())`,
      [leaveId, tenant.tenantId, studentId, guardianId],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("marks student as departed (status APPROVED → ACTIVE, regression: state machine)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .patch(`/api/v1/leave/${leaveId}/mark-departed`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.leave.status).toBe("ACTIVE");
    expect(res.body.leave.departedAt).toBeTruthy();
  });

  it("returns 400 when leave is not APPROVED (regression: cannot mark departed unless approved)", async () => {
    if (SKIP) return;

    // Create pending leave
    const pendingLeaveId = uuidv4();
    const sessionId = (await testPool.query(`SELECT id FROM academic_sessions WHERE tenant_id = $1 LIMIT 1`, [tenant.tenantId])).rows[0]!.id;
    const studentId = (await testPool.query(`SELECT id FROM students WHERE tenant_id = $1 LIMIT 1`, [tenant.tenantId])).rows[0]!.id;
    const guardianId = (await testPool.query(`SELECT id FROM guardians WHERE tenant_id = $1 LIMIT 1`, [tenant.tenantId])).rows[0]!.id;

    await testPool.query(
      `INSERT INTO leave_requests (id, tenant_id, student_id, submitted_by_guardian_id, start_date, end_date, reason, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, '2026-10-01', '2026-10-03', 'Test', 'PENDING', NOW(), NOW())`,
      [pendingLeaveId, tenant.tenantId, studentId, guardianId],
    );

    const res = await makeAgent()
      .patch(`/api/v1/leave/${pendingLeaveId}/mark-departed`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().patch(`/api/v1/leave/${leaveId}/mark-departed`);
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/leave/:id/mark-returned ───────────────────────────────────
describe("PATCH /api/v1/leave/:id/mark-returned", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let leaveId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create active leave (student has departed)
    const sessionId = uuidv4();
    const batchId = uuidv4();
    const classId = uuidv4();
    const studentId = uuidv4();
    leaveId = uuidv4();
    const guardianId = uuidv4();

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

    await testPool.query(
      `INSERT INTO guardians (id, tenant_id, user_id, name, phone, relationship, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [guardianId, tenant.tenantId, uuidv4(), "Guardian", "+911234567890", "Father"],
    );

    await testPool.query(
      `INSERT INTO leave_requests (id, tenant_id, student_id, submitted_by_guardian_id, start_date, end_date, reason, status, approved_at, departed_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, '2026-09-01', '2026-09-03', 'Test', 'ACTIVE', NOW(), NOW(), NOW(), NOW())`,
      [leaveId, tenant.tenantId, studentId, guardianId],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("marks student as returned (status ACTIVE → COMPLETED, regression: state machine)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .patch(`/api/v1/leave/${leaveId}/mark-returned`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.leave.status).toBe("COMPLETED");
    expect(res.body.leave.returnedAt).toBeTruthy();
  });

  it("returns 400 when leave is not ACTIVE (regression: cannot mark returned unless active)", async () => {
    if (SKIP) return;

    // Create approved leave (not yet departed)
    const approvedLeaveId = uuidv4();
    const sessionId = (await testPool.query(`SELECT id FROM academic_sessions WHERE tenant_id = $1 LIMIT 1`, [tenant.tenantId])).rows[0]!.id;
    const studentId = (await testPool.query(`SELECT id FROM students WHERE tenant_id = $1 LIMIT 1`, [tenant.tenantId])).rows[0]!.id;
    const guardianId = (await testPool.query(`SELECT id FROM guardians WHERE tenant_id = $1 LIMIT 1`, [tenant.tenantId])).rows[0]!.id;

    await testPool.query(
      `INSERT INTO leave_requests (id, tenant_id, student_id, submitted_by_guardian_id, start_date, end_date, reason, status, approved_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, '2026-10-01', '2026-10-03', 'Test', 'APPROVED', NOW(), NOW(), NOW())`,
      [approvedLeaveId, tenant.tenantId, studentId, guardianId],
    );

    const res = await makeAgent()
      .patch(`/api/v1/leave/${approvedLeaveId}/mark-returned`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().patch(`/api/v1/leave/${leaveId}/mark-returned`);
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/leave/:id/cancel ──────────────────────────────────────────
describe("PATCH /api/v1/leave/:id/cancel", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let leaveId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create pending leave
    const sessionId = uuidv4();
    const batchId = uuidv4();
    const classId = uuidv4();
    const studentId = uuidv4();
    leaveId = uuidv4();
    const guardianId = uuidv4();

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

    await testPool.query(
      `INSERT INTO guardians (id, tenant_id, user_id, name, phone, relationship, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [guardianId, tenant.tenantId, uuidv4(), "Guardian", "+911234567890", "Father"],
    );

    await testPool.query(
      `INSERT INTO leave_requests (id, tenant_id, student_id, submitted_by_guardian_id, start_date, end_date, reason, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, '2026-09-01', '2026-09-03', 'Test', 'PENDING', NOW(), NOW())`,
      [leaveId, tenant.tenantId, studentId, guardianId],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("cancels leave (status → CANCELLED)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .patch(`/api/v1/leave/${leaveId}/cancel`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cancellationReason: "Changed plans" });

    expect(res.status).toBe(200);
    expect(res.body.leave.status).toBe("CANCELLED");
    expect(res.body.leave.cancelledAt).toBeTruthy();
  });

  it("returns 400 when leave is COMPLETED (cannot cancel completed leave)", async () => {
    if (SKIP) return;

    // Mark leave as completed
    await testPool.query(
      "UPDATE leave_requests SET status = 'COMPLETED', approved_at = NOW(), departed_at = NOW(), returned_at = NOW() WHERE id = $1",
      [leaveId],
    );

    const res = await makeAgent()
      .patch(`/api/v1/leave/${leaveId}/cancel`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ cancellationReason: "Too late" });

    expect(res.status).toBe(400);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .patch(`/api/v1/leave/${leaveId}/cancel`)
      .send({ cancellationReason: "Test" });
    expect(res.status).toBe(401);
  });
});
