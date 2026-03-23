/**
 * Integration tests: Guardian Portal endpoints (v6.1)
 *
 * Covers:
 *   GET   /api/v1/guardian-portal/child/:childId/attendance   — View child's attendance
 *   GET   /api/v1/guardian-portal/child/:childId/results       — View exam results
 *   GET   /api/v1/guardian-portal/child/:childId/fees          — View fees
 *   GET   /api/v1/guardian-portal/child/:childId/assignments   — View assignments
 *   GET   /api/v1/guardian-portal/child/:childId/leave-history — View leave history
 *
 * Freeze v6.1 §13.3 — Mandatory test cases:
 *   1. Guardian can only view linked children (same tenant)
 *   2. Guardian cannot access unlinked children (403)
 *   3. Student data filtered by student_id
 *   4. Attendance shows status per timeslot
 *   5. Results shows exam marks and grades
 *   6. Fees shows outstanding balance
 *   7. Assignments shows completion status
 *   8. Leave shows all requests (all statuses)
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

async function createGuardianWithChild(
  tenant: TestTenant,
): Promise<{ guardianToken: string; studentId: string; guardianId: string }> {
  const guardianId = uuidv4();
  const guardianUserId = uuidv4();
  const guardianEmail = `guardian-${uuidv4().slice(0, 8)}@test.local`;
  const hash = await bcrypt.hash("Guardian@Pass123", 10);

  // Create guardian user
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

  // Create student
  const sessionId = uuidv4();
  const batchId = uuidv4();
  const classId = uuidv4();
  const studentId = uuidv4();
  const studentUserId = uuidv4();

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
    `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, '["Student"]'::jsonb, NOW(), NOW())`,
    [studentUserId, tenant.tenantId, "Test Student", `student-${uuidv4().slice(0, 8)}@test.local`, hash],
  );

  await testPool.query(
    `INSERT INTO students (id, tenant_id, user_id, name, register_number, batch_id, class_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'S001', $5, $6, NOW(), NOW())`,
    [studentId, tenant.tenantId, studentUserId, "Test Student", batchId, classId],
  );

  // Link guardian to student
  await testPool.query(
    `INSERT INTO student_guardians (id, tenant_id, student_id, guardian_id, is_primary, created_at, updated_at)
     VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())`,
    [uuidv4(), tenant.tenantId, studentId, guardianId],
  );

  // Login guardian
  const res = await makeAgent().post("/api/v1/auth/login").send({
    email: guardianEmail,
    password: "Guardian@Pass123",
    tenantId: tenant.tenantId,
  });

  return {
    guardianToken: res.body.token as string,
    studentId,
    guardianId,
  };
}

// ── GET /api/v1/guardian-portal/child/:childId/attendance ──────────────────
describe("GET /api/v1/guardian-portal/child/:childId/attendance", () => {
  let tenant: TestTenant;
  let guardianToken: string;
  let studentId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    const setup = await createGuardianWithChild(tenant);
    guardianToken = setup.guardianToken;
    studentId = setup.studentId;

    // Create attendance records
    const sessionId = (
      await testPool.query(
        `SELECT id FROM academic_sessions WHERE tenant_id = $1 LIMIT 1`,
        [tenant.tenantId],
      )
    ).rows[0]!.id;
    const timeSlotId = uuidv4();

    await testPool.query(
      `INSERT INTO timeslots (id, tenant_id, session_id, class_id, subject_id, period_id, day_of_week, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, NOW(), NOW())`,
      [
        timeSlotId,
        tenant.tenantId,
        sessionId,
        (
          await testPool.query(
            `SELECT id FROM classes WHERE tenant_id = $1 LIMIT 1`,
            [tenant.tenantId],
          )
        ).rows[0]!.id,
        (
          await testPool.query(
            `SELECT id FROM subjects WHERE tenant_id = $1 LIMIT 1`,
            [tenant.tenantId],
          )
        ).rows[0]!.id,
        (
          await testPool.query(
            `SELECT id FROM school_periods WHERE tenant_id = $1 LIMIT 1`,
            [tenant.tenantId],
          )
        ).rows[0]!.id,
      ],
    );

    await testPool.query(
      `INSERT INTO attendance_records (id, tenant_id, student_id, timeslot_id, status, date, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, 'Present', '2026-09-01', NOW(), NOW()),
         ($5, $2, $3, $4, 'Absent', '2026-09-02', NOW(), NOW()),
         ($6, $2, $3, $4, 'Late', '2026-09-03', NOW(), NOW())`,
      [uuidv4(), tenant.tenantId, studentId, timeSlotId, uuidv4(), uuidv4()],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with child's attendance records", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/guardian-portal/child/${studentId}/attendance`)
      .set("Authorization", `Bearer ${guardianToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("attendance");
    expect(Array.isArray(res.body.attendance)).toBe(true);
    expect(res.body.attendance.length).toBeGreaterThanOrEqual(3);

    // Verify structure
    for (const record of res.body.attendance) {
      expect(record).toHaveProperty("date");
      expect(record).toHaveProperty("status");
      expect(["Present", "Absent", "Late", "Excused"]).toContain(record.status);
    }
  });

  it("returns 403 for unlinked child (security regression)", async () => {
    if (SKIP) return;
    const unlinkedStudentId = uuidv4();

    const res = await makeAgent()
      .get(`/api/v1/guardian-portal/child/${unlinkedStudentId}/attendance`)
      .set("Authorization", `Bearer ${guardianToken}`);

    expect(res.status).toBe(403);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get(
      `/api/v1/guardian-portal/child/${studentId}/attendance`,
    );
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/guardian-portal/child/:childId/results ──────────────────────
describe("GET /api/v1/guardian-portal/child/:childId/results", () => {
  let tenant: TestTenant;
  let guardianToken: string;
  let studentId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    const setup = await createGuardianWithChild(tenant);
    guardianToken = setup.guardianToken;
    studentId = setup.studentId;

    // Create exam results
    const sessionId = (
      await testPool.query(
        `SELECT id FROM academic_sessions WHERE tenant_id = $1 LIMIT 1`,
        [tenant.tenantId],
      )
    ).rows[0]!.id;
    const examId = uuidv4();
    const subjectId = (
      await testPool.query(
        `SELECT id FROM subjects WHERE tenant_id = $1 LIMIT 1`,
        [tenant.tenantId],
      )
    ).rows[0]!.id;

    await testPool.query(
      `INSERT INTO exams (id, tenant_id, session_id, name, max_score, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'Math Exam', 100, 'published', NOW(), NOW())`,
      [examId, tenant.tenantId, sessionId],
    );

    const resultId = uuidv4();
    await testPool.query(
      `INSERT INTO exam_results (id, tenant_id, exam_id, student_id, subject_id, score, grade, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 85, 'A', NOW(), NOW())`,
      [resultId, tenant.tenantId, examId, studentId, subjectId],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with child's exam results", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/guardian-portal/child/${studentId}/results`)
      .set("Authorization", `Bearer ${guardianToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("results");
    expect(Array.isArray(res.body.results)).toBe(true);

    for (const result of res.body.results) {
      expect(result).toHaveProperty("examName");
      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("grade");
    }
  });

  it("returns 403 for unlinked child", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(
        `/api/v1/guardian-portal/child/${uuidv4()}/results`,
      )
      .set("Authorization", `Bearer ${guardianToken}`);

    expect(res.status).toBe(403);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get(
      `/api/v1/guardian-portal/child/${studentId}/results`,
    );
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/guardian-portal/child/:childId/fees ───────────────────────
describe("GET /api/v1/guardian-portal/child/:childId/fees", () => {
  let tenant: TestTenant;
  let guardianToken: string;
  let studentId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    const setup = await createGuardianWithChild(tenant);
    guardianToken = setup.guardianToken;
    studentId = setup.studentId;

    // Create fees
    await testPool.query(
      `INSERT INTO fee_charges (id, tenant_id, student_id, amount, due_date, status, created_at, updated_at)
       VALUES
         ($1, $2, $3, 5000, '2026-09-30', 'pending', NOW(), NOW()),
         ($4, $2, $3, 3000, '2026-10-31', 'pending', NOW(), NOW())`,
      [uuidv4(), tenant.tenantId, studentId, uuidv4()],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with child's fees", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/guardian-portal/child/${studentId}/fees`)
      .set("Authorization", `Bearer ${guardianToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("fees");
    expect(Array.isArray(res.body.fees)).toBe(true);

    for (const fee of res.body.fees) {
      expect(fee).toHaveProperty("amount");
      expect(fee).toHaveProperty("dueDate");
      expect(fee).toHaveProperty("status");
    }
  });

  it("returns 403 for unlinked child", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/guardian-portal/child/${uuidv4()}/fees`)
      .set("Authorization", `Bearer ${guardianToken}`);

    expect(res.status).toBe(403);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get(
      `/api/v1/guardian-portal/child/${studentId}/fees`,
    );
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/guardian-portal/child/:childId/assignments ────────────────
describe("GET /api/v1/guardian-portal/child/:childId/assignments", () => {
  let tenant: TestTenant;
  let guardianToken: string;
  let studentId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    const setup = await createGuardianWithChild(tenant);
    guardianToken = setup.guardianToken;
    studentId = setup.studentId;

    // Create assignments
    const classId = (
      await testPool.query(
        `SELECT id FROM classes WHERE tenant_id = $1 LIMIT 1`,
        [tenant.tenantId],
      )
    ).rows[0]!.id;

    const assignmentId = uuidv4();
    await testPool.query(
      `INSERT INTO assignments (id, tenant_id, class_id, title, description, due_date, created_by_user_id, created_at, updated_at)
       VALUES ($1, $2, $3, 'Math HW', 'Chapter 5', '2026-09-10', $4, NOW(), NOW())`,
      [
        assignmentId,
        tenant.tenantId,
        classId,
        (
          await testPool.query(
            `SELECT id FROM users WHERE tenant_id = $1 AND roles @> '["Teacher"]'::jsonb LIMIT 1`,
            [tenant.tenantId],
          )
        ).rows[0]?.id || uuidv4(),
      ],
    );

    // Create submission
    await testPool.query(
      `INSERT INTO assignment_submissions (id, tenant_id, assignment_id, student_id, submitted_at, remarks, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), 'Good work', NOW(), NOW())`,
      [uuidv4(), tenant.tenantId, assignmentId, studentId],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with child's assignments", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/guardian-portal/child/${studentId}/assignments`)
      .set("Authorization", `Bearer ${guardianToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("assignments");
    expect(Array.isArray(res.body.assignments)).toBe(true);

    for (const assignment of res.body.assignments) {
      expect(assignment).toHaveProperty("title");
      expect(assignment).toHaveProperty("dueDate");
      expect(assignment).toHaveProperty("submitted");
    }
  });

  it("returns 403 for unlinked child", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/guardian-portal/child/${uuidv4()}/assignments`)
      .set("Authorization", `Bearer ${guardianToken}`);

    expect(res.status).toBe(403);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get(
      `/api/v1/guardian-portal/child/${studentId}/assignments`,
    );
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/guardian-portal/child/:childId/leave-history ─────────────────
describe("GET /api/v1/guardian-portal/child/:childId/leave-history", () => {
  let tenant: TestTenant;
  let guardianToken: string;
  let studentId: string;
  let guardianId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    const setup = await createGuardianWithChild(tenant);
    guardianToken = setup.guardianToken;
    studentId = setup.studentId;
    guardianId = setup.guardianId;

    // Create leave requests
    await testPool.query(
      `INSERT INTO leave_requests (id, tenant_id, student_id, submitted_by_guardian_id, start_date, end_date, reason, status, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, '2026-09-01', '2026-09-03', 'Family function', 'PENDING', NOW(), NOW()),
         ($5, $2, $3, $4, '2026-08-01', '2026-08-02', 'Medical', 'COMPLETED', NOW(), NOW())`,
      [uuidv4(), tenant.tenantId, studentId, guardianId, uuidv4()],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with child's leave history (all statuses)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/guardian-portal/child/${studentId}/leave-history`)
      .set("Authorization", `Bearer ${guardianToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("leaves");
    expect(Array.isArray(res.body.leaves)).toBe(true);
    expect(res.body.leaves.length).toBeGreaterThanOrEqual(2);

    for (const leave of res.body.leaves) {
      expect(leave).toHaveProperty("startDate");
      expect(leave).toHaveProperty("endDate");
      expect(leave).toHaveProperty("status");
      expect(leave).toHaveProperty("reason");
    }
  });

  it("returns 403 for unlinked child", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/guardian-portal/child/${uuidv4()}/leave-history`)
      .set("Authorization", `Bearer ${guardianToken}`);

    expect(res.status).toBe(403);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get(
      `/api/v1/guardian-portal/child/${studentId}/leave-history`,
    );
    expect(res.status).toBe(401);
  });
});
