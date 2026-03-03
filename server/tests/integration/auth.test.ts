/**
 * Integration tests: Authentication endpoints
 * Freeze §7 Phase 1–2 acceptance criteria
 *
 * Covers:
 *   POST /api/auth/login      — success, 401, 403 TENANTINACTIVE, 404
 *   POST /api/auth/logout     — success 204
 *   POST /api/auth/switch-role — success, 400 ROLENOTASSIGNED
 */
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import {
  makeAgent,
  createTestTenant,
  cleanupTenant,
  testPool,
  skipIfNoDb,
  type TestTenant,
} from "./helpers/db";

const SKIP = skipIfNoDb();

describe("POST /api/auth/login", () => {
  let tenant: TestTenant;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 + JWT + user on valid credentials", async () => {
    if (SKIP) return;
    const res = await makeAgent().post("/api/auth/login").send({
      email: tenant.adminEmail,
      password: tenant.adminPassword,
      tenantSlug: tenant.tenantSlug,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user).toMatchObject({
      email: tenant.adminEmail,
      tenantId: tenant.tenantId,
    });
    expect(res.body.user.roles).toContain("Admin");
    expect(res.body.user).toHaveProperty("activeRole");
  });

  it("returns 401 for wrong password", async () => {
    if (SKIP) return;
    const res = await makeAgent().post("/api/auth/login").send({
      email: tenant.adminEmail,
      password: "WrongPassword1!",
      tenantSlug: tenant.tenantSlug,
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBeDefined();
  });

  it("returns 404 when tenant slug does not exist", async () => {
    if (SKIP) return;
    const res = await makeAgent().post("/api/auth/login").send({
      email: tenant.adminEmail,
      password: tenant.adminPassword,
      tenantSlug: "no-such-tenant-xyz",
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when required fields are missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/auth/login")
      .send({ email: tenant.adminEmail });
    expect(res.status).toBe(400);
  });

  it("returns 403 TENANTINACTIVE when tenant is deactivated", async () => {
    if (SKIP) return;
    // Deactivate the tenant directly
    await testPool.query(
      "UPDATE tenants SET status = 'inactive', deactivated_at = NOW() WHERE id = $1",
      [tenant.tenantId],
    );
    const res = await makeAgent().post("/api/auth/login").send({
      email: tenant.adminEmail,
      password: tenant.adminPassword,
      tenantSlug: tenant.tenantSlug,
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("TENANTINACTIVE");
    // Restore
    await testPool.query(
      "UPDATE tenants SET status = 'active', deactivated_at = NULL WHERE id = $1",
      [tenant.tenantId],
    );
  });

  it("error response contains timestamp inside error object (Freeze §3 global format)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/auth/login")
      .send({ email: "x@x.com", password: "wrong1234", tenantSlug: "nope" });
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("timestamp");
    expect(res.body).not.toHaveProperty("timestamp"); // NOT sibling
  });
});

describe("POST /api/auth/logout", () => {
  let tenant: TestTenant;
  let token: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    const loginRes = await makeAgent().post("/api/auth/login").send({
      email: tenant.adminEmail,
      password: tenant.adminPassword,
      tenantSlug: tenant.tenantSlug,
    });
    token = loginRes.body.token as string;
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 204", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().post("/api/auth/logout");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/switch-role", () => {
  let tenant: TestTenant;
  let multiRoleToken: string;
  let singleRoleToken: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();

    // Create a Teacher+Admin user
    const uid = `U-MR-${Date.now()}`;
    const bcrypt = (await import("bcryptjs")).default;
    const hash = await bcrypt.hash(tenant.adminPassword, 10);
    await testPool.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, '["Admin","Teacher"]'::jsonb, NOW(), NOW())`,
      [uid, tenant.tenantId, "Multi Role", `multi-${uid}@test.local`, hash],
    );

    const [mrLogin, srLogin] = await Promise.all([
      makeAgent()
        .post("/api/auth/login")
        .send({
          email: `multi-${uid}@test.local`,
          password: tenant.adminPassword,
          tenantSlug: tenant.tenantSlug,
        }),
      makeAgent().post("/api/auth/login").send({
        email: tenant.adminEmail,
        password: tenant.adminPassword,
        tenantSlug: tenant.tenantSlug,
      }),
    ]);
    multiRoleToken = mrLogin.body.token as string;
    singleRoleToken = srLogin.body.token as string;
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 + new JWT on valid role switch", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/auth/switch-role")
      .set("Authorization", `Bearer ${multiRoleToken}`)
      .send({ role: "Teacher" });
    expect(res.status).toBe(200);
    expect(res.body.user.activeRole).toBe("Teacher");
    expect(res.body).toHaveProperty("token");
  });

  it("returns 400 ROLENOTASSIGNED when role not in user roles", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/auth/switch-role")
      .set("Authorization", `Bearer ${singleRoleToken}`)
      .send({ role: "Student" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("ROLENOTASSIGNED");
  });
});
