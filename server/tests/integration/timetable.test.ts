/**
 * Integration tests: Timetable endpoints (v4.4 — CR-32)
 *
 * Covers:
 *   GET    /api/timetable        — list non-deleted timeslots (dayOfWeek/teacherId/classId filters)
 *   POST   /api/timetable        — create timeslot (effectiveFrom removed since CR-31)
 *   DELETE /api/timetable/:id    — soft-delete timeslot (CR-31)
 *
 * FREEZE INVARIANTS (v4.4):
 *   - Feature guard: requires timetable feature enabled
 *   - PERIOD_NOT_CONFIGURED when periodNumber not in school_periods
 *   - POST: no effectiveFrom in body; slot identified by class+day+period
 *   - DELETE: 204; subsequent GET excludes the slot
 *   - PUT /api/timetable/:id does NOT exist (CR-32 removed it)
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
        periodNumber: tenant.periodNumber,
      });
    expect(res.status).toBe(201);
    const slot = res.body.timeSlot;
    expect(slot).toHaveProperty("startTime");
    expect(slot).toHaveProperty("endTime");
    expect(slot).toHaveProperty("label");
    expect(slot.periodNumber).toBe(tenant.periodNumber);
    expect(slot.dayOfWeek).toBe("Monday");
    // v4.3: no effectiveFrom/effectiveTo in response
    expect(slot.effectiveFrom).toBeUndefined();
    expect(slot.effectiveTo).toBeUndefined();
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
        periodNumber: 999,
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

describe("DELETE /api/timetable/:id (soft-delete — CR-31)", () => {
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
        dayOfWeek: "Friday",
        periodNumber: tenant.periodNumber,
      });
    timeslotId = res.body.timeSlot.id as string;
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("soft-deletes timeslot — 204 no body", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete(`/api/timetable/${timeslotId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it("excludes deleted slot from GET /timetable", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/timetable")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const ids = (res.body.timetable as Array<{ id: string }>).map((s) => s.id);
    expect(ids).not.toContain(timeslotId);
  });

  it("returns 404 when deleting already-deleted timeslot", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete(`/api/timetable/${timeslotId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown timeslotId", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete("/api/timetable/TS-no-such-id")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
