/**
 * Integration tests: Settings endpoints (v6.1)
 *
 * Covers:
 *   GET /api/v1/settings/grade-config — Admin only, returns grade boundaries
 *   GET /api/v1/features              — Admin only, returns feature flags
 *
 * Freeze v6.1 §13.3 — Mandatory test cases:
 *   1. GET /settings/grade-config returns array with 8 items, first grade = A+, last = F
 *      (regression — was returning S-scale)
 *   2. Grade config includes all required fields (grade, minPercentage, maxPercentage, label)
 *   3. Features list endpoint returns all feature flags
 *   4. Admin only access
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

// ── GET /api/v1/settings/grade-config ──────────────────────────────────────
describe("GET /api/v1/settings/grade-config", () => {
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

  it("returns 200 with array of 8 grade boundaries, first = A+, last = F (regression test)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/settings/grade-config")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(8);

    // First grade should be A+ (regression: was returning S-scale)
    const firstGrade = res.body.data[0];
    expect(firstGrade.grade).toBe("A+");

    // Last grade should be F
    const lastGrade = res.body.data[res.body.data.length - 1];
    expect(lastGrade.grade).toBe("F");
  });

  it("each grade boundary includes all required fields (grade, minPercentage, maxPercentage, label)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/settings/grade-config")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    for (const boundary of res.body.data) {
      expect(boundary).toHaveProperty("grade");
      expect(typeof boundary.grade).toBe("string");

      expect(boundary).toHaveProperty("minPercentage");
      expect(typeof boundary.minPercentage).toBe("number");

      expect(boundary).toHaveProperty("maxPercentage");
      expect(typeof boundary.maxPercentage).toBe("number");

      expect(boundary).toHaveProperty("label");
      expect(typeof boundary.label).toBe("string");

      // Validate percentage ranges are sensible
      expect(boundary.minPercentage).toBeGreaterThanOrEqual(0);
      expect(boundary.maxPercentage).toBeLessThanOrEqual(100);
      expect(boundary.minPercentage).toBeLessThanOrEqual(boundary.maxPercentage);
    }
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get("/api/v1/settings/grade-config");
    expect(res.status).toBe(401);
  });

  it("returns 403 for Teacher role (Admin only)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/settings/grade-config")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(403);
  });
});

// ── GET /api/v1/features ────────────────────────────────────────────────────
describe("GET /api/v1/features", () => {
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

  it("returns 200 with all feature flags for the tenant", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/features")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("features");
    expect(Array.isArray(res.body.features)).toBe(true);

    // createTestTenant seeds 10 feature flags (all enabled)
    // Verify we get at least the seeded features
    expect(res.body.features.length).toBeGreaterThanOrEqual(10);

    // Verify each feature has required shape
    for (const feature of res.body.features) {
      expect(feature).toHaveProperty("key");
      expect(typeof feature.key).toBe("string");

      expect(feature).toHaveProperty("name");
      expect(typeof feature.name).toBe("string");

      expect(feature).toHaveProperty("enabled");
      expect(typeof feature.enabled).toBe("boolean");

      expect(feature).toHaveProperty("enabledAt");
      // enabledAt can be string (ISO date) or null
    }

    // Verify known seeded features are enabled
    const featureKeys = res.body.features.map(
      (f: { key: string }) => f.key,
    );
    expect(featureKeys).toContain("timetable");
    expect(featureKeys).toContain("attendance");
    expect(featureKeys).toContain("leave");
    expect(featureKeys).toContain("exams");
    expect(featureKeys).toContain("fees");

    // Verify seeded features are enabled
    const timetableFeature = res.body.features.find(
      (f: { key: string }) => f.key === "timetable",
    );
    expect(timetableFeature?.enabled).toBe(true);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get("/api/v1/features");
    expect(res.status).toBe(401);
  });

  it("returns 403 for Teacher role (Admin only)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/features")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(403);
  });
});
