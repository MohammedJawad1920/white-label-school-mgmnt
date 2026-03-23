/**
 * Integration tests: School Profile endpoints (v6.1)
 *
 * Covers:
 *   GET   /api/v1/school-profile            — Get tenant profile
 *   PATCH /api/v1/school-profile            — Update tenant profile
 *   POST  /api/v1/school-profile/logo       — Upload logo
 *   POST  /api/v1/school-profile/signature  — Upload principal signature
 *
 * Freeze v6.1 §13.3 — Mandatory test cases:
 *   1. Admin only for updates (GET available to all authenticated)
 *   2. branding_color validation (#XXXXXX format)
 *   3. timezone must be valid IANA timezone
 *   4. active_levels array contains valid level enums
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
  const hash = await bcrypt.hash("Teacher@Pass123", 10);

  await testPool.query(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, '["Teacher"]'::jsonb, NOW(), NOW())`,
    [teacherId, tenant.tenantId, "Test Teacher", teacherEmail, hash],
  );

  const res = await makeAgent().post("/api/v1/auth/login").send({
    email: teacherEmail,
    password: "Teacher@Pass123",
    tenantId: tenant.tenantId,
  });
  return res.body.token as string;
}

// ── GET /api/v1/school-profile ──────────────────────────────────────────────
describe("GET /api/v1/school-profile", () => {
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

  it("Admin: returns 200 with tenant profile", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/school-profile")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.profile).toHaveProperty("name");
    expect(res.body.profile).toHaveProperty("slug");
    expect(res.body.profile).toHaveProperty("timezone");
    expect(res.body.profile).toHaveProperty("status");
  });

  it("Teacher: returns 200 with profile (accessible to all authenticated)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/school-profile")
      .set("Authorization", `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.profile).toHaveProperty("name");
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get("/api/v1/school-profile");
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/school-profile ────────────────────────────────────────────
describe("PATCH /api/v1/school-profile", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let teacherToken: string;

  beforeEach(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);
    teacherToken = await createTeacherAndLogin(tenant);
  });

  afterEach(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("Admin: updates profile successfully", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .patch("/api/v1/school-profile")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Updated School Name",
        address: "123 Test Street",
        brandingColor: "#FF5733",
        principalName: "Dr. John Smith",
      });

    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({
      name: "Updated School Name",
      address: "123 Test Street",
      brandingColor: "#FF5733",
      principalName: "Dr. John Smith",
    });
  });

  it("validates branding_color format (regression: #XXXXXX)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .patch("/api/v1/school-profile")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ brandingColor: "invalid" });

    expect(res.status).toBe(400);
  });

  it("validates timezone is valid IANA timezone (regression)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .patch("/api/v1/school-profile")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ timezone: "Invalid/Timezone" });

    expect(res.status).toBe(400);
  });

  it("accepts valid IANA timezone", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .patch("/api/v1/school-profile")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ timezone: "America/New_York" });

    expect(res.status).toBe(200);
    expect(res.body.profile.timezone).toBe("America/New_York");
  });

  it("validates active_levels array (regression)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .patch("/api/v1/school-profile")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ activeLevels: ["Std8", "InvalidLevel"] });

    expect(res.status).toBe(400);
  });

  it("accepts valid active_levels array", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .patch("/api/v1/school-profile")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ activeLevels: ["Std8", "Std9", "Std10"] });

    expect(res.status).toBe(200);
    expect(res.body.profile.activeLevels).toEqual(["Std8", "Std9", "Std10"]);
  });

  it("returns 403 for Teacher role (Admin only)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .patch("/api/v1/school-profile")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ name: "Attempted Update" });

    expect(res.status).toBe(403);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().patch("/api/v1/school-profile").send({ name: "Test" });
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/school-profile/logo ────────────────────────────────────────
describe("POST /api/v1/school-profile/logo", () => {
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

  it("returns 403 for Teacher role (Admin only)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/school-profile/logo")
      .set("Authorization", `Bearer ${teacherToken}`)
      .attach("logo", Buffer.from("fake-image"), "logo.png");

    expect(res.status).toBe(403);
  });

  it("returns 400 when no file uploaded", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/school-profile/logo")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/school-profile/logo")
      .attach("logo", Buffer.from("fake-image"), "logo.png");
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/school-profile/signature ───────────────────────────────────
describe("POST /api/v1/school-profile/signature", () => {
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

  it("returns 400 when no file uploaded", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/school-profile/signature")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/school-profile/signature")
      .attach("signature", Buffer.from("fake-signature"), "signature.png");
    expect(res.status).toBe(401);
  });
});

// ── Principal fields for report cards ───────────────────────────────────────
describe("School Profile - Report Card Fields", () => {
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

  it("returns principalName and principalSignatureUrl in profile", async () => {
    if (SKIP) return;

    await makeAgent()
      .patch("/api/v1/school-profile")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ principalName: "Dr. Principal" });

    const res = await makeAgent()
      .get("/api/v1/school-profile")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.profile).toHaveProperty("principalName");
    expect(res.body.profile.principalName).toBe("Dr. Principal");
  });
});
