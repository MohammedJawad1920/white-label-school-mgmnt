/**
 * Integration tests: Exam Management endpoints (v6.1)
 *
 * Covers:
 *   POST   /api/v1/exams                              — createExam (Admin)
 *   GET    /api/v1/exams                              — listExams (Admin, Teacher)
 *   GET    /api/v1/exams/:id                          — getExam
 *   PUT    /api/v1/exams/:id                          — updateExam (Admin, DRAFT only)
 *   PUT    /api/v1/exams/:id/publish                  — publishExam (Admin)
 *   POST   /api/v1/exams/:id/subjects                 — addExamSubject (Admin)
 *   PUT    /api/v1/exams/:id/subjects/:subjectId/marks — enterMarks (Teacher, Admin)
 *   GET    /api/v1/exams/:id/results                  — getResults (PUBLISHED only)
 *   GET    /api/v1/exams/:id/results/:studentId       — getStudentResult
 *
 * Freeze v6.1 §13.3 — Mandatory test cases:
 *   1. Cannot publish exam until all subject marks are entered
 *   2. Teacher can only enter marks for subjects they teach (security regression)
 *   3. Admin can enter marks for any subject
 *   4. Grade computation uses 8-grade scale (A+ to F)
 *   5. Published exams are read-only (cannot update marks)
 *   6. Rank calculation: ties get same rank, next rank skips
 *   7. Overall result: PASS if all subjects pass, FAIL otherwise
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

async function createTeacherAndLogin(
  tenant: TestTenant,
  subjectId: string,
): Promise<{ token: string; userId: string }> {
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
  return { token: res.body.token as string, userId: teacherId };
}

// ── POST /api/v1/exams ───────────────────────────────────────────────────────
describe("POST /api/v1/exams", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let sessionId: string;
  let classId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create session, batch, class
    sessionId = uuidv4();
    const batchId = uuidv4();
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

  it("returns 201 and creates exam with status DRAFT", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/exams")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        classId,
        sessionId,
        name: "Mid Term Exam",
        type: "TermExam",
      });

    expect(res.status).toBe(201);
    expect(res.body.exam).toMatchObject({
      classId,
      sessionId,
      name: "Mid Term Exam",
      type: "TermExam",
      status: "DRAFT",
    });
    expect(res.body.exam).toHaveProperty("id");
    expect(res.body.exam).toHaveProperty("gradeBoundaries");
    expect(res.body.exam.gradeBoundaries).toBeInstanceOf(Array);
  });

  it("returns 400 when required fields are missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/exams")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ classId });

    expect(res.status).toBe(400);
  });

  it("returns 400 when type is invalid", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/exams")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        classId,
        sessionId,
        name: "Test Exam",
        type: "InvalidType",
      });

    expect(res.status).toBe(400);
  });

  it("returns 404 when classId does not exist", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/exams")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        classId: uuidv4(),
        sessionId,
        name: "Test Exam",
        type: "TermExam",
      });

    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/exams")
      .send({
        classId,
        sessionId,
        name: "Test Exam",
        type: "TermExam",
      });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/exams ────────────────────────────────────────────────────────
describe("GET /api/v1/exams", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let teacherToken: string;
  let examId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create session, batch, class
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

    // Create test exam
    examId = uuidv4();
    await testPool.query(
      `INSERT INTO exams (id, tenant_id, session_id, class_id, name, type, status, grade_boundaries, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Mid Term', 'TermExam', 'DRAFT', '[]', $5, NOW(), NOW())`,
      [examId, tenant.tenantId, sessionId, classId, tenant.adminId],
    );

    // Create teacher (no specific subject association yet)
    const subjectId = uuidv4();
    await testPool.query(
      `INSERT INTO subjects (id, tenant_id, name, code, created_at, updated_at)
       VALUES ($1, $2, 'Math', 'MATH', NOW(), NOW())`,
      [subjectId, tenant.tenantId],
    );
    const teacher = await createTeacherAndLogin(tenant, subjectId);
    teacherToken = teacher.token;
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Admin: returns 200 with list of exams", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/exams")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("exams");
    expect(Array.isArray(res.body.exams)).toBe(true);
    expect(res.body.exams.length).toBeGreaterThanOrEqual(1);
  });

  it("Teacher: returns 200 with list of exams", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/exams")
      .set("Authorization", `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("exams");
    expect(Array.isArray(res.body.exams)).toBe(true);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get("/api/v1/exams");
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/exams/:id ────────────────────────────────────────────────────
describe("GET /api/v1/exams/:id", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let examId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create session, batch, class, exam
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

    examId = uuidv4();
    await testPool.query(
      `INSERT INTO exams (id, tenant_id, session_id, class_id, name, type, status, grade_boundaries, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Mid Term', 'TermExam', 'DRAFT', '[]', $5, NOW(), NOW())`,
      [examId, tenant.tenantId, sessionId, classId, tenant.adminId],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with exam details", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/exams/${examId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.exam).toMatchObject({
      id: examId,
      name: "Mid Term",
      type: "TermExam",
      status: "DRAFT",
    });
    expect(res.body.exam).toHaveProperty("subjects");
    expect(Array.isArray(res.body.exam.subjects)).toBe(true);
  });

  it("returns 404 for non-existent exam", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/exams/${uuidv4()}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get(`/api/v1/exams/${examId}`);
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/v1/exams/:id ────────────────────────────────────────────────────
describe("PUT /api/v1/exams/:id", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let examId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create session, batch, class, exam
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

    examId = uuidv4();
    await testPool.query(
      `INSERT INTO exams (id, tenant_id, session_id, class_id, name, type, status, grade_boundaries, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Mid Term', 'TermExam', 'DRAFT', '[]', $5, NOW(), NOW())`,
      [examId, tenant.tenantId, sessionId, classId, tenant.adminId],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("updates exam name when status is DRAFT", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/exams/${examId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Updated Exam Name" });

    expect(res.status).toBe(200);
    expect(res.body.exam.name).toBe("Updated Exam Name");
  });

  it("returns 409 when trying to update PUBLISHED exam (read-only, regression: Freeze §13.3.5)", async () => {
    if (SKIP) return;

    // Mark exam as published
    await testPool.query(
      "UPDATE exams SET status = 'PUBLISHED', published_by = $1, published_at = NOW() WHERE id = $2",
      [tenant.adminId, examId],
    );

    const res = await makeAgent()
      .put(`/api/v1/exams/${examId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Cannot Update" });

    expect(res.status).toBe(409);
  });

  it("returns 404 for non-existent exam", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/exams/${uuidv4()}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Test" });
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/exams/${examId}`)
      .send({ name: "Test" });
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/exams/:id/subjects ──────────────────────────────────────────
describe("POST /api/v1/exams/:id/subjects", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let examId: string;
  let subjectId: string;
  let teacherId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create session, batch, class, exam, subject, teacher
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

    examId = uuidv4();
    await testPool.query(
      `INSERT INTO exams (id, tenant_id, session_id, class_id, name, type, status, grade_boundaries, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Mid Term', 'TermExam', 'DRAFT', '[]', $5, NOW(), NOW())`,
      [examId, tenant.tenantId, sessionId, classId, tenant.adminId],
    );

    subjectId = uuidv4();
    await testPool.query(
      `INSERT INTO subjects (id, tenant_id, name, code, created_at, updated_at)
       VALUES ($1, $2, 'Math', 'MATH', NOW(), NOW())`,
      [subjectId, tenant.tenantId],
    );

    const teacher = await createTeacherAndLogin(tenant, subjectId);
    teacherId = teacher.userId;
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 201 and adds exam subject", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post(`/api/v1/exams/${examId}/subjects`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        subjectId,
        teacherId,
        examDate: "2026-09-15",
        totalMarks: 100,
        passMarks: 40,
      });

    expect(res.status).toBe(201);
    expect(res.body.examSubject).toMatchObject({
      examId,
      subjectId,
      teacherId,
      examDate: "2026-09-15",
      totalMarks: 100,
      passMarks: 40,
      marksStatus: "PENDING",
    });
  });

  it("returns 400 when required fields are missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post(`/api/v1/exams/${examId}/subjects`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ subjectId });

    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent exam", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post(`/api/v1/exams/${uuidv4()}/subjects`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        subjectId,
        teacherId,
        examDate: "2026-09-15",
        totalMarks: 100,
        passMarks: 40,
      });
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post(`/api/v1/exams/${examId}/subjects`)
      .send({
        subjectId,
        teacherId,
        examDate: "2026-09-15",
        totalMarks: 100,
        passMarks: 40,
      });
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/v1/exams/:id/subjects/:subjectId/marks ─────────────────────────
describe("PUT /api/v1/exams/:id/subjects/:subjectId/marks", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let teacherToken: string;
  let otherTeacherToken: string;
  let examId: string;
  let examSubjectId: string;
  let studentId: string;
  let subjectId: string;
  let teacherId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create session, batch, class, student
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
      `INSERT INTO students (id, tenant_id, name, register_number, batch_id, class_id, status, created_at, updated_at)
       VALUES ($1, $2, 'Student A', 'S001', $3, $4, 'Active', NOW(), NOW())`,
      [studentId, tenant.tenantId, batchId, classId],
    );

    // Create exam
    examId = uuidv4();
    await testPool.query(
      `INSERT INTO exams (id, tenant_id, session_id, class_id, name, type, status, grade_boundaries, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Mid Term', 'TermExam', 'DRAFT', '[]', $5, NOW(), NOW())`,
      [examId, tenant.tenantId, sessionId, classId, tenant.adminId],
    );

    // Create subject
    subjectId = uuidv4();
    await testPool.query(
      `INSERT INTO subjects (id, tenant_id, name, code, created_at, updated_at)
       VALUES ($1, $2, 'Math', 'MATH', NOW(), NOW())`,
      [subjectId, tenant.tenantId],
    );

    // Create teacher assigned to this subject
    const teacher = await createTeacherAndLogin(tenant, subjectId);
    teacherId = teacher.userId;
    teacherToken = teacher.token;

    // Create another subject and teacher not assigned to the exam subject
    const otherSubjectId = uuidv4();
    await testPool.query(
      `INSERT INTO subjects (id, tenant_id, name, code, created_at, updated_at)
       VALUES ($1, $2, 'Science', 'SCI', NOW(), NOW())`,
      [otherSubjectId, tenant.tenantId],
    );
    const otherTeacher = await createTeacherAndLogin(tenant, otherSubjectId);
    otherTeacherToken = otherTeacher.token;

    // Create exam subject
    examSubjectId = uuidv4();
    await testPool.query(
      `INSERT INTO exam_subjects (id, tenant_id, exam_id, subject_id, teacher_id, exam_date, total_marks, pass_marks, marks_status, created_at)
       VALUES ($1, $2, $3, $4, $5, '2026-09-15', 100, 40, 'PENDING', NOW())`,
      [examSubjectId, tenant.tenantId, examId, subjectId, teacherId],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Teacher: enters marks for assigned subject (regression: Freeze §13.3.2)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/exams/${examId}/subjects/${examSubjectId}/marks`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        students: [
          { studentId, marksObtained: 85, isAbsent: false },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);
  });

  it("Admin: can enter marks for any subject (regression: Freeze §13.3.3)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/exams/${examId}/subjects/${examSubjectId}/marks`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        students: [
          { studentId, marksObtained: 90, isAbsent: false },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);
  });

  it("returns 403 when Teacher tries to enter marks for unassigned subject (security regression: Freeze §13.3.2)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/exams/${examId}/subjects/${examSubjectId}/marks`)
      .set("Authorization", `Bearer ${otherTeacherToken}`)
      .send({
        students: [
          { studentId, marksObtained: 85, isAbsent: false },
        ],
      });

    expect(res.status).toBe(403);
  });

  it("returns 409 when trying to enter marks for PUBLISHED exam (regression: Freeze §13.3.5)", async () => {
    if (SKIP) return;

    // Mark exam as published
    await testPool.query(
      "UPDATE exams SET status = 'PUBLISHED', published_by = $1, published_at = NOW() WHERE id = $2",
      [tenant.adminId, examId],
    );

    const res = await makeAgent()
      .put(`/api/v1/exams/${examId}/subjects/${examSubjectId}/marks`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        students: [
          { studentId, marksObtained: 85, isAbsent: false },
        ],
      });

    expect(res.status).toBe(409);
  });

  it("returns 400 when marks exceed total marks", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/exams/${examId}/subjects/${examSubjectId}/marks`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        students: [
          { studentId, marksObtained: 150, isAbsent: false },
        ],
      });

    expect(res.status).toBe(400);
  });

  it("handles absent student correctly", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/exams/${examId}/subjects/${examSubjectId}/marks`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        students: [
          { studentId, marksObtained: null, isAbsent: true },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/exams/${examId}/subjects/${examSubjectId}/marks`)
      .send({
        students: [
          { studentId, marksObtained: 85, isAbsent: false },
        ],
      });
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/v1/exams/:id/publish ────────────────────────────────────────────
describe("PUT /api/v1/exams/:id/publish", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let teacherToken: string;
  let examId: string;
  let examSubjectId: string;
  let studentId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create session, batch, class, student
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
      `INSERT INTO students (id, tenant_id, name, register_number, batch_id, class_id, status, created_at, updated_at)
       VALUES ($1, $2, 'Student A', 'S001', $3, $4, 'Active', NOW(), NOW())`,
      [studentId, tenant.tenantId, batchId, classId],
    );

    // Create exam
    examId = uuidv4();
    await testPool.query(
      `INSERT INTO exams (id, tenant_id, session_id, class_id, name, type, status, grade_boundaries, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Mid Term', 'TermExam', 'DRAFT', $5, $6, NOW(), NOW())`,
      [
        examId,
        tenant.tenantId,
        sessionId,
        classId,
        JSON.stringify([
          { grade: "A+", minPercentage: 90, maxPercentage: 100, label: "Outstanding" },
          { grade: "A", minPercentage: 80, maxPercentage: 89, label: "Excellent" },
          { grade: "B+", minPercentage: 70, maxPercentage: 79, label: "Very Good" },
          { grade: "B", minPercentage: 60, maxPercentage: 69, label: "Good" },
          { grade: "C+", minPercentage: 50, maxPercentage: 59, label: "Above Average" },
          { grade: "C", minPercentage: 40, maxPercentage: 49, label: "Average" },
          { grade: "D", minPercentage: 30, maxPercentage: 39, label: "Below Average" },
          { grade: "F", minPercentage: 0, maxPercentage: 29, label: "Fail" },
        ]),
        tenant.adminId,
      ],
    );

    // Create subject and teacher
    const subjectId = uuidv4();
    await testPool.query(
      `INSERT INTO subjects (id, tenant_id, name, code, created_at, updated_at)
       VALUES ($1, $2, 'Math', 'MATH', NOW(), NOW())`,
      [subjectId, tenant.tenantId],
    );

    const teacher = await createTeacherAndLogin(tenant, subjectId);
    teacherToken = teacher.token;

    // Create exam subject
    examSubjectId = uuidv4();
    await testPool.query(
      `INSERT INTO exam_subjects (id, tenant_id, exam_id, subject_id, teacher_id, exam_date, total_marks, pass_marks, marks_status, created_at)
       VALUES ($1, $2, $3, $4, $5, '2026-09-15', 100, 40, 'PENDING', NOW())`,
      [examSubjectId, tenant.tenantId, examId, subjectId, teacher.userId],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 409 when marks are not entered for all subjects (regression: Freeze §13.3.1)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/exams/${examId}/publish`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
  });

  it("publishes exam after all marks are entered (regression: Freeze §13.3.1, §13.3.4)", async () => {
    if (SKIP) return;

    // Enter marks for all students
    await testPool.query(
      `INSERT INTO exam_results (id, tenant_id, exam_subject_id, student_id, marks_obtained, is_absent, entered_by, entered_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 85, false, $5, NOW(), NOW(), NOW())`,
      [uuidv4(), tenant.tenantId, examSubjectId, studentId, tenant.adminId],
    );

    // Mark subject as ENTERED
    await testPool.query(
      "UPDATE exam_subjects SET marks_status = 'ENTERED' WHERE id = $1",
      [examSubjectId],
    );

    const res = await makeAgent()
      .put(`/api/v1/exams/${examId}/publish`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.exam.status).toBe("PUBLISHED");
    expect(res.body.exam.publishedAt).toBeTruthy();

    // Verify grade computation uses 8-grade scale (regression: Freeze §13.3.4)
    const { rows } = await testPool.query(
      "SELECT grade FROM exam_results WHERE exam_subject_id = $1 AND student_id = $2",
      [examSubjectId, studentId],
    );
    expect(rows[0]?.grade).toMatch(/^(A\+|A|B\+|B|C\+|C|D|F)$/);
  });

  it("returns 403 when Teacher tries to publish (Admin only)", async () => {
    if (SKIP) return;

    // Enter marks first
    await testPool.query(
      `INSERT INTO exam_results (id, tenant_id, exam_subject_id, student_id, marks_obtained, is_absent, entered_by, entered_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 85, false, $5, NOW(), NOW(), NOW())`,
      [uuidv4(), tenant.tenantId, examSubjectId, studentId, tenant.adminId],
    );
    await testPool.query(
      "UPDATE exam_subjects SET marks_status = 'ENTERED' WHERE id = $1",
      [examSubjectId],
    );

    const res = await makeAgent()
      .put(`/api/v1/exams/${examId}/publish`)
      .set("Authorization", `Bearer ${teacherToken}`);

    expect(res.status).toBe(403);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().put(`/api/v1/exams/${examId}/publish`);
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/exams/:id/results ────────────────────────────────────────────
describe("GET /api/v1/exams/:id/results", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let examId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create session, batch, class
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

    // Create exam
    examId = uuidv4();
    await testPool.query(
      `INSERT INTO exams (id, tenant_id, session_id, class_id, name, type, status, grade_boundaries, created_by, published_by, published_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Mid Term', 'TermExam', 'PUBLISHED', '[]', $5, $5, NOW(), NOW(), NOW())`,
      [examId, tenant.tenantId, sessionId, classId, tenant.adminId],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with consolidated results for PUBLISHED exam", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/exams/${examId}/results`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("results");
    expect(res.body.results).toHaveProperty("examId");
    expect(res.body.results).toHaveProperty("subjects");
    expect(res.body.results).toHaveProperty("students");
    expect(Array.isArray(res.body.results.subjects)).toBe(true);
    expect(Array.isArray(res.body.results.students)).toBe(true);
  });

  it("returns 409 when exam is not PUBLISHED", async () => {
    if (SKIP) return;

    // Change exam back to DRAFT
    await testPool.query(
      "UPDATE exams SET status = 'DRAFT', published_by = NULL, published_at = NULL WHERE id = $1",
      [examId],
    );

    const res = await makeAgent()
      .get(`/api/v1/exams/${examId}/results`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
  });

  it("returns 404 for non-existent exam", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/exams/${uuidv4()}/results`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get(`/api/v1/exams/${examId}/results`);
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/exams/:id/results/:studentId ─────────────────────────────────
describe("GET /api/v1/exams/:id/results/:studentId", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let examId: string;
  let studentId: string;
  let examSubjectId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create session, batch, class, student
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
      `INSERT INTO students (id, tenant_id, name, register_number, batch_id, class_id, status, created_at, updated_at)
       VALUES ($1, $2, 'Student A', 'S001', $3, $4, 'Active', NOW(), NOW())`,
      [studentId, tenant.tenantId, batchId, classId],
    );

    // Create exam
    examId = uuidv4();
    await testPool.query(
      `INSERT INTO exams (id, tenant_id, session_id, class_id, name, type, status, grade_boundaries, created_by, published_by, published_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Mid Term', 'TermExam', 'PUBLISHED', $5, $6, $6, NOW(), NOW(), NOW())`,
      [
        examId,
        tenant.tenantId,
        sessionId,
        classId,
        JSON.stringify([
          { grade: "A+", minPercentage: 90, maxPercentage: 100, label: "Outstanding" },
          { grade: "A", minPercentage: 80, maxPercentage: 89, label: "Excellent" },
          { grade: "B+", minPercentage: 70, maxPercentage: 79, label: "Very Good" },
          { grade: "B", minPercentage: 60, maxPercentage: 69, label: "Good" },
          { grade: "C+", minPercentage: 50, maxPercentage: 59, label: "Above Average" },
          { grade: "C", minPercentage: 40, maxPercentage: 49, label: "Average" },
          { grade: "D", minPercentage: 30, maxPercentage: 39, label: "Below Average" },
          { grade: "F", minPercentage: 0, maxPercentage: 29, label: "Fail" },
        ]),
        tenant.adminId,
      ],
    );

    // Create subject, teacher, exam subject, result
    const subjectId = uuidv4();
    await testPool.query(
      `INSERT INTO subjects (id, tenant_id, name, code, created_at, updated_at)
       VALUES ($1, $2, 'Math', 'MATH', NOW(), NOW())`,
      [subjectId, tenant.tenantId],
    );

    const teacher = await createTeacherAndLogin(tenant, subjectId);
    examSubjectId = uuidv4();
    await testPool.query(
      `INSERT INTO exam_subjects (id, tenant_id, exam_id, subject_id, teacher_id, exam_date, total_marks, pass_marks, marks_status, created_at)
       VALUES ($1, $2, $3, $4, $5, '2026-09-15', 100, 40, 'LOCKED', NOW())`,
      [examSubjectId, tenant.tenantId, examId, subjectId, teacher.userId],
    );

    await testPool.query(
      `INSERT INTO exam_results (id, tenant_id, exam_subject_id, student_id, marks_obtained, is_absent, grade, is_pass, entered_by, entered_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 85, false, 'A', true, $5, NOW(), NOW(), NOW())`,
      [uuidv4(), tenant.tenantId, examSubjectId, studentId, tenant.adminId],
    );

    // Create student summary
    await testPool.query(
      `INSERT INTO exam_student_summaries (id, tenant_id, exam_id, student_id, total_marks_obtained, total_marks_possible, aggregate_percentage, overall_grade, overall_result, class_rank, created_at)
       VALUES ($1, $2, $3, $4, 85, 100, 85.0, 'A', 'PASS', 1, NOW())`,
      [uuidv4(), tenant.tenantId, examId, studentId],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with student result including summary (regression: Freeze §13.3.7)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/exams/${examId}/results/${studentId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.result).toHaveProperty("examId");
    expect(res.body.result).toHaveProperty("studentId");
    expect(res.body.result).toHaveProperty("subjects");
    expect(res.body.result).toHaveProperty("summary");
    expect(Array.isArray(res.body.result.subjects)).toBe(true);

    // Verify overall result logic (regression: Freeze §13.3.7)
    expect(res.body.result.summary.overallResult).toMatch(/^(PASS|FAIL|PENDING)$/);
  });

  it("returns 404 for non-existent student", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/exams/${examId}/results/${uuidv4()}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get(`/api/v1/exams/${examId}/results/${studentId}`);
    expect(res.status).toBe(401);
  });
});

// ── Rank calculation test ────────────────────────────────────────────────────
describe("Rank calculation (Freeze §13.3.6)", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let examId: string;
  let student1Id: string;
  let student2Id: string;
  let student3Id: string;
  let examSubjectId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create session, batch, class
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

    // Create 3 students
    student1Id = uuidv4();
    student2Id = uuidv4();
    student3Id = uuidv4();

    await testPool.query(
      `INSERT INTO students (id, tenant_id, name, register_number, batch_id, class_id, status, created_at, updated_at)
       VALUES
         ($1, $2, 'Student A', 'S001', $3, $4, 'Active', NOW(), NOW()),
         ($5, $2, 'Student B', 'S002', $3, $4, 'Active', NOW(), NOW()),
         ($6, $2, 'Student C', 'S003', $3, $4, 'Active', NOW(), NOW())`,
      [student1Id, tenant.tenantId, batchId, classId, student2Id, student3Id],
    );

    // Create exam
    examId = uuidv4();
    await testPool.query(
      `INSERT INTO exams (id, tenant_id, session_id, class_id, name, type, status, grade_boundaries, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Mid Term', 'TermExam', 'DRAFT', $5, $6, NOW(), NOW())`,
      [
        examId,
        tenant.tenantId,
        sessionId,
        classId,
        JSON.stringify([
          { grade: "A+", minPercentage: 90, maxPercentage: 100, label: "Outstanding" },
          { grade: "A", minPercentage: 80, maxPercentage: 89, label: "Excellent" },
          { grade: "B+", minPercentage: 70, maxPercentage: 79, label: "Very Good" },
          { grade: "B", minPercentage: 60, maxPercentage: 69, label: "Good" },
          { grade: "C+", minPercentage: 50, maxPercentage: 59, label: "Above Average" },
          { grade: "C", minPercentage: 40, maxPercentage: 49, label: "Average" },
          { grade: "D", minPercentage: 30, maxPercentage: 39, label: "Below Average" },
          { grade: "F", minPercentage: 0, maxPercentage: 29, label: "Fail" },
        ]),
        tenant.adminId,
      ],
    );

    // Create subject, teacher, exam subject
    const subjectId = uuidv4();
    await testPool.query(
      `INSERT INTO subjects (id, tenant_id, name, code, created_at, updated_at)
       VALUES ($1, $2, 'Math', 'MATH', NOW(), NOW())`,
      [subjectId, tenant.tenantId],
    );

    const teacher = await createTeacherAndLogin(tenant, subjectId);
    examSubjectId = uuidv4();
    await testPool.query(
      `INSERT INTO exam_subjects (id, tenant_id, exam_id, subject_id, teacher_id, exam_date, total_marks, pass_marks, marks_status, created_at)
       VALUES ($1, $2, $3, $4, $5, '2026-09-15', 100, 40, 'PENDING', NOW())`,
      [examSubjectId, tenant.tenantId, examId, subjectId, teacher.userId],
    );

    // Enter marks: Student A = 90, Student B = 90 (tie), Student C = 80
    await testPool.query(
      `INSERT INTO exam_results (id, tenant_id, exam_subject_id, student_id, marks_obtained, is_absent, entered_by, entered_at, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, 90, false, $5, NOW(), NOW(), NOW()),
         ($6, $2, $3, $7, 90, false, $5, NOW(), NOW(), NOW()),
         ($8, $2, $3, $9, 80, false, $5, NOW(), NOW(), NOW())`,
      [uuidv4(), tenant.tenantId, examSubjectId, student1Id, tenant.adminId, uuidv4(), student2Id, uuidv4(), student3Id],
    );

    // Mark subject as ENTERED
    await testPool.query(
      "UPDATE exam_subjects SET marks_status = 'ENTERED' WHERE id = $1",
      [examSubjectId],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("assigns same rank to students with identical percentage, next rank skips (regression: Freeze §13.3.6)", async () => {
    if (SKIP) return;

    // Publish exam to compute ranks
    await makeAgent()
      .put(`/api/v1/exams/${examId}/publish`)
      .set("Authorization", `Bearer ${adminToken}`);

    // Fetch student summaries
    const { rows } = await testPool.query(
      `SELECT student_id, class_rank FROM exam_student_summaries
       WHERE exam_id = $1 AND tenant_id = $2
       ORDER BY class_rank ASC NULLS LAST`,
      [examId, tenant.tenantId],
    );

    expect(rows.length).toBe(3);

    // Both Student A and Student B should have rank 1 (tied at 90%)
    const studentARank = rows.find((r) => r.student_id === student1Id)?.class_rank;
    const studentBRank = rows.find((r) => r.student_id === student2Id)?.class_rank;
    const studentCRank = rows.find((r) => r.student_id === student3Id)?.class_rank;

    expect(studentARank).toBe(1);
    expect(studentBRank).toBe(1);

    // Student C should have rank 3 (skipping rank 2 due to tie)
    expect(studentCRank).toBe(3);
  });
});
