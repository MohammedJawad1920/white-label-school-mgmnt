/**
 * Integration tests: Timetable endpoints (v3.3)
 *
 * Covers:
 *   GET  /api/timetable        — list timeslots (feature-guarded)
 *   POST /api/timetable        — create timeslot; rejects startTime/endTime (v3.3)
 *   PUT  /api/timetable/:id/end — set effectiveTo (versioning pattern)
 *
 * FREEZE INVARIANTS:
 *   - Feature guard: requires timetable feature enabled
 *   - POST: no startTime/endTime in body (VALIDATION_ERROR)
 *   - PERIOD_NOT_CONFIGURED when periodNumber not in school_periods
 *   - Timeslots versioned; effectiveTo terminates current assignment
 */
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import {
  makeAgent,
  createTestTenant,
  cleanupTenant,
  skipIfNoDb,
  type TestTenant,
} from "./helpers/db";

const SKIP = skipIfNoDb();

async function loginAsAdmin(tenant: TestTenant): Promise<string> {
  const res = await makeAgent().post("/api/auth/login").send({
    email: tenant.adminEmail,
    password: tenant.adminPassword,
    tenantSlug: tenant.tenantSlug,
  });
  return res.body.token as string;
}

/**
 * Scaffolds a subject + teacher + batch + class via API.
 * Returns all IDs needed to POST /api/timetable.
 */
async function scaffoldTimetableData(token: string) {
  const suffix = Date.now();

  const [subjectRes, teacherRes, batchRes] = await Promise.all([
    makeAgent()
      .post("/api/subjects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Subject-${suffix}` }),
    makeAgent()
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `Teacher-${suffix}`,
        email: `teacher-tt-${suffix}@test.local`,
        password: "Teacher@Pass1",
        roles: ["Teacher"],
      }),
    makeAgent()
      .post("/api/batches")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: `Batch-${suffix}`, startYear: 2024, endYear: 2025 }),
  ]);

  const batchId = batchRes.body.batch.id as string;
  const classRes = await makeAgent()
    .post("/api/classes")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: `Class-${suffix}`, batchId });

  return {
    subjectId: subjectRes.body.subject.id as string,
    teacherId: teacherRes.body.user.id as string,
    classId: classRes.body.class.id as string,
  };
}

describe("GET /api/timetable (feature guarded)", () => {
  let tenant: TestTenant;
  let token: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with timetable array when feature is enabled", async () => {
    if (SKIP) return;
    // createTestTenant enables timetable + attendance features
    const res = await makeAgent()
      .get("/api/timetable")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.timetable)).toBe(true);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get("/api/timetable");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/timetable", () => {
  let tenant: TestTenant;
  let token: string;
  let subjectId: string;
  let teacherId: string;
  let classId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);
    ({ subjectId, teacherId, classId } = await scaffoldTimetableData(token));
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("creates timeslot — 201 with joined school_period data", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/timetable")
      .set("Authorization", `Bearer ${token}`)
      .send({
        classId,
        subjectId,
        teacherId,
        dayOfWeek: "Monday",
        periodNumber: tenant.periodNumber, // seeded period in createTestTenant
        effectiveFrom: "2024-06-01",
      });
    expect(res.status).toBe(201);
    const slot = res.body.timeSlot;
    expect(slot).toHaveProperty("startTime");
    expect(slot).toHaveProperty("endTime");
    expect(slot).toHaveProperty("label");
    expect(slot.periodNumber).toBe(tenant.periodNumber);
    expect(slot.dayOfWeek).toBe("Monday");
    expect(slot.effectiveTo).toBeNull();
  });

  it("returns 400 VALIDATION_ERROR when startTime or endTime sent in body (v3.3)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/timetable")
      .set("Authorization", `Bearer ${token}`)
      .send({
        classId,
        subjectId,
        teacherId,
        dayOfWeek: "Tuesday",
        periodNumber: tenant.periodNumber,
        effectiveFrom: "2024-06-01",
        startTime: "08:00", // forbidden in v3.3
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 PERIOD_NOT_CONFIGURED for non-existent periodNumber", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/timetable")
      .set("Authorization", `Bearer ${token}`)
      .send({
        classId,
        subjectId,
        teacherId,
        dayOfWeek: "Wednesday",
        periodNumber: 999, // does not exist
        effectiveFrom: "2024-06-01",
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("PERIOD_NOT_CONFIGURED");
  });

  it("returns 400 when required fields are missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/timetable")
      .set("Authorization", `Bearer ${token}`)
      .send({ classId });
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/timetable/:id/end (versioning)", () => {
  let tenant: TestTenant;
  let token: string;
  let timeslotId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);
    const { subjectId, teacherId, classId } =
      await scaffoldTimetableData(token);

    const res = await makeAgent()
      .post("/api/timetable")
      .set("Authorization", `Bearer ${token}`)
      .send({
        classId,
        subjectId,
        teacherId,
        dayOfWeek: "Thursday",
        periodNumber: tenant.periodNumber,
        effectiveFrom: "2024-01-01",
      });
    timeslotId = res.body.timeSlot.id as string;
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("sets effectiveTo — 200 with updated timeslot", async () => {
    if (SKIP) return;
    const endDate = "2024-12-31";
    const res = await makeAgent()
      .put(`/api/timetable/${timeslotId}/end`)
      .set("Authorization", `Bearer ${token}`)
      .send({ effectiveTo: endDate });
    expect(res.status).toBe(200);
    expect(res.body.timeSlot.effectiveTo).toBe(endDate);
  });

  it("returns 404 for unknown timeslot", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put("/api/timetable/TS-no-such-id/end")
      .set("Authorization", `Bearer ${token}`)
      .send({ effectiveTo: "2024-12-31" });
    expect(res.status).toBe(404);
  });
});
