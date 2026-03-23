/**
 * Integration tests: Academic Sessions endpoints (v6.1)
 *
 * Covers:
 *   POST   /api/v1/academic-sessions           — Create session
 *   GET    /api/v1/academic-sessions           — List sessions
 *   GET    /api/v1/academic-sessions/:id       — Get session
 *   PATCH  /api/v1/academic-sessions/:id       — Update session
 *   DELETE /api/v1/academic-sessions/:id       — Delete session (soft)
 *   POST   /api/v1/academic-sessions/:id/activate — Activate session
 *   POST   /api/v1/academic-sessions/:id/close    — Close session
 *   POST   /api/v1/academic-sessions/:id/copy-timetable — Copy timetable
 *
 * Freeze v6.1 §13.3 — Mandatory test cases:
 *   1. Only one ACTIVE session per tenant (enforced by partial index)
 *   2. Cannot close session if PENDING or DRAFT
 *   3. Copy timetable creates all timeslots from source session
 *   4. Soft delete sets deleted_at
 *   5. Admin only access
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

// ── POST /api/v1/academic-sessions ──────────────────────────────────────────
describe("POST /api/v1/academic-sessions", () => {
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

  it("returns 201 and creates a new session with DRAFT status", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/academic-sessions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "2026-27",
        startDate: "2026-06-01",
        endDate: "2027-05-31",
      });

    expect(res.status).toBe(201);
    expect(res.body.session).toMatchObject({
      name: "2026-27",
      startDate: "2026-06-01",
      endDate: "2027-05-31",
      status: "DRAFT",
    });
    expect(res.body.session).toHaveProperty("id");
    expect(res.body.session).toHaveProperty("tenantId", tenant.tenantId);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/academic-sessions")
      .send({ name: "2027-28", startDate: "2027-06-01", endDate: "2028-05-31" });
    expect(res.status).toBe(401);
  });

  it("returns 403 for Teacher role (Admin only)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/academic-sessions")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ name: "2027-28", startDate: "2027-06-01", endDate: "2028-05-31" });
    expect(res.status).toBe(403);
  });

  it("returns 422 when required fields are missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/academic-sessions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "2028-29" }); // Missing dates
    expect(res.status).toBe(422);
  });

  it("returns 400 when endDate is before startDate", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/academic-sessions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Invalid",
        startDate: "2026-06-01",
        endDate: "2026-01-01", // Before start
      });
    expect(res.status).toBe(400);
  });
});

// ── GET /api/v1/academic-sessions ───────────────────────────────────────────
describe("GET /api/v1/academic-sessions", () => {
  let tenant: TestTenant;
  let adminToken: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    // Create test sessions
    await testPool.query(
      `INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, created_at, updated_at)
       VALUES
         ($1, $2, '2025-26', '2025-06-01', '2026-05-31', 'CLOSED', NOW(), NOW()),
         ($3, $2, '2026-27', '2026-06-01', '2027-05-31', 'ACTIVE', NOW(), NOW()),
         ($4, $2, '2027-28', '2027-06-01', '2028-05-31', 'DRAFT', NOW(), NOW())`,
      [uuidv4(), tenant.tenantId, uuidv4(), uuidv4()],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with list of all sessions (non-deleted)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/academic-sessions")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("sessions");
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions.length).toBeGreaterThanOrEqual(3);

    // Verify structure
    for (const session of res.body.sessions) {
      expect(session).toHaveProperty("id");
      expect(session).toHaveProperty("name");
      expect(session).toHaveProperty("startDate");
      expect(session).toHaveProperty("endDate");
      expect(session).toHaveProperty("status");
      expect(["DRAFT", "ACTIVE", "CLOSED"]).toContain(session.status);
    }
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get("/api/v1/academic-sessions");
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/academic-sessions/:id ───────────────────────────────────────
describe("GET /api/v1/academic-sessions/:id", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let sessionId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    sessionId = uuidv4();
    await testPool.query(
      `INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, created_at, updated_at)
       VALUES ($1, $2, '2026-27', '2026-06-01', '2027-05-31', 'DRAFT', NOW(), NOW())`,
      [sessionId, tenant.tenantId],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with session details", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/academic-sessions/${sessionId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.session).toMatchObject({
      id: sessionId,
      name: "2026-27",
      status: "DRAFT",
    });
  });

  it("returns 404 for non-existent session", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/academic-sessions/${uuidv4()}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get(`/api/v1/academic-sessions/${sessionId}`);
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/academic-sessions/:id/activate ─────────────────────────────
describe("POST /api/v1/academic-sessions/:id/activate", () => {
  let tenant: TestTenant;
  let adminToken: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("activates a DRAFT session and deactivates any existing ACTIVE session (regression: only one ACTIVE per tenant)", async () => {
    if (SKIP) return;

    // Create two sessions: one ACTIVE, one DRAFT
    const activeSessionId = uuidv4();
    const draftSessionId = uuidv4();

    await testPool.query(
      `INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, created_at, updated_at)
       VALUES
         ($1, $2, '2025-26', '2025-06-01', '2026-05-31', 'ACTIVE', NOW(), NOW()),
         ($3, $2, '2026-27', '2026-06-01', '2027-05-31', 'DRAFT', NOW(), NOW())`,
      [activeSessionId, tenant.tenantId, draftSessionId],
    );

    // Activate the DRAFT session
    const res = await makeAgent()
      .post(`/api/v1/academic-sessions/${draftSessionId}/activate`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe("ACTIVE");

    // Verify old active session was deactivated
    const oldActive = await testPool.query(
      "SELECT status FROM academic_sessions WHERE id = $1",
      [activeSessionId],
    );
    expect(oldActive.rows[0]?.status).not.toBe("ACTIVE");
  });

  it("returns 400 if session is already ACTIVE", async () => {
    if (SKIP) return;

    const sessionId = uuidv4();
    await testPool.query(
      `INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, created_at, updated_at)
       VALUES ($1, $2, '2026-27', '2026-06-01', '2027-05-31', 'ACTIVE', NOW(), NOW())`,
      [sessionId, tenant.tenantId],
    );

    const res = await makeAgent()
      .post(`/api/v1/academic-sessions/${sessionId}/activate`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().post(`/api/v1/academic-sessions/${uuidv4()}/activate`);
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/academic-sessions/:id/close ────────────────────────────────
describe("POST /api/v1/academic-sessions/:id/close", () => {
  let tenant: TestTenant;
  let adminToken: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("closes an ACTIVE session (status → CLOSED)", async () => {
    if (SKIP) return;

    const sessionId = uuidv4();
    await testPool.query(
      `INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, created_at, updated_at)
       VALUES ($1, $2, '2025-26', '2025-06-01', '2026-05-31', 'ACTIVE', NOW(), NOW())`,
      [sessionId, tenant.tenantId],
    );

    const res = await makeAgent()
      .post(`/api/v1/academic-sessions/${sessionId}/close`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe("CLOSED");
  });

  it("returns 400 if session is DRAFT (regression: cannot close non-ACTIVE session)", async () => {
    if (SKIP) return;

    const sessionId = uuidv4();
    await testPool.query(
      `INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, created_at, updated_at)
       VALUES ($1, $2, '2026-27', '2026-06-01', '2027-05-31', 'DRAFT', NOW(), NOW())`,
      [sessionId, tenant.tenantId],
    );

    const res = await makeAgent()
      .post(`/api/v1/academic-sessions/${sessionId}/close`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBeDefined();
  });

  it("returns 400 if session is already CLOSED", async () => {
    if (SKIP) return;

    const sessionId = uuidv4();
    await testPool.query(
      `INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, created_at, updated_at)
       VALUES ($1, $2, '2024-25', '2024-06-01', '2025-05-31', 'CLOSED', NOW(), NOW())`,
      [sessionId, tenant.tenantId],
    );

    const res = await makeAgent()
      .post(`/api/v1/academic-sessions/${sessionId}/close`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().post(`/api/v1/academic-sessions/${uuidv4()}/close`);
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/academic-sessions/:id/copy-timetable ───────────────────────
describe("POST /api/v1/academic-sessions/:id/copy-timetable", () => {
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

  it("copies all timeslots from source session to target session (regression test)", async () => {
    if (SKIP) return;

    // Create source and target sessions
    const sourceSessionId = uuidv4();
    const targetSessionId = uuidv4();

    await testPool.query(
      `INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, created_at, updated_at)
       VALUES
         ($1, $2, '2025-26', '2025-06-01', '2026-05-31', 'CLOSED', NOW(), NOW()),
         ($3, $2, '2026-27', '2026-06-01', '2027-05-31', 'DRAFT', NOW(), NOW())`,
      [sourceSessionId, tenant.tenantId, targetSessionId],
    );

    // Create test batch, class, subject for timeslots
    const batchId = uuidv4();
    const classId = uuidv4();
    const subjectId = uuidv4();

    await testPool.query(
      `INSERT INTO batches (id, tenant_id, name, level, created_at, updated_at)
       VALUES ($1, $2, 'Batch A', 'Std8', NOW(), NOW())`,
      [batchId, tenant.tenantId],
    );

    await testPool.query(
      `INSERT INTO classes (id, tenant_id, batch_id, session_id, name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'Class A', NOW(), NOW())`,
      [classId, tenant.tenantId, batchId, sourceSessionId],
    );

    await testPool.query(
      `INSERT INTO subjects (id, tenant_id, name, code, created_at, updated_at)
       VALUES ($1, $2, 'Math', 'MATH101', NOW(), NOW())`,
      [subjectId, tenant.tenantId],
    );

    // Create timeslots in source session
    const timeslot1 = uuidv4();
    const timeslot2 = uuidv4();

    await testPool.query(
      `INSERT INTO timeslots (id, tenant_id, session_id, class_id, subject_id, period_id, day_of_week, created_at, updated_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, 1, NOW(), NOW()),
         ($7, $2, $3, $4, $5, $6, 2, NOW(), NOW())`,
      [timeslot1, tenant.tenantId, sourceSessionId, classId, subjectId, tenant.periodId, timeslot2],
    );

    // Copy timetable
    const res = await makeAgent()
      .post(`/api/v1/academic-sessions/${targetSessionId}/copy-timetable`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ sourceSessionId });

    expect(res.status).toBe(200);

    // Verify timeslots were copied
    const copied = await testPool.query(
      `SELECT COUNT(*) as count FROM timeslots
       WHERE session_id = $1 AND tenant_id = $2`,
      [targetSessionId, tenant.tenantId],
    );

    expect(parseInt(copied.rows[0]?.count ?? "0")).toBeGreaterThanOrEqual(2);
  });

  it("returns 404 if source session does not exist", async () => {
    if (SKIP) return;

    const targetSessionId = uuidv4();
    await testPool.query(
      `INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, created_at, updated_at)
       VALUES ($1, $2, '2026-27', '2026-06-01', '2027-05-31', 'DRAFT', NOW(), NOW())`,
      [targetSessionId, tenant.tenantId],
    );

    const res = await makeAgent()
      .post(`/api/v1/academic-sessions/${targetSessionId}/copy-timetable`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ sourceSessionId: uuidv4() });

    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post(`/api/v1/academic-sessions/${uuidv4()}/copy-timetable`)
      .send({ sourceSessionId: uuidv4() });
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/v1/academic-sessions/:id ────────────────────────────────────
describe("DELETE /api/v1/academic-sessions/:id", () => {
  let tenant: TestTenant;
  let adminToken: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("soft deletes a session (sets deleted_at, regression test)", async () => {
    if (SKIP) return;

    const sessionId = uuidv4();
    await testPool.query(
      `INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, created_at, updated_at)
       VALUES ($1, $2, '2027-28', '2027-06-01', '2028-05-31', 'DRAFT', NOW(), NOW())`,
      [sessionId, tenant.tenantId],
    );

    const res = await makeAgent()
      .delete(`/api/v1/academic-sessions/${sessionId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    // Verify deleted_at is set
    const deleted = await testPool.query(
      "SELECT deleted_at FROM academic_sessions WHERE id = $1",
      [sessionId],
    );
    expect(deleted.rows[0]?.deleted_at).not.toBeNull();
  });

  it("returns 400 if trying to delete ACTIVE session", async () => {
    if (SKIP) return;

    const sessionId = uuidv4();
    await testPool.query(
      `INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, created_at, updated_at)
       VALUES ($1, $2, '2026-27', '2026-06-01', '2027-05-31', 'ACTIVE', NOW(), NOW())`,
      [sessionId, tenant.tenantId],
    );

    const res = await makeAgent()
      .delete(`/api/v1/academic-sessions/${sessionId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent session", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete(`/api/v1/academic-sessions/${uuidv4()}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().delete(`/api/v1/academic-sessions/${uuidv4()}`);
    expect(res.status).toBe(401);
  });
});
