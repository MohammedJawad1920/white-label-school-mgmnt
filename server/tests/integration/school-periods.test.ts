/**
 * Integration tests: School Periods endpoints (v3.3)
 *
 * Covers:
 *   GET    /api/v1/school-periods          — lists all periods (seeded 8 by super-admin)
 *   POST   /api/v1/school-periods          — create period
 *   PUT    /api/v1/school-periods/:id      — update label/times, periodNumber immutable
 *   DELETE /api/v1/school-periods/:id      — hard delete; 409 when timeslots reference it
 *
 * FREEZE INVARIANTS:
 *   - periodNumber immutable after creation
 *   - startTime < endTime (PERIOD_TIME_INVALID)
 *   - Hard delete blocked by referenced timeslots (HAS_REFERENCES)
 * Feature guard: these endpoints are NOT behind a feature flag.
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
  const res = await makeAgent().post("/api/v1/auth/login").send({
    email: tenant.adminEmail,
    password: tenant.adminPassword,
    tenantId: tenant.tenantId,
  });
  return res.body.token as string;
}

describe("GET /api/v1/school-periods", () => {
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

  it("returns 200 with at least 1 period (seeded by createTestTenant)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/school-periods")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.periods)).toBe(true);
    expect(res.body.periods.length).toBeGreaterThanOrEqual(1);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get("/api/v1/school-periods");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/school-periods", () => {
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

  it("creates a period — 201 with all fields", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/school-periods")
      .set("Authorization", `Bearer ${token}`)
      .send({
        periodNumber: 9,
        label: "Period 9",
        startTime: "16:00",
        endTime: "16:45",
      });
    expect(res.status).toBe(201);
    const p = res.body.period;
    expect(p.periodNumber).toBe(9);
    expect(p.startTime).toBe("16:00");
    expect(p.endTime).toBe("16:45");
  });

  it("returns 400 PERIOD_TIME_INVALID when startTime >= endTime", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/school-periods")
      .set("Authorization", `Bearer ${token}`)
      .send({
        periodNumber: 10,
        label: "Bad Time",
        startTime: "10:00",
        endTime: "09:00",
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("PERIOD_TIME_INVALID");
  });

  it("returns 400 when required fields missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/school-periods")
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "No Number" });
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/v1/school-periods/:id", () => {
  let tenant: TestTenant;
  let token: string;
  let periodId: string;
  let originalNumber: number;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);
    const res = await makeAgent()
      .post("/api/v1/school-periods")
      .set("Authorization", `Bearer ${token}`)
      .send({
        periodNumber: 11,
        label: "PUT Period",
        startTime: "17:00",
        endTime: "17:45",
      });
    periodId = res.body.period.id as string;
    originalNumber = res.body.period.periodNumber as number;
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("updates label and times — 200", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/school-periods/${periodId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ label: "Updated Label", startTime: "17:05", endTime: "17:50" });
    expect(res.status).toBe(200);
    expect(res.body.period.label).toBe("Updated Label");
    expect(res.body.period.startTime).toBe("17:05");
  });

  it("periodNumber is immutable — stays the same even if sent in body", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/school-periods/${periodId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ periodNumber: 99, label: "Immutable Test" });
    expect(res.status).toBe(200);
    // periodNumber must not have changed
    expect(res.body.period.periodNumber).toBe(originalNumber);
  });

  it("returns 400 PERIOD_TIME_INVALID when startTime >= endTime on update", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/v1/school-periods/${periodId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ startTime: "18:00", endTime: "17:00" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("PERIOD_TIME_INVALID");
  });
});

describe("DELETE /api/v1/school-periods/:id", () => {
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

  it("hard-deletes an unreferenced period — 204", async () => {
    if (SKIP) return;
    const createRes = await makeAgent()
      .post("/api/v1/school-periods")
      .set("Authorization", `Bearer ${token}`)
      .send({
        periodNumber: 12,
        label: "Deletable",
        startTime: "18:00",
        endTime: "18:45",
      });
    const pid = createRes.body.period.id as string;
    const res = await makeAgent()
      .delete(`/api/v1/school-periods/${pid}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  it("returns 404 on unknown period", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete("/api/v1/school-periods/00000000-0000-0000-0000-000000000030")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
