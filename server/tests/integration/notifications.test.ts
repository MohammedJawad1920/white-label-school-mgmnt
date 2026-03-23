/**
 * Integration tests: Notifications endpoints (v6.1)
 *
 * Covers:
 *   GET /api/v1/notifications          — List user's notifications
 *   PUT /api/v1/notifications/:id/read — Mark as read
 *   PUT /api/v1/notifications/read-all — Mark all as read
 *
 * Freeze v6.1 §13.3 — Mandatory test cases:
 *   1. User only sees their own notifications (filtered by user_id)
 *   2. Mark read sets read_at timestamp
 *   3. Mark all read updates all unread notifications for user
 *   4. Notifications are tenant-scoped (cannot see other tenant's notifications)
 *   5. Types: LEAVE_SUBMITTED, LEAVE_APPROVED, EXAM_PUBLISHED, FEE_CHARGED, ANNOUNCEMENT, ASSIGNMENT_CREATED
 *   6. Each notification includes type, title, body, data JSONB
 *   7. Pagination (limit/offset query params)
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

async function createStudentAndLogin(
  tenant: TestTenant,
): Promise<{ token: string; userId: string; studentId: string }> {
  const studentId = uuidv4();
  const userId = uuidv4();
  const studentEmail = `student-${uuidv4().slice(0, 8)}@test.local`;
  const studentPassword = "Student@Pass123";
  const hash = await bcrypt.hash(studentPassword, 10);

  // Create student user account
  await testPool.query(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, '["Student"]'::jsonb, NOW(), NOW())`,
    [userId, tenant.tenantId, "Test Student", studentEmail, hash],
  );

  // Create student record (minimal setup - no class required for notifications)
  const batchId = uuidv4();
  await testPool.query(
    `INSERT INTO batches (id, tenant_id, name, level, created_at, updated_at)
     VALUES ($1, $2, 'Batch A', 'Std8', NOW(), NOW())`,
    [batchId, tenant.tenantId],
  );

  await testPool.query(
    `INSERT INTO students (id, tenant_id, user_id, name, register_number, batch_id, created_at, updated_at)
     VALUES ($1, $2, $3, 'Test Student', 'S001', $4, NOW(), NOW())`,
    [studentId, tenant.tenantId, userId, batchId],
  );

  const res = await makeAgent().post("/api/v1/auth/login").send({
    email: studentEmail,
    password: studentPassword,
    tenantId: tenant.tenantId,
  });
  return { token: res.body.token as string, userId, studentId };
}

async function createTeacherAndLogin(
  tenant: TestTenant,
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

async function seedNotification(
  tenantId: string,
  userId: string,
  type: string,
  title: string,
  body: string,
  data: Record<string, unknown> | null = null,
  readAt: string | null = null,
): Promise<string> {
  const notificationId = uuidv4();
  await testPool.query(
    `INSERT INTO notifications (id, tenant_id, user_id, type, title, body, data, read_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    [
      notificationId,
      tenantId,
      userId,
      type,
      title,
      body,
      data ? JSON.stringify(data) : null,
      readAt,
    ],
  );
  return notificationId;
}

// ── GET /api/v1/notifications ────────────────────────────────────────────────
describe("GET /api/v1/notifications", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let studentToken: string;
  let studentUserId: string;
  let teacherToken: string;
  let teacherUserId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    const student = await createStudentAndLogin(tenant);
    studentToken = student.token;
    studentUserId = student.userId;

    const teacher = await createTeacherAndLogin(tenant);
    teacherToken = teacher.token;
    teacherUserId = teacher.userId;

    // Seed notifications for student (5 total: 3 unread, 2 read)
    await seedNotification(
      tenant.tenantId,
      studentUserId,
      "LEAVE_APPROVED",
      "Leave Approved",
      "Your leave request has been approved.",
      { leaveId: uuidv4() },
      null, // unread
    );
    await seedNotification(
      tenant.tenantId,
      studentUserId,
      "EXAM_PUBLISHED",
      "New Exam Published",
      "Results for Mid-term exam are now available.",
      { examId: uuidv4() },
      null, // unread
    );
    await seedNotification(
      tenant.tenantId,
      studentUserId,
      "FEE_CHARGED",
      "Fee Charged",
      "A new fee of Rs. 1000 has been charged to your account.",
      { feeChargeId: uuidv4(), amount: 1000 },
      null, // unread
    );
    await seedNotification(
      tenant.tenantId,
      studentUserId,
      "ANNOUNCEMENT",
      "School Holiday",
      "School will remain closed on 15th March.",
      { announcementId: uuidv4() },
      "2026-03-10T10:00:00Z", // read
    );
    await seedNotification(
      tenant.tenantId,
      studentUserId,
      "ASSIGNMENT_CREATED",
      "New Assignment",
      "Math homework assigned. Due date: 20th March.",
      { assignmentId: uuidv4() },
      "2026-03-11T12:00:00Z", // read
    );

    // Seed notifications for teacher (2 total: both unread)
    await seedNotification(
      tenant.tenantId,
      teacherUserId,
      "LEAVE_SUBMITTED",
      "Leave Request",
      "A new leave request has been submitted by Student A.",
      { leaveId: uuidv4() },
      null,
    );
    await seedNotification(
      tenant.tenantId,
      teacherUserId,
      "ABSENCE_ALERT",
      "Absence Alert",
      "Student B has been absent for 3 consecutive days.",
      { studentId: uuidv4() },
      null,
    );

    // Seed notification for admin (1 total)
    await seedNotification(
      tenant.tenantId,
      tenant.adminId,
      "ANNOUNCEMENT",
      "Admin Notice",
      "System maintenance scheduled for tonight.",
      null,
      null,
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with all notifications for the current user (Student)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(5);

    // All notifications should belong to this user
    for (const notification of res.body.data) {
      expect(notification).toHaveProperty("id");
      expect(notification).toHaveProperty("type");
      expect(notification).toHaveProperty("title");
      expect(notification).toHaveProperty("body");
      expect(notification).toHaveProperty("data");
      expect(notification).toHaveProperty("readAt");
      expect(notification).toHaveProperty("createdAt");
    }

    // Verify meta
    expect(res.body).toHaveProperty("meta");
    expect(res.body.meta.total).toBe(5);
    expect(res.body.meta.unreadCount).toBe(3);
  });

  it("returns 200 with only unread notifications when unreadOnly=true (Student)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/notifications?unreadOnly=true")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(3);

    // All returned notifications should be unread
    for (const notification of res.body.data) {
      expect(notification.readAt).toBeNull();
    }
  });

  it("returns 200 with paginated notifications (limit=2, offset=0)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/notifications?limit=2&offset=0")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.meta.total).toBe(5);
  });

  it("returns 200 with paginated notifications (limit=2, offset=2)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/notifications?limit=2&offset=2")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.meta.total).toBe(5);
  });

  it("Teacher: returns only teacher's notifications (security test: user isolation)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.meta.unreadCount).toBe(2);
  });

  it("Admin: returns only admin's notifications (security test: user isolation)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.meta.unreadCount).toBe(1);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get("/api/v1/notifications");
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/notifications (tenant isolation) ────────────────────────────
describe("GET /api/v1/notifications — tenant isolation", () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let studentAToken: string;
  let studentAUserId: string;
  let studentBToken: string;

  beforeAll(async () => {
    if (SKIP) return;

    // Create two separate tenants
    tenantA = await createTestTenant();
    tenantB = await createTestTenant();

    // Create student in tenant A
    const studentA = await createStudentAndLogin(tenantA);
    studentAToken = studentA.token;
    studentAUserId = studentA.userId;

    // Create student in tenant B
    const studentB = await createStudentAndLogin(tenantB);
    studentBToken = studentB.token;

    // Seed notification for tenant A student
    await seedNotification(
      tenantA.tenantId,
      studentAUserId,
      "ANNOUNCEMENT",
      "Tenant A Announcement",
      "This is for tenant A only.",
      null,
      null,
    );

    // Seed notification for tenant B student
    await seedNotification(
      tenantB.tenantId,
      studentB.userId,
      "ANNOUNCEMENT",
      "Tenant B Announcement",
      "This is for tenant B only.",
      null,
      null,
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenantA.tenantId);
    await cleanupTenant(tenantB.tenantId);
  });

  it("Student in Tenant A cannot see Tenant B's notifications (security: tenant isolation)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${studentAToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);

    const notification = res.body.data[0];
    expect(notification.title).toBe("Tenant A Announcement");
    expect(notification.body).toBe("This is for tenant A only.");
  });

  it("Student in Tenant B cannot see Tenant A's notifications (security: tenant isolation)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${studentBToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);

    const notification = res.body.data[0];
    expect(notification.title).toBe("Tenant B Announcement");
    expect(notification.body).toBe("This is for tenant B only.");
  });
});

// ── PUT /api/v1/notifications/:id/read ──────────────────────────────────────
describe("PUT /api/v1/notifications/:id/read", () => {
  let tenant: TestTenant;
  let studentToken: string;
  let studentUserId: string;
  let notificationId: string;
  let otherUserNotificationId: string;
  let teacherToken: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();

    const student = await createStudentAndLogin(tenant);
    studentToken = student.token;
    studentUserId = student.userId;

    const teacher = await createTeacherAndLogin(tenant);
    teacherToken = teacher.token;

    // Seed an unread notification for the student
    notificationId = await seedNotification(
      tenant.tenantId,
      studentUserId,
      "EXAM_PUBLISHED",
      "Exam Results",
      "Your exam results are available.",
      { examId: uuidv4() },
      null, // unread
    );

    // Seed a notification for teacher (to test security)
    otherUserNotificationId = await seedNotification(
      tenant.tenantId,
      teacher.userId,
      "LEAVE_SUBMITTED",
      "Leave Request",
      "New leave request submitted.",
      null,
      null,
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 and marks notification as read (sets read_at timestamp)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("id", notificationId);
    expect(res.body.data).toHaveProperty("readAt");
    expect(res.body.data.readAt).not.toBeNull();

    // Verify in database
    const dbCheck = await testPool.query(
      "SELECT read_at FROM notifications WHERE id = $1",
      [notificationId],
    );
    expect(dbCheck.rows[0]?.read_at).not.toBeNull();
  });

  it("returns 200 when marking an already-read notification (idempotent)", async () => {
    if (SKIP) return;

    // Mark as read first time
    await makeAgent()
      .put(`/api/v1/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${studentToken}`);

    // Mark as read second time
    const res = await makeAgent()
      .put(`/api/v1/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.readAt).not.toBeNull();
  });

  it("returns 404 when trying to mark another user's notification as read (security: user isolation)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/notifications/${otherUserNotificationId}/read`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent notification ID", async () => {
    if (SKIP) return;
    const fakeId = uuidv4();
    const res = await makeAgent()
      .put(`/api/v1/notifications/${fakeId}/read`)
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().put(
      `/api/v1/notifications/${notificationId}/read`,
    );
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/v1/notifications/read-all ──────────────────────────────────────
describe("PUT /api/v1/notifications/read-all", () => {
  let tenant: TestTenant;
  let studentToken: string;
  let studentUserId: string;
  let teacherToken: string;
  let teacherUserId: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();

    const student = await createStudentAndLogin(tenant);
    studentToken = student.token;
    studentUserId = student.userId;

    const teacher = await createTeacherAndLogin(tenant);
    teacherToken = teacher.token;
    teacherUserId = teacher.userId;

    // Seed 3 unread notifications for student
    await seedNotification(
      tenant.tenantId,
      studentUserId,
      "EXAM_PUBLISHED",
      "Exam 1",
      "Exam 1 results published.",
      null,
      null,
    );
    await seedNotification(
      tenant.tenantId,
      studentUserId,
      "FEE_CHARGED",
      "Fee 1",
      "Fee charged.",
      null,
      null,
    );
    await seedNotification(
      tenant.tenantId,
      studentUserId,
      "ANNOUNCEMENT",
      "Notice 1",
      "Important notice.",
      null,
      null,
    );

    // Seed 1 already-read notification for student (should not be updated)
    await seedNotification(
      tenant.tenantId,
      studentUserId,
      "ANNOUNCEMENT",
      "Old Notice",
      "Already read.",
      null,
      "2026-03-01T10:00:00Z",
    );

    // Seed 2 unread notifications for teacher (should not be affected by student's mark-all)
    await seedNotification(
      tenant.tenantId,
      teacherUserId,
      "LEAVE_SUBMITTED",
      "Leave 1",
      "Leave request 1.",
      null,
      null,
    );
    await seedNotification(
      tenant.tenantId,
      teacherUserId,
      "LEAVE_SUBMITTED",
      "Leave 2",
      "Leave request 2.",
      null,
      null,
    );
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 and marks all unread notifications as read for current user (Student)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put("/api/v1/notifications/read-all")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("updated");
    expect(res.body.data.updated).toBe(3); // 3 unread notifications

    // Verify all student's notifications are now read
    const dbCheck = await testPool.query(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read_at IS NULL",
      [studentUserId],
    );
    expect(parseInt(dbCheck.rows[0]?.count ?? "0", 10)).toBe(0);
  });

  it("does not affect other users' notifications (Teacher's notifications remain unread)", async () => {
    if (SKIP) return;
    // Student marks all as read
    await makeAgent()
      .put("/api/v1/notifications/read-all")
      .set("Authorization", `Bearer ${studentToken}`);

    // Check teacher's notifications are still unread
    const teacherUnreadCheck = await testPool.query(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read_at IS NULL",
      [teacherUserId],
    );
    expect(parseInt(teacherUnreadCheck.rows[0]?.count ?? "0", 10)).toBe(2);
  });

  it("returns 200 with updated=0 when user has no unread notifications (idempotent)", async () => {
    if (SKIP) return;

    // Mark all as read first time
    await makeAgent()
      .put("/api/v1/notifications/read-all")
      .set("Authorization", `Bearer ${studentToken}`);

    // Mark all as read second time
    const res = await makeAgent()
      .put("/api/v1/notifications/read-all")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(0);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().put("/api/v1/notifications/read-all");
    expect(res.status).toBe(401);
  });
});

// ── Notification types ──────────────────────────────────────────────────────
describe("Notification types validation", () => {
  let tenant: TestTenant;
  let studentToken: string;
  let studentUserId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();

    const student = await createStudentAndLogin(tenant);
    studentToken = student.token;
    studentUserId = student.userId;

    // Seed notifications with different types per Freeze v6.1
    const types = [
      "LEAVE_SUBMITTED",
      "LEAVE_APPROVED",
      "LEAVE_REJECTED",
      "STUDENT_DEPARTED",
      "STUDENT_RETURNED",
      "LEAVE_OVERDUE",
      "ABSENCE_ALERT",
      "EXAM_PUBLISHED",
      "ASSIGNMENT_CREATED",
      "ANNOUNCEMENT",
      "FEE_CHARGED",
    ];

    for (const type of types) {
      await seedNotification(
        tenant.tenantId,
        studentUserId,
        type,
        `Test ${type}`,
        `Test notification body for ${type}.`,
        { testData: type },
        null,
      );
    }
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with all notification types (11 types per Freeze v6.1)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(11);

    const types = res.body.data.map((n: { type: string }) => n.type);
    expect(types).toContain("LEAVE_SUBMITTED");
    expect(types).toContain("LEAVE_APPROVED");
    expect(types).toContain("LEAVE_REJECTED");
    expect(types).toContain("STUDENT_DEPARTED");
    expect(types).toContain("STUDENT_RETURNED");
    expect(types).toContain("LEAVE_OVERDUE");
    expect(types).toContain("ABSENCE_ALERT");
    expect(types).toContain("EXAM_PUBLISHED");
    expect(types).toContain("ASSIGNMENT_CREATED");
    expect(types).toContain("ANNOUNCEMENT");
    expect(types).toContain("FEE_CHARGED");
  });

  it("each notification includes type, title, body, data JSONB", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${studentToken}`);

    expect(res.status).toBe(200);

    for (const notification of res.body.data) {
      expect(notification).toHaveProperty("type");
      expect(typeof notification.type).toBe("string");

      expect(notification).toHaveProperty("title");
      expect(typeof notification.title).toBe("string");

      expect(notification).toHaveProperty("body");
      expect(typeof notification.body).toBe("string");

      expect(notification).toHaveProperty("data");
      // data can be object or null
      if (notification.data !== null) {
        expect(typeof notification.data).toBe("object");
      }

      expect(notification).toHaveProperty("readAt");
      expect(notification).toHaveProperty("createdAt");
    }
  });
});
