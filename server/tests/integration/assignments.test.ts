/**
 * Integration tests: Assignments endpoints (v6.1)
 *
 * Covers:
 *   POST   /api/v1/assignments                  — Create assignment
 *   GET    /api/v1/assignments                  — List assignments
 *   GET    /api/v1/assignments/:id              — Get assignment
 *   PUT    /api/v1/assignments/:id              — Update assignment
 *   DELETE /api/v1/assignments/:id              — Delete (soft delete)
 *   PUT    /api/v1/assignments/:id/close        — Close assignment
 *   GET    /api/v1/assignments/:id/submissions  — Get submissions (marking sheet)
 *   PUT    /api/v1/assignments/:id/submissions  — Bulk mark submissions
 *
 * Freeze v6.1 §13.3 — Mandatory test cases:
 *   1. Teacher can only create assignments for classes they teach (security regression)
 *   2. Admin can create assignments for any class
 *   3. Student can only see assignments assigned to their class
 *   4. Submission status: PENDING, COMPLETED, INCOMPLETE, NOT_SUBMITTED
 *   5. Teacher can mark submissions complete with remarks
 *   6. Due date validation (must be future date)
 *   7. Class/Batch scoping (students only see their assignments)
 *   8. Soft delete sets deleted_at
 *   9. Close assignment (Admin only)
 *  10. Auto-creates submissions for all active students in class
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

async function createStudentAndLogin(
  tenant: TestTenant,
  studentId: string,
): Promise<string> {
  const studentUserId = uuidv4();
  const studentEmail = `student-${uuidv4().slice(0, 8)}@test.local`;
  const studentPassword = "Student@Pass123";
  const hash = await bcrypt.hash(studentPassword, 10);

  // Create user account for student
  await testPool.query(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, student_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, '["Student"]'::jsonb, $6, NOW(), NOW())`,
    [
      studentUserId,
      tenant.tenantId,
      "Test Student",
      studentEmail,
      hash,
      studentId,
    ],
  );

  const res = await makeAgent().post("/api/v1/auth/login").send({
    email: studentEmail,
    password: studentPassword,
    tenantId: tenant.tenantId,
  });
  return res.body.token as string;
}

// ── POST /api/v1/assignments ─────────────────────────────────────────────────
describe("POST /api/v1/assignments", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let classTeacherToken: string;
  let otherTeacherToken: string;
  let sessionId: string;
  let classId: string;
  let otherClassId: string;
  let subjectId: string;
  let studentId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create session, batch, classes, subject, student
    sessionId = uuidv4();
    const batchId = uuidv4();
    classId = uuidv4();
    otherClassId = uuidv4();
    subjectId = uuidv4();
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
      `INSERT INTO classes (id, tenant_id, batch_id, session_id, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Class 8B', NOW(), NOW())`,
      [otherClassId, tenant.tenantId, batchId, sessionId],
    );

    await testPool.query(
      `INSERT INTO subjects (id, tenant_id, name, created_at, updated_at)
       VALUES ($1, $2, 'Mathematics', NOW(), NOW())`,
      [subjectId, tenant.tenantId],
    );

    await testPool.query(
      `INSERT INTO students (id, tenant_id, name, register_number, batch_id, class_id, status, created_at, updated_at)
       VALUES ($1, $2, 'Student A', 'S001', $3, $4, 'Active', NOW(), NOW())`,
      [studentId, tenant.tenantId, batchId, classId],
    );

    // Create class teacher for classId
    const ct = await createClassTeacherAndLogin(tenant, classId);
    classTeacherToken = ct.token;

    // Create teacher for otherClassId
    const otherCt = await createClassTeacherAndLogin(tenant, otherClassId);
    otherTeacherToken = otherCt.token;
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Admin: returns 201 and creates assignment with submissions for all class students (auto-create test)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/assignments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        sessionId,
        classId,
        subjectId,
        title: "Math Homework 1",
        description: "Solve problems 1-10",
        type: "Written",
        dueDate: "2026-12-31",
        isGraded: true,
        maxMarks: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: "Math Homework 1",
      type: "Written",
      status: "ACTIVE",
      isGraded: true,
      maxMarks: 100,
    });
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data.submissionsCreated).toBeGreaterThanOrEqual(1);

    // Verify submission was auto-created
    const submissions = await testPool.query(
      `SELECT * FROM assignment_submissions WHERE assignment_id = $1 AND tenant_id = $2`,
      [res.body.data.id, tenant.tenantId],
    );
    expect(submissions.rows.length).toBeGreaterThanOrEqual(1);
    expect(submissions.rows[0]!.status).toBe("PENDING");
  });

  it("Class Teacher: returns 201 when creating assignment for own class (security test)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/assignments")
      .set("Authorization", `Bearer ${classTeacherToken}`)
      .send({
        sessionId,
        classId,
        subjectId,
        title: "Class 8A Quiz",
        type: "ProblemSet",
        dueDate: "2026-12-25",
        isGraded: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("Class 8A Quiz");
  });

  it("returns 403 when Teacher tries to create assignment for different class (security regression)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/assignments")
      .set("Authorization", `Bearer ${classTeacherToken}`)
      .send({
        sessionId,
        classId: otherClassId, // Different class
        subjectId,
        title: "Unauthorized assignment",
        type: "Written",
        dueDate: "2026-12-31",
      });

    expect(res.status).toBe(403);
  });

  it("returns 400 when dueDate is in the past (validation regression)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/assignments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        sessionId,
        classId,
        subjectId,
        title: "Past assignment",
        type: "Written",
        dueDate: "2020-01-01", // Past date
      });

    expect(res.status).toBe(400);
  });

  it("returns 422 when required fields are missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/assignments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Incomplete" }); // Missing required fields

    expect(res.status).toBe(422);
  });

  it("returns 422 when type is invalid", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/assignments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        sessionId,
        classId,
        subjectId,
        title: "Invalid Type",
        type: "InvalidType",
        dueDate: "2026-12-31",
      });

    expect(res.status).toBe(422);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/assignments")
      .send({
        sessionId,
        classId,
        subjectId,
        title: "No auth",
        type: "Written",
        dueDate: "2026-12-31",
      });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/assignments ──────────────────────────────────────────────────
describe("GET /api/v1/assignments", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let studentToken: string;
  let classId: string;
  let otherClassId: string;
  let studentId: string;
  let assignmentIdClass1: string;
  let assignmentIdClass2: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create sessions, batches, classes, subject, students
    const sessionId = uuidv4();
    const batchId = uuidv4();
    classId = uuidv4();
    otherClassId = uuidv4();
    const subjectId = uuidv4();
    studentId = uuidv4();
    const otherStudentId = uuidv4();

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
       VALUES ($1, $2, $3, $4, 'Class 8A', NOW(), NOW()),
              ($5, $2, $3, $4, 'Class 8B', NOW(), NOW())`,
      [classId, tenant.tenantId, batchId, sessionId, otherClassId],
    );

    await testPool.query(
      `INSERT INTO subjects (id, tenant_id, name, created_at, updated_at)
       VALUES ($1, $2, 'Mathematics', NOW(), NOW())`,
      [subjectId, tenant.tenantId],
    );

    await testPool.query(
      `INSERT INTO students (id, tenant_id, name, register_number, batch_id, class_id, status, created_at, updated_at)
       VALUES ($1, $2, 'Student A', 'S001', $3, $4, 'Active', NOW(), NOW()),
              ($5, $2, 'Student B', 'S002', $3, $6, 'Active', NOW(), NOW())`,
      [studentId, tenant.tenantId, batchId, classId, otherStudentId, otherClassId],
    );

    studentToken = await createStudentAndLogin(tenant, studentId);

    // Create assignments for both classes
    assignmentIdClass1 = uuidv4();
    assignmentIdClass2 = uuidv4();

    await testPool.query(
      `INSERT INTO assignments (id, tenant_id, session_id, class_id, subject_id, created_by, title, type, due_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'Assignment for Class 8A', 'Written', '2026-12-31', 'ACTIVE', NOW(), NOW()),
              ($7, $2, $3, $8, $5, $6, 'Assignment for Class 8B', 'Written', '2026-12-31', 'ACTIVE', NOW(), NOW())`,
      [
        assignmentIdClass1,
        tenant.tenantId,
        sessionId,
        classId,
        subjectId,
        tenant.adminId,
        assignmentIdClass2,
        otherClassId,
      ],
    );

    // Create submissions
    await testPool.query(
      `INSERT INTO assignment_submissions (id, tenant_id, assignment_id, student_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'PENDING', NOW(), NOW()),
              ($5, $2, $6, $7, 'PENDING', NOW(), NOW())`,
      [
        uuidv4(),
        tenant.tenantId,
        assignmentIdClass1,
        studentId,
        uuidv4(),
        assignmentIdClass2,
        otherStudentId,
      ],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Admin: returns 200 with all assignments", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/assignments")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it("Student: returns only assignments for their class (security regression: class scoping)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/assignments")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    // Student should only see assignments for their class
    for (const assignment of res.body.data) {
      expect(assignment.classId).toBe(classId);
    }

    // Should not see assignments from other class
    const otherClassAssignment = res.body.data.find(
      (a: { id: string }) => a.id === assignmentIdClass2,
    );
    expect(otherClassAssignment).toBeUndefined();
  });

  it("supports filtering by classId", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/assignments?classId=${classId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    for (const assignment of res.body.data) {
      expect(assignment.classId).toBe(classId);
    }
  });

  it("supports filtering by status", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/assignments?status=ACTIVE")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    for (const assignment of res.body.data) {
      expect(assignment.status).toBe("ACTIVE");
    }
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get("/api/v1/assignments");
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/assignments/:id ──────────────────────────────────────────────
describe("GET /api/v1/assignments/:id", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let studentToken: string;
  let assignmentId: string;
  let otherClassAssignmentId: string;
  let studentId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    const sessionId = uuidv4();
    const batchId = uuidv4();
    const classId = uuidv4();
    const otherClassId = uuidv4();
    const subjectId = uuidv4();
    studentId = uuidv4();
    assignmentId = uuidv4();
    otherClassAssignmentId = uuidv4();

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
       VALUES ($1, $2, $3, $4, 'Class 8A', NOW(), NOW()),
              ($5, $2, $3, $4, 'Class 8B', NOW(), NOW())`,
      [classId, tenant.tenantId, batchId, sessionId, otherClassId],
    );

    await testPool.query(
      `INSERT INTO subjects (id, tenant_id, name, created_at, updated_at)
       VALUES ($1, $2, 'Mathematics', NOW(), NOW())`,
      [subjectId, tenant.tenantId],
    );

    await testPool.query(
      `INSERT INTO students (id, tenant_id, name, register_number, batch_id, class_id, status, created_at, updated_at)
       VALUES ($1, $2, 'Student A', 'S001', $3, $4, 'Active', NOW(), NOW())`,
      [studentId, tenant.tenantId, batchId, classId],
    );

    studentToken = await createStudentAndLogin(tenant, studentId);

    await testPool.query(
      `INSERT INTO assignments (id, tenant_id, session_id, class_id, subject_id, created_by, title, type, due_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'Test Assignment', 'Written', '2026-12-31', 'ACTIVE', NOW(), NOW()),
              ($7, $2, $3, $8, $5, $6, 'Other Class Assignment', 'Written', '2026-12-31', 'ACTIVE', NOW(), NOW())`,
      [
        assignmentId,
        tenant.tenantId,
        sessionId,
        classId,
        subjectId,
        tenant.adminId,
        otherClassAssignmentId,
        otherClassId,
      ],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Admin: returns 200 with assignment details", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/assignments/${assignmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: assignmentId,
      title: "Test Assignment",
      type: "Written",
      status: "ACTIVE",
    });
  });

  it("Student: can view assignment from their class", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/assignments/${assignmentId}`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(assignmentId);
  });

  it("returns 403 when Student tries to view assignment from different class (security regression)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/assignments/${otherClassAssignmentId}`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent assignment", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/assignments/${uuidv4()}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get(`/api/v1/assignments/${assignmentId}`);
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/v1/assignments/:id ──────────────────────────────────────────────
describe("PUT /api/v1/assignments/:id", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let classTeacherToken: string;
  let otherTeacherToken: string;
  let assignmentId: string;
  let classId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    const sessionId = uuidv4();
    const batchId = uuidv4();
    classId = uuidv4();
    const otherClassId = uuidv4();
    const subjectId = uuidv4();
    assignmentId = uuidv4();

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
       VALUES ($1, $2, $3, $4, 'Class 8A', NOW(), NOW()),
              ($5, $2, $3, $4, 'Class 8B', NOW(), NOW())`,
      [classId, tenant.tenantId, batchId, sessionId, otherClassId],
    );

    await testPool.query(
      `INSERT INTO subjects (id, tenant_id, name, created_at, updated_at)
       VALUES ($1, $2, 'Mathematics', NOW(), NOW())`,
      [subjectId, tenant.tenantId],
    );

    const ct = await createClassTeacherAndLogin(tenant, classId);
    classTeacherToken = ct.token;

    const otherCt = await createClassTeacherAndLogin(tenant, otherClassId);
    otherTeacherToken = otherCt.token;

    await testPool.query(
      `INSERT INTO assignments (id, tenant_id, session_id, class_id, subject_id, created_by, title, description, type, due_date, is_graded, max_marks, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'Original Title', 'Original desc', 'Written', '2026-12-31', true, 100, 'ACTIVE', NOW(), NOW())`,
      [
        assignmentId,
        tenant.tenantId,
        sessionId,
        classId,
        subjectId,
        ct.userId,
      ],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Teacher: updates own assignment successfully", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/assignments/${assignmentId}`)
      .set("Authorization", `Bearer ${classTeacherToken}`)
      .send({
        title: "Updated Title",
        description: "Updated description",
        maxMarks: 150,
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: assignmentId,
      title: "Updated Title",
      description: "Updated description",
      maxMarks: 150,
    });
  });

  it("Admin: can update any assignment", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/assignments/${assignmentId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Admin Updated" });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Admin Updated");
  });

  it("returns 403 when Teacher tries to update assignment from different class (security regression)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/assignments/${assignmentId}`)
      .set("Authorization", `Bearer ${otherTeacherToken}`)
      .send({ title: "Unauthorized update" });

    expect(res.status).toBe(403);
  });

  it("returns 400 when trying to update past due date", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/assignments/${assignmentId}`)
      .set("Authorization", `Bearer ${classTeacherToken}`)
      .send({ dueDate: "2020-01-01" }); // Past date

    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent assignment", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/assignments/${uuidv4()}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Update" });
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/assignments/${assignmentId}`)
      .send({ title: "No auth" });
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/v1/assignments/:id ───────────────────────────────────────────
describe("DELETE /api/v1/assignments/:id", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let classTeacherToken: string;
  let assignmentId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    const sessionId = uuidv4();
    const batchId = uuidv4();
    const classId = uuidv4();
    const subjectId = uuidv4();
    assignmentId = uuidv4();

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
      `INSERT INTO subjects (id, tenant_id, name, created_at, updated_at)
       VALUES ($1, $2, 'Mathematics', NOW(), NOW())`,
      [subjectId, tenant.tenantId],
    );

    const ct = await createClassTeacherAndLogin(tenant, classId);
    classTeacherToken = ct.token;

    await testPool.query(
      `INSERT INTO assignments (id, tenant_id, session_id, class_id, subject_id, created_by, title, type, due_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'To Delete', 'Written', '2026-12-31', 'ACTIVE', NOW(), NOW())`,
      [
        assignmentId,
        tenant.tenantId,
        sessionId,
        classId,
        subjectId,
        ct.userId,
      ],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Admin: soft deletes assignment (sets deleted_at, regression test)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete(`/api/v1/assignments/${assignmentId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    // Verify soft delete
    const result = await testPool.query(
      "SELECT deleted_at FROM assignments WHERE id = $1",
      [assignmentId],
    );
    expect(result.rows[0]!.deleted_at).not.toBeNull();
  });

  it("Teacher: can delete own assignment", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete(`/api/v1/assignments/${assignmentId}`)
      .set("Authorization", `Bearer ${classTeacherToken}`);

    expect(res.status).toBe(204);
  });

  it("returns 404 for non-existent assignment", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete(`/api/v1/assignments/${uuidv4()}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().delete(
      `/api/v1/assignments/${assignmentId}`,
    );
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/v1/assignments/:id/close ────────────────────────────────────────
describe("PUT /api/v1/assignments/:id/close", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let classTeacherToken: string;
  let assignmentId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    const sessionId = uuidv4();
    const batchId = uuidv4();
    const classId = uuidv4();
    const subjectId = uuidv4();
    assignmentId = uuidv4();

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
      `INSERT INTO subjects (id, tenant_id, name, created_at, updated_at)
       VALUES ($1, $2, 'Mathematics', NOW(), NOW())`,
      [subjectId, tenant.tenantId],
    );

    const ct = await createClassTeacherAndLogin(tenant, classId);
    classTeacherToken = ct.token;

    await testPool.query(
      `INSERT INTO assignments (id, tenant_id, session_id, class_id, subject_id, created_by, title, type, due_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'To Close', 'Written', '2026-12-31', 'ACTIVE', NOW(), NOW())`,
      [
        assignmentId,
        tenant.tenantId,
        sessionId,
        classId,
        subjectId,
        ct.userId,
      ],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Admin: closes assignment (status ACTIVE → CLOSED)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/assignments/${assignmentId}/close`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("CLOSED");
  });

  it("returns 403 for Teacher role (Admin only)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/assignments/${assignmentId}/close`)
      .set("Authorization", `Bearer ${classTeacherToken}`);

    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent assignment", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/assignments/${uuidv4()}/close`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().put(
      `/api/v1/assignments/${assignmentId}/close`,
    );
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/assignments/:id/submissions ──────────────────────────────────
describe("GET /api/v1/assignments/:id/submissions", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let classTeacherToken: string;
  let otherTeacherToken: string;
  let assignmentId: string;
  let studentId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    const sessionId = uuidv4();
    const batchId = uuidv4();
    const classId = uuidv4();
    const otherClassId = uuidv4();
    const subjectId = uuidv4();
    studentId = uuidv4();
    assignmentId = uuidv4();

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
       VALUES ($1, $2, $3, $4, 'Class 8A', NOW(), NOW()),
              ($5, $2, $3, $4, 'Class 8B', NOW(), NOW())`,
      [classId, tenant.tenantId, batchId, sessionId, otherClassId],
    );

    await testPool.query(
      `INSERT INTO subjects (id, tenant_id, name, created_at, updated_at)
       VALUES ($1, $2, 'Mathematics', NOW(), NOW())`,
      [subjectId, tenant.tenantId],
    );

    await testPool.query(
      `INSERT INTO students (id, tenant_id, name, register_number, batch_id, class_id, status, created_at, updated_at)
       VALUES ($1, $2, 'Student A', 'S001', $3, $4, 'Active', NOW(), NOW())`,
      [studentId, tenant.tenantId, batchId, classId],
    );

    const ct = await createClassTeacherAndLogin(tenant, classId);
    classTeacherToken = ct.token;

    const otherCt = await createClassTeacherAndLogin(tenant, otherClassId);
    otherTeacherToken = otherCt.token;

    await testPool.query(
      `INSERT INTO assignments (id, tenant_id, session_id, class_id, subject_id, created_by, title, type, due_date, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'Test Assignment', 'Written', '2026-12-31', 'ACTIVE', NOW(), NOW())`,
      [
        assignmentId,
        tenant.tenantId,
        sessionId,
        classId,
        subjectId,
        ct.userId,
      ],
    );

    // Create submission
    await testPool.query(
      `INSERT INTO assignment_submissions (id, tenant_id, assignment_id, student_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'PENDING', NOW(), NOW())`,
      [uuidv4(), tenant.tenantId, assignmentId, studentId],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Admin: returns marking sheet with all submissions", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/assignments/${assignmentId}/submissions`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("assignment");
    expect(res.body.data).toHaveProperty("submissions");
    expect(Array.isArray(res.body.data.submissions)).toBe(true);
    expect(res.body.data.submissions.length).toBeGreaterThanOrEqual(1);
  });

  it("Class Teacher: can view submissions for own class", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/assignments/${assignmentId}/submissions`)
      .set("Authorization", `Bearer ${classTeacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.submissions.length).toBeGreaterThanOrEqual(1);
  });

  it("returns 403 when Teacher tries to view submissions from different class (security regression)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/assignments/${assignmentId}/submissions`)
      .set("Authorization", `Bearer ${otherTeacherToken}`);

    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent assignment", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/assignments/${uuidv4()}/submissions`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get(
      `/api/v1/assignments/${assignmentId}/submissions`,
    );
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/v1/assignments/:id/submissions (bulk mark) ──────────────────────
describe("PUT /api/v1/assignments/:id/submissions", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let classTeacherToken: string;
  let assignmentId: string;
  let studentId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    const sessionId = uuidv4();
    const batchId = uuidv4();
    const classId = uuidv4();
    const subjectId = uuidv4();
    studentId = uuidv4();
    assignmentId = uuidv4();

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
      `INSERT INTO subjects (id, tenant_id, name, created_at, updated_at)
       VALUES ($1, $2, 'Mathematics', NOW(), NOW())`,
      [subjectId, tenant.tenantId],
    );

    await testPool.query(
      `INSERT INTO students (id, tenant_id, name, register_number, batch_id, class_id, status, created_at, updated_at)
       VALUES ($1, $2, 'Student A', 'S001', $3, $4, 'Active', NOW(), NOW())`,
      [studentId, tenant.tenantId, batchId, classId],
    );

    const ct = await createClassTeacherAndLogin(tenant, classId);
    classTeacherToken = ct.token;

    await testPool.query(
      `INSERT INTO assignments (id, tenant_id, session_id, class_id, subject_id, created_by, title, type, due_date, is_graded, max_marks, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'Test Assignment', 'Written', '2026-12-31', true, 100, 'ACTIVE', NOW(), NOW())`,
      [
        assignmentId,
        tenant.tenantId,
        sessionId,
        classId,
        subjectId,
        ct.userId,
      ],
    );

    await testPool.query(
      `INSERT INTO assignment_submissions (id, tenant_id, assignment_id, student_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'PENDING', NOW(), NOW())`,
      [uuidv4(), tenant.tenantId, assignmentId, studentId],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Teacher: marks submission with status, marks, and remarks (regression: all submission statuses)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/assignments/${assignmentId}/submissions`)
      .set("Authorization", `Bearer ${classTeacherToken}`)
      .send({
        submissions: [
          {
            studentId,
            status: "COMPLETED",
            marksObtained: 85,
            remark: "Good work",
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBeGreaterThanOrEqual(1);

    // Verify submission was updated
    const result = await testPool.query(
      `SELECT status, marks_obtained, remark, marked_by, marked_at
       FROM assignment_submissions
       WHERE assignment_id = $1 AND student_id = $2`,
      [assignmentId, studentId],
    );

    expect(result.rows[0]).toMatchObject({
      status: "COMPLETED",
      marks_obtained: "85.00",
      remark: "Good work",
    });
    expect(result.rows[0]!.marked_at).not.toBeNull();
  });

  it("supports INCOMPLETE and NOT_SUBMITTED statuses (regression: all statuses)", async () => {
    if (SKIP) return;

    // Test INCOMPLETE
    let res = await makeAgent()
      .put(`/api/v1/assignments/${assignmentId}/submissions`)
      .set("Authorization", `Bearer ${classTeacherToken}`)
      .send({
        submissions: [{ studentId, status: "INCOMPLETE", remark: "Missing part B" }],
      });
    expect(res.status).toBe(200);

    // Test NOT_SUBMITTED
    res = await makeAgent()
      .put(`/api/v1/assignments/${assignmentId}/submissions`)
      .set("Authorization", `Bearer ${classTeacherToken}`)
      .send({
        submissions: [{ studentId, status: "NOT_SUBMITTED" }],
      });
    expect(res.status).toBe(200);
  });

  it("Admin: can mark any submission", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/assignments/${assignmentId}/submissions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        submissions: [{ studentId, status: "COMPLETED", marksObtained: 90 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBeGreaterThanOrEqual(1);
  });

  it("returns 422 when required fields are missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/assignments/${assignmentId}/submissions`)
      .set("Authorization", `Bearer ${classTeacherToken}`)
      .send({ submissions: [{ studentId }] }); // Missing status

    expect(res.status).toBe(422);
  });

  it("returns 404 for non-existent assignment", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/assignments/${uuidv4()}/submissions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ submissions: [{ studentId, status: "COMPLETED" }] });
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/assignments/${assignmentId}/submissions`)
      .send({ submissions: [{ studentId, status: "COMPLETED" }] });
    expect(res.status).toBe(401);
  });
});
