/**
 * Integration tests: Events endpoints (v4.5 CR-37)
 *
 * Covers:
 *   POST   /api/events              — Admin only; 201 with event object
 *   GET    /api/events              — All roles; 200 with event list
 *   PUT    /api/events/:eventId     — Admin only; 200 with updated event
 *   DELETE /api/events/:eventId     — Admin only; 204 soft-delete
 *
 * FREEZE INVARIANTS:
 *   - No featureGuard on events — available to all active tenant users
 *   - Soft-delete only — deleted events disappear from GET results
 *   - GET uses range-overlap filter: start_date <= to AND end_date >= from
 *   - Admin: full CRUD; Teacher/Student: GET only; unauthenticated: 401
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/events
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/events", () => {
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

  it("creates an event and returns 201 with event object", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "End of Term Exams",
        type: "Exam",
        startDate: "2025-03-10",
        endDate: "2025-03-20",
        description: "Final exams for Term 2",
      });
    expect(res.status).toBe(201);
    expect(res.body.event).toMatchObject({
      title: "End of Term Exams",
      type: "Exam",
      startDate: "2025-03-10",
      endDate: "2025-03-20",
      description: "Final exams for Term 2",
    });
    expect(res.body.event.id).toMatch(/^EVT-/);
    expect(res.body.event).toHaveProperty("createdAt");
  });

  it("creates an event without optional description", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Sports Day",
        type: "Event",
        startDate: "2025-04-05",
        endDate: "2025-04-05",
      });
    expect(res.status).toBe(201);
    expect(res.body.event.description).toBeNull();
  });

  it("returns 400 when title is missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "Holiday",
        startDate: "2025-01-01",
        endDate: "2025-01-01",
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when type is invalid", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Bad Event",
        type: "InvalidType",
        startDate: "2025-01-01",
        endDate: "2025-01-01",
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when startDate is missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "No Date", type: "Other", endDate: "2025-01-01" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when endDate is before startDate", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Bad Range",
        type: "Other",
        startDate: "2025-06-10",
        endDate: "2025-06-01",
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 401 when unauthenticated", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/events")
      .send({
        title: "No Auth",
        type: "Other",
        startDate: "2025-01-01",
        endDate: "2025-01-01",
      });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/events
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/events", () => {
  let tenant: TestTenant;
  let token: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);

    // Seed two events with distinct types and date ranges
    await makeAgent()
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Summer Holiday",
        type: "Holiday",
        startDate: "2025-05-01",
        endDate: "2025-05-31",
      });
    await makeAgent()
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Annual Day",
        type: "Event",
        startDate: "2025-06-15",
        endDate: "2025-06-15",
      });
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with events array and total", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/events?from=2025-01-01&to=2025-12-31")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(typeof res.body.total).toBe("number");
    expect(res.body.events.length).toBeGreaterThanOrEqual(2);
  });

  it("returns only overlapping events for a narrow date range", async () => {
    if (SKIP) return;
    // Only the Holiday overlaps May 2025
    const res = await makeAgent()
      .get("/api/events?from=2025-05-10&to=2025-05-20")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(
      res.body.events.every((e: { type: string }) => e.type === "Holiday"),
    ).toBe(true);
  });

  it("filters by type parameter", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/events?from=2025-01-01&to=2025-12-31&type=Event")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(
      res.body.events.every((e: { type: string }) => e.type === "Event"),
    ).toBe(true);
  });

  it("returns 400 for invalid type parameter", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/events?from=2025-01-01&to=2025-12-31&type=Nonexistent")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("returns empty array when no events overlap the range", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/events?from=2020-01-01&to=2020-01-31")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it("returns 401 when unauthenticated", async () => {
    if (SKIP) return;
    const res = await makeAgent().get("/api/events");
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/events/:eventId
// ─────────────────────────────────────────────────────────────────────────────

describe("PUT /api/events/:eventId", () => {
  let tenant: TestTenant;
  let token: string;
  let eventId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);

    const res = await makeAgent()
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Original Title",
        type: "Other",
        startDate: "2025-09-01",
        endDate: "2025-09-05",
      });
    eventId = res.body.event.id as string;
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("partially updates an event and returns 200", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Updated Title", description: "Now with details" });
    expect(res.status).toBe(200);
    expect(res.body.event.title).toBe("Updated Title");
    expect(res.body.event.description).toBe("Now with details");
    // Unchanged fields preserved
    expect(res.body.event.type).toBe("Other");
    expect(res.body.event.startDate).toBe("2025-09-01");
  });

  it("returns 400 when patching endDate before startDate", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/events/${eventId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ endDate: "2025-08-01" }); // before startDate 2025-09-01
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for unknown eventId", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put("/api/events/EVT-no-such-id")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Ghost" });
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/events/${eventId}`)
      .send({ title: "No Auth" });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/events/:eventId
// ─────────────────────────────────────────────────────────────────────────────

describe("DELETE /api/events/:eventId", () => {
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

  it("soft-deletes an event and returns 204", async () => {
    if (SKIP) return;
    const createRes = await makeAgent()
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "To Be Deleted",
        type: "Other",
        startDate: "2025-11-01",
        endDate: "2025-11-01",
      });
    const targetId = createRes.body.event.id as string;

    const deleteRes = await makeAgent()
      .delete(`/api/events/${targetId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);

    // Deleted event should no longer appear in list
    const listRes = await makeAgent()
      .get("/api/events?from=2025-11-01&to=2025-11-01")
      .set("Authorization", `Bearer ${token}`);
    const ids = (listRes.body.events as Array<{ id: string }>).map((e) => e.id);
    expect(ids).not.toContain(targetId);
  });

  it("returns 404 when deleting an already-deleted event", async () => {
    if (SKIP) return;
    const createRes = await makeAgent()
      .post("/api/events")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Double Delete",
        type: "Other",
        startDate: "2025-12-01",
        endDate: "2025-12-01",
      });
    const targetId = createRes.body.event.id as string;

    await makeAgent()
      .delete(`/api/events/${targetId}`)
      .set("Authorization", `Bearer ${token}`);

    const secondDelete = await makeAgent()
      .delete(`/api/events/${targetId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(secondDelete.status).toBe(404);
  });

  it("returns 404 for unknown eventId", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .delete("/api/events/EVT-no-such-id")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    if (SKIP) return;
    const res = await makeAgent().delete("/api/events/EVT-some-id");
    expect(res.status).toBe(401);
  });
});
