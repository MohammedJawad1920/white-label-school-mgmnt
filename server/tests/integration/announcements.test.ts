/**
 * Integration tests: Announcements endpoints (v6.1)
 *
 * Covers:
 *   POST   /api/v1/announcements     — Create announcement
 *   GET    /api/v1/announcements     — List announcements
 *   GET    /api/v1/announcements/:id — Get announcement
 *   PUT    /api/v1/announcements/:id — Update announcement
 *   DELETE /api/v1/announcements/:id — Delete announcement
 *
 * Freeze v6.1 §13.3 — Mandatory test cases:
 *   1. Audience targeting: All, Class, Batch, StudentsOnly, TeachersOnly, GuardiansOnly
 *   2. Optional link_url and link_text fields
 *   3. Teacher can create announcements (Class audience only, own class)
 *   4. Students/Guardians can only read (403 on POST/PUT/DELETE)
 *   5. Admin can CRUD all announcements
 *   6. Hard delete (no deleted_at — regression test)
 *   7. List endpoint filters by audience (Student sees only their batches/classes)
 *   8. Creator can update before publish_at, Admin can update any
 *   9. Created by tracking (created_by field)
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
  classId?: string,
): Promise<{ token: string; userId: string; classId?: string }> {
  const teacherId = uuidv4();
  const teacherEmail = `teacher-${uuidv4().slice(0, 8)}@test.local`;
  const teacherPassword = "Teacher@Pass123";
  const hash = await bcrypt.hash(teacherPassword, 10);

  await testPool.query(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, class_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, '["Teacher"]'::jsonb, $6, NOW(), NOW())`,
    [teacherId, tenant.tenantId, "Test Teacher", teacherEmail, hash, classId ?? null],
  );

  const res = await makeAgent().post("/api/v1/auth/login").send({
    email: teacherEmail,
    password: teacherPassword,
    tenantId: tenant.tenantId,
  });
  return { token: res.body.token as string, userId: teacherId, classId };
}

async function createStudentAndLogin(
  tenant: TestTenant,
  batchId: string,
  classId: string,
): Promise<{ token: string; userId: string; studentId: string }> {
  const studentId = uuidv4();
  const studentUserId = uuidv4();
  const studentEmail = `student-${uuidv4().slice(0, 8)}@test.local`;
  const studentPassword = "Student@Pass123";
  const hash = await bcrypt.hash(studentPassword, 10);

  // Create student record
  await testPool.query(
    `INSERT INTO students (id, tenant_id, name, register_number, batch_id, class_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
    [studentId, tenant.tenantId, "Test Student", "STU001", batchId, classId],
  );

  // Create user account for student
  await testPool.query(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, student_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, '["Student"]'::jsonb, $6, NOW(), NOW())`,
    [studentUserId, tenant.tenantId, "Test Student", studentEmail, hash, studentId],
  );

  const res = await makeAgent().post("/api/v1/auth/login").send({
    email: studentEmail,
    password: studentPassword,
    tenantId: tenant.tenantId,
  });
  return { token: res.body.token as string, userId: studentUserId, studentId };
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

// ── POST /api/v1/announcements ───────────────────────────────────────────────
describe("POST /api/v1/announcements", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
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

    // Create class teacher for classId
    const teacher = await createTeacherAndLogin(tenant, classId);
    teacherToken = teacher.token;

    // Create student
    const student = await createStudentAndLogin(tenant, batchId, classId);
    studentToken = student.token;
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Admin: creates announcement with audienceType=All", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/announcements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "School Holiday",
        body: "School will be closed tomorrow.",
        audienceType: "All",
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: "School Holiday",
      body: "School will be closed tomorrow.",
      audienceType: "All",
      sessionId,
    });
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data.linkUrl).toBeNull();
    expect(res.body.data.linkLabel).toBeNull();
  });

  it("Admin: creates announcement with optional link_url and link_label", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/announcements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Exam Schedule",
        body: "Check the exam schedule.",
        audienceType: "StudentsOnly",
        linkUrl: "https://example.com/schedule",
        linkLabel: "View Schedule",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.linkUrl).toBe("https://example.com/schedule");
    expect(res.body.data.linkLabel).toBe("View Schedule");
  });

  it("Admin: creates announcement with audienceType=Class and audienceClassId", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/announcements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Class Meeting",
        body: "Class 8A meeting tomorrow.",
        audienceType: "Class",
        audienceClassId: classId,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.audienceType).toBe("Class");
    expect(res.body.data.audienceClassId).toBe(classId);
  });

  it("Teacher: creates announcement with audienceType=Class for own class", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/announcements")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "Homework Reminder",
        body: "Submit homework by Friday.",
        audienceType: "Class",
        audienceClassId: classId,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.audienceType).toBe("Class");
    expect(res.body.data.audienceClassId).toBe(classId);
  });

  it("returns 403 when Teacher tries to create announcement with audienceType other than Class", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/announcements")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "General Announcement",
        body: "Test",
        audienceType: "All",
      });

    expect(res.status).toBe(403);
  });

  it("returns 403 when Teacher tries to create announcement for different class", async () => {
    if (SKIP) return;

    // Create another class
    const otherClassId = uuidv4();
    const sessionId = (await testPool.query(`SELECT id FROM academic_sessions WHERE tenant_id = $1 LIMIT 1`, [tenant.tenantId])).rows[0]!.id;
    const batchId = (await testPool.query(`SELECT id FROM batches WHERE tenant_id = $1 LIMIT 1`, [tenant.tenantId])).rows[0]!.id;
    await testPool.query(
      `INSERT INTO classes (id, tenant_id, batch_id, session_id, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Class 8B', NOW(), NOW())`,
      [otherClassId, tenant.tenantId, batchId, sessionId],
    );

    const res = await makeAgent()
      .post("/api/v1/announcements")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "Test",
        body: "Test",
        audienceType: "Class",
        audienceClassId: otherClassId,
      });

    expect(res.status).toBe(403);
  });

  it("returns 403 when Student tries to create announcement", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/announcements")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        title: "Test",
        body: "Test",
        audienceType: "All",
      });

    expect(res.status).toBe(403);
  });

  it("returns 422 when required fields are missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/announcements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Test",
        // Missing body and audienceType
      });

    expect(res.status).toBe(422);
  });

  it("returns 400 when audienceClassId is invalid", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/announcements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Test",
        body: "Test",
        audienceType: "Class",
        audienceClassId: uuidv4(), // Non-existent class
      });

    expect(res.status).toBe(400);
  });

  it("Admin: creates announcement with audienceType=Batch and audienceBatchId", async () => {
    if (SKIP) return;
    const batchId = (await testPool.query(`SELECT id FROM batches WHERE tenant_id = $1 LIMIT 1`, [tenant.tenantId])).rows[0]!.id;

    const res = await makeAgent()
      .post("/api/v1/announcements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Batch Announcement",
        body: "For Batch A",
        audienceType: "Batch",
        audienceBatchId: batchId,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.audienceType).toBe("Batch");
    expect(res.body.data.audienceBatchId).toBe(batchId);
  });

  it("returns 400 when audienceBatchId is invalid", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/announcements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Test",
        body: "Test",
        audienceType: "Batch",
        audienceBatchId: uuidv4(), // Non-existent batch
      });

    expect(res.status).toBe(400);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/announcements")
      .send({
        title: "Test",
        body: "Test",
        audienceType: "All",
      });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/announcements ────────────────────────────────────────────────
describe("GET /api/v1/announcements", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  let guardianToken: string;
  let sessionId: string;
  let classId: string;
  let batchId: string;
  let studentId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

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

    // Create teacher, student, guardian
    const teacher = await createTeacherAndLogin(tenant, classId);
    teacherToken = teacher.token;

    const student = await createStudentAndLogin(tenant, batchId, classId);
    studentToken = student.token;
    studentId = student.studentId;

    const guardian = await createGuardianAndLogin(tenant, studentId);
    guardianToken = guardian.token;

    // Create test announcements
    await testPool.query(
      `INSERT INTO announcements (id, tenant_id, session_id, title, body, audience_type, created_by, created_by_role, publish_at, created_at, updated_at)
       VALUES
         ($1, $2, $3, 'All Announcement', 'For everyone', 'All', $4, 'Admin', NOW() - INTERVAL '1 hour', NOW(), NOW()),
         ($5, $2, $3, 'Teachers Only', 'For teachers', 'TeachersOnly', $4, 'Admin', NOW() - INTERVAL '1 hour', NOW(), NOW()),
         ($6, $2, $3, 'Students Only', 'For students', 'StudentsOnly', $4, 'Admin', NOW() - INTERVAL '1 hour', NOW(), NOW()),
         ($7, $2, $3, 'Guardians Only', 'For guardians', 'GuardiansOnly', $4, 'Admin', NOW() - INTERVAL '1 hour', NOW(), NOW()),
         ($8, $2, $3, 'Class 8A', 'For Class 8A', 'Class', $4, 'Admin', NOW() - INTERVAL '1 hour', NOW(), NOW()),
         ($9, $2, $3, 'Batch A', 'For Batch A', 'Batch', $4, 'Admin', NOW() - INTERVAL '1 hour', NOW(), NOW()),
         ($10, $2, $3, 'Future Announcement', 'Not published yet', 'All', $4, 'Admin', NOW() + INTERVAL '1 day', NOW(), NOW())`,
      [
        uuidv4(), tenant.tenantId, sessionId, tenant.adminId,
        uuidv4(),
        uuidv4(),
        uuidv4(),
        uuidv4(),
        uuidv4(),
        uuidv4(),
      ],
    );

    // Update class and batch audience IDs
    await testPool.query(
      `UPDATE announcements SET audience_class_id = $1 WHERE title = 'Class 8A' AND tenant_id = $2`,
      [classId, tenant.tenantId],
    );
    await testPool.query(
      `UPDATE announcements SET audience_batch_id = $1 WHERE title = 'Batch A' AND tenant_id = $2`,
      [batchId, tenant.tenantId],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Admin: returns all published announcements", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/announcements")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);

    // Should get 6 published announcements (future one excluded)
    expect(res.body.data.length).toBe(6);

    const titles = res.body.data.map((a: { title: string }) => a.title);
    expect(titles).toContain("All Announcement");
    expect(titles).toContain("Teachers Only");
    expect(titles).toContain("Students Only");
    expect(titles).toContain("Guardians Only");
    expect(titles).toContain("Class 8A");
    expect(titles).toContain("Batch A");
    expect(titles).not.toContain("Future Announcement");
  });

  it("Teacher: returns All, TeachersOnly, and own Class announcements", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/announcements")
      .set("Authorization", `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const titles = res.body.data.map((a: { title: string }) => a.title);
    expect(titles).toContain("All Announcement");
    expect(titles).toContain("Teachers Only");
    expect(titles).toContain("Class 8A");

    // Should NOT see Students/Guardians only or Batch
    expect(titles).not.toContain("Students Only");
    expect(titles).not.toContain("Guardians Only");
    expect(titles).not.toContain("Batch A");
  });

  it("Student: returns All, StudentsOnly, and own Class/Batch announcements", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/announcements")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const titles = res.body.data.map((a: { title: string }) => a.title);
    expect(titles).toContain("All Announcement");
    expect(titles).toContain("Students Only");
    expect(titles).toContain("Class 8A");
    expect(titles).toContain("Batch A");

    // Should NOT see Teachers/Guardians only
    expect(titles).not.toContain("Teachers Only");
    expect(titles).not.toContain("Guardians Only");
  });

  it("Guardian: returns All, GuardiansOnly, and children's Class/Batch announcements", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/announcements")
      .set("Authorization", `Bearer ${guardianToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const titles = res.body.data.map((a: { title: string }) => a.title);
    expect(titles).toContain("All Announcement");
    expect(titles).toContain("Guardians Only");
    expect(titles).toContain("Class 8A");
    expect(titles).toContain("Batch A");

    // Should NOT see Teachers/Students only
    expect(titles).not.toContain("Teachers Only");
    expect(titles).not.toContain("Students Only");
  });

  it("does not return future announcements (publish_at > NOW())", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/announcements")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const titles = res.body.data.map((a: { title: string }) => a.title);
    expect(titles).not.toContain("Future Announcement");
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get("/api/v1/announcements");
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/announcements/:id ────────────────────────────────────────────
describe("GET /api/v1/announcements/:id", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let studentToken: string;
  let announcementAllId: string;
  let announcementTeachersOnlyId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create session, batch, class, student
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

    const student = await createStudentAndLogin(tenant, batchId, classId);
    studentToken = student.token;

    // Create announcements
    announcementAllId = uuidv4();
    announcementTeachersOnlyId = uuidv4();

    await testPool.query(
      `INSERT INTO announcements (id, tenant_id, session_id, title, body, audience_type, created_by, created_by_role, publish_at, created_at, updated_at)
       VALUES
         ($1, $2, $3, 'All Announcement', 'For everyone', 'All', $4, 'Admin', NOW() - INTERVAL '1 hour', NOW(), NOW()),
         ($5, $2, $3, 'Teachers Only', 'For teachers', 'TeachersOnly', $4, 'Admin', NOW() - INTERVAL '1 hour', NOW(), NOW())`,
      [announcementAllId, tenant.tenantId, sessionId, tenant.adminId, announcementTeachersOnlyId],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with announcement when user is in audience", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/announcements/${announcementAllId}`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(announcementAllId);
    expect(res.body.data.title).toBe("All Announcement");
  });

  it("returns 403 when user is not in audience (regression: Student accessing TeachersOnly)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/announcements/${announcementTeachersOnlyId}`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent announcement", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/announcements/${uuidv4()}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get(`/api/v1/announcements/${announcementAllId}`);
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/v1/announcements/:id ────────────────────────────────────────────
describe("PUT /api/v1/announcements/:id", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  let teacherUserId: string;
  let announcementId: string;
  let adminAnnouncementId: string;

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

    const teacher = await createTeacherAndLogin(tenant, classId);
    teacherToken = teacher.token;
    teacherUserId = teacher.userId;

    const student = await createStudentAndLogin(tenant, batchId, classId);
    studentToken = student.token;

    // Create announcement by teacher (future publish_at so it can be updated)
    announcementId = uuidv4();
    await testPool.query(
      `INSERT INTO announcements (id, tenant_id, session_id, title, body, audience_type, audience_class_id, created_by, created_by_role, publish_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'Original Title', 'Original Body', 'Class', $4, $5, 'Teacher', NOW() + INTERVAL '1 hour', NOW(), NOW())`,
      [announcementId, tenant.tenantId, sessionId, classId, teacherUserId],
    );

    // Create announcement by admin
    adminAnnouncementId = uuidv4();
    await testPool.query(
      `INSERT INTO announcements (id, tenant_id, session_id, title, body, audience_type, created_by, created_by_role, publish_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'Admin Title', 'Admin Body', 'All', $4, 'Admin', NOW() + INTERVAL '1 hour', NOW(), NOW())`,
      [adminAnnouncementId, tenant.tenantId, sessionId, tenant.adminId],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Creator (Teacher): updates own announcement before publish_at", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/announcements/${announcementId}`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        title: "Updated Title",
        body: "Updated Body",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Updated Title");
    expect(res.body.data.body).toBe("Updated Body");
  });

  it("Admin: can update any announcement", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/announcements/${announcementId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Admin Updated",
        body: "Admin Updated Body",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Admin Updated");
  });

  it("returns 403 when non-creator non-admin tries to update", async () => {
    if (SKIP) return;

    // Create another teacher
    const otherTeacher = await createTeacherAndLogin(tenant);

    const res = await makeAgent()
      .put(`/api/v1/announcements/${announcementId}`)
      .set("Authorization", `Bearer ${otherTeacher.token}`)
      .send({
        title: "Unauthorized Update",
        body: "Should fail",
      });

    expect(res.status).toBe(403);
  });

  it("returns 403 when Student tries to update", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/announcements/${announcementId}`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        title: "Student Update",
        body: "Should fail",
      });

    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent announcement", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/announcements/${uuidv4()}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Test",
        body: "Test",
      });
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/announcements/${announcementId}`)
      .send({
        title: "Test",
        body: "Test",
      });
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/v1/announcements/:id ─────────────────────────────────────────
describe("DELETE /api/v1/announcements/:id", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  let teacherUserId: string;
  let announcementId: string;
  let adminAnnouncementId: string;

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

    const teacher = await createTeacherAndLogin(tenant, classId);
    teacherToken = teacher.token;
    teacherUserId = teacher.userId;

    const student = await createStudentAndLogin(tenant, batchId, classId);
    studentToken = student.token;

    // Create announcement by teacher
    announcementId = uuidv4();
    await testPool.query(
      `INSERT INTO announcements (id, tenant_id, session_id, title, body, audience_type, audience_class_id, created_by, created_by_role, publish_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'Teacher Announcement', 'Body', 'Class', $4, $5, 'Teacher', NOW() + INTERVAL '1 hour', NOW(), NOW())`,
      [announcementId, tenant.tenantId, sessionId, classId, teacherUserId],
    );

    // Create announcement by admin
    adminAnnouncementId = uuidv4();
    await testPool.query(
      `INSERT INTO announcements (id, tenant_id, session_id, title, body, audience_type, created_by, created_by_role, publish_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'Admin Announcement', 'Body', 'All', $4, 'Admin', NOW() + INTERVAL '1 hour', NOW(), NOW())`,
      [adminAnnouncementId, tenant.tenantId, sessionId, tenant.adminId],
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Creator (Teacher): deletes own announcement (hard delete, no deleted_at)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete(`/api/v1/announcements/${announcementId}`)
      .set("Authorization", `Bearer ${teacherToken}`);

    expect(res.status).toBe(204);

    // Verify hard delete (row should not exist)
    const check = await testPool.query(
      "SELECT * FROM announcements WHERE id = $1",
      [announcementId],
    );
    expect(check.rowCount).toBe(0);
  });

  it("Admin: can delete any announcement", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete(`/api/v1/announcements/${announcementId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    // Verify hard delete
    const check = await testPool.query(
      "SELECT * FROM announcements WHERE id = $1",
      [announcementId],
    );
    expect(check.rowCount).toBe(0);
  });

  it("returns 403 when non-creator non-admin tries to delete", async () => {
    if (SKIP) return;

    // Create another teacher
    const otherTeacher = await createTeacherAndLogin(tenant);

    const res = await makeAgent()
      .delete(`/api/v1/announcements/${announcementId}`)
      .set("Authorization", `Bearer ${otherTeacher.token}`);

    expect(res.status).toBe(403);

    // Verify not deleted
    const check = await testPool.query(
      "SELECT * FROM announcements WHERE id = $1",
      [announcementId],
    );
    expect(check.rowCount).toBe(1);
  });

  it("returns 403 when Student tries to delete", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete(`/api/v1/announcements/${announcementId}`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent announcement", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete(`/api/v1/announcements/${uuidv4()}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().delete(`/api/v1/announcements/${announcementId}`);
    expect(res.status).toBe(401);
  });
});
