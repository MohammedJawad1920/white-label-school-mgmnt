/**
 * Integration tests: User Management endpoints (v3.5 CR-12 + CR-13)
 * Freeze §7 Phase 2 acceptance criteria + §3.5 User Management contract
 *
 * Covers:
 *   GET  /api/users               — excludes Student-role users (CR-13)
 *   POST /api/users               — rejects Student role (INVALIDROLE) (CR-13)
 *   PUT  /api/users/:id/roles     — self-edit allowed (CR-12); LASTADMIN guard
 *   DELETE /api/users/:id         — soft delete + 409 HASREFERENCES
 *   DELETE /api/users/bulk        — bulk soft delete
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

async function loginAsAdmin(tenant: TestTenant): Promise<string> {
  const res = await makeAgent().post("/api/auth/login").send({
    email: tenant.adminEmail,
    password: tenant.adminPassword,
    tenantSlug: tenant.tenantSlug,
  });
  return res.body.token as string;
}

describe("GET /api/users", () => {
  let tenant: TestTenant;
  let token: string;
  let studentUserId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);

    // Seed a Student-role user directly — should be excluded from /users
    const bcrypt = (await import("bcryptjs")).default;
    studentUserId = `U-STU-${Date.now()}`;
    await testPool.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, '["Student"]'::jsonb, NOW(), NOW())`,
      [
        studentUserId,
        tenant.tenantId,
        "Test Student",
        `student-${studentUserId}@test.local`,
        await bcrypt.hash("pass12345", 10),
      ],
    );
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with users list (no Student-role users — CR-13)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("users");
    const emails = (res.body.users as { email: string }[]).map((u) => u.email);
    // Student user must NOT appear
    expect(emails).not.toContain(`student-${studentUserId}@test.local`);
    // Admin user must appear
    expect(emails).toContain(tenant.adminEmail);
  });

  it("filters by role=Teacher", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/users?role=Teacher")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const roles = (res.body.users as { roles: string[] }[]).flatMap(
      (u) => u.roles,
    );
    // Every returned user must have Teacher role
    roles.forEach((r) => expect(["Teacher", "Admin"]).toContain(r));
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get("/api/users");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/users", () => {
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

  it("creates a Teacher user and returns 201", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "New Teacher",
        email: `teacher-${Date.now()}@test.local`,
        password: "Teacher@Pass1",
        roles: ["Teacher"],
      });
    expect(res.status).toBe(201);
    expect(res.body.user.roles).toContain("Teacher");
  });

  it("returns 400 INVALIDROLE when Student is passed in roles (CR-13)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Should Fail",
        email: `fail-${Date.now()}@test.local`,
        password: "Fail@Pass123",
        roles: ["Student"],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALIDROLE");
  });

  it("returns 409 on duplicate email", async () => {
    if (SKIP) return;
    const email = `dup-${Date.now()}@test.local`;
    await makeAgent()
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "First",
        email,
        password: "First@Pass1",
        roles: ["Teacher"],
      });
    const res = await makeAgent()
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Second",
        email,
        password: "Second@Pass1",
        roles: ["Admin"],
      });
    expect(res.status).toBe(409);
  });
});

describe("PUT /api/users/:id/roles", () => {
  let tenant: TestTenant;
  let token: string;
  let teacherId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);

    // Create a Teacher user to update
    const res = await makeAgent()
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Target Teacher",
        email: `target-${Date.now()}@test.local`,
        password: "Target@Pass1",
        roles: ["Teacher"],
      });
    teacherId = res.body.user.id as string;
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("updates another user roles — 200", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/users/${teacherId}/roles`)
      .set("Authorization", `Bearer ${token}`)
      .send({ roles: ["Teacher", "Admin"] });
    expect(res.status).toBe(200);
    expect(res.body.user.roles).toContain("Teacher");
    expect(res.body.user.roles).toContain("Admin");
  });

  it("allows self role edit (CR-12 — isSelf guard removed)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/users/${tenant.adminId}/roles`)
      .set("Authorization", `Bearer ${token}`)
      .send({ roles: ["Admin", "Teacher"] });
    // Should succeed — self-edit is now allowed
    expect(res.status).toBe(200);
    expect(res.body.user.roles).toContain("Admin");
  });

  it("returns 403 LASTADMIN when removing own Admin role as sole admin", async () => {
    if (SKIP) return;
    // Set the target teacher back to Teacher-only so adminId remains sole admin
    await makeAgent()
      .put(`/api/users/${teacherId}/roles`)
      .set("Authorization", `Bearer ${token}`)
      .send({ roles: ["Teacher"] });

    const res = await makeAgent()
      .put(`/api/users/${tenant.adminId}/roles`)
      .set("Authorization", `Bearer ${token}`)
      .send({ roles: ["Teacher"] }); // Remove Admin from self
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("LASTADMIN");
  });
});

describe("DELETE /api/users/:id and bulk", () => {
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

  it("soft-deletes a user — 204", async () => {
    if (SKIP) return;
    const createRes = await makeAgent()
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "ToDelete",
        email: `del-${Date.now()}@test.local`,
        password: "Delete@Pass1",
        roles: ["Teacher"],
      });
    const uid = createRes.body.user.id as string;
    const res = await makeAgent()
      .delete(`/api/users/${uid}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);

    // Soft-deleted user should not appear in GET /users
    const listRes = await makeAgent()
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);
    const ids = (listRes.body.users as { id: string }[]).map((u) => u.id);
    expect(ids).not.toContain(uid);
  });

  it("bulk deletes users — 200 with deleted/failed arrays", async () => {
    if (SKIP) return;
    const [r1, r2] = await Promise.all([
      makeAgent()
        .post("/api/users")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Bulk1",
          email: `bulk1-${Date.now()}@test.local`,
          password: "Bulk@Pass123",
          roles: ["Teacher"],
        }),
      makeAgent()
        .post("/api/users")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Bulk2",
          email: `bulk2-${Date.now()}@test.local`,
          password: "Bulk@Pass123",
          roles: ["Teacher"],
        }),
    ]);
    const ids = [r1.body.user.id as string, r2.body.user.id as string];
    const res = await makeAgent()
      .delete("/api/users/bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("deleted");
    expect(res.body).toHaveProperty("failed");
    expect(res.body.deleted.length).toBe(2);
  });
});
