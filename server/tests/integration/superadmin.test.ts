/**
 * Integration tests: SuperAdmin endpoints
 * Freeze §8 SuperAdmin acceptance criteria
 *
 * Covers:
 *   POST /api/super-admin/auth/login         — success, 401
 *   GET  /api/super-admin/tenants            — list, filter by status
 *   POST /api/super-admin/tenants            — create (atomic: tenant+8periods+features+admin), 409
 *   PUT  /api/super-admin/tenants/:id/deactivate   — 200, 409 ALREADYINACTIVE
 *   PUT  /api/super-admin/tenants/:id/reactivate   — 200, 409 ALREADYACTIVE
 *   GET  /api/super-admin/tenants/:id/features     — 200, 404
 *   PUT  /api/super-admin/tenants/:id/features/:key — 200, 400 FEATURE_DEPENDENCY
 */
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { v4 as uuidv4 } from "uuid";
import {
  makeAgent,
  createTestTenant,
  cleanupTenant,
  testPool,
  seedSuperAdmin,
  cleanupSuperAdmin,
  skipIfNoDb,
  SA_EMAIL,
  SA_PASSWORD,
  type TestTenant,
} from "./helpers/db";

const SKIP = skipIfNoDb();

async function saLogin(): Promise<string> {
  const res = await makeAgent()
    .post("/api/super-admin/auth/login")
    .send({ email: SA_EMAIL, password: SA_PASSWORD });
  return res.body.token as string;
}

describe("POST /api/super-admin/auth/login", () => {
  beforeAll(async () => {
    if (SKIP) return;
    await seedSuperAdmin();
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupSuperAdmin();
  });

  it("returns 200 + JWT on valid credentials", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/super-admin/auth/login")
      .send({ email: SA_EMAIL, password: SA_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.superAdmin.email).toBe(SA_EMAIL);
  });

  it("returns 401 on wrong password", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/super-admin/auth/login")
      .send({ email: SA_EMAIL, password: "WrongPass1" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when email/password absent", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/super-admin/auth/login")
      .send({ email: SA_EMAIL });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/super-admin/tenants", () => {
  let token: string;
  let tenant: TestTenant;

  beforeAll(async () => {
    if (SKIP) return;
    await seedSuperAdmin();
    token = await saLogin();
    tenant = await createTestTenant();
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
    await cleanupSuperAdmin();
  });

  it("returns 200 + tenants array", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/super-admin/tenants")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tenants)).toBe(true);
    const ids = (res.body.tenants as { id: string }[]).map((t) => t.id);
    expect(ids).toContain(tenant.tenantId);
  });

  it("filters by status=active", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/super-admin/tenants?status=active")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const statuses = (res.body.tenants as { status: string }[]).map(
      (t) => t.status,
    );
    statuses.forEach((s) => expect(s).toBe("active"));
  });

  it("returns 401 without token", async () => {
    if (SKIP) return;
    const res = await makeAgent().get("/api/super-admin/tenants");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/super-admin/tenants", () => {
  let token: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    if (SKIP) return;
    await seedSuperAdmin();
    token = await saLogin();
  });

  afterAll(async () => {
    if (SKIP) return;
    for (const id of createdIds) {
      await cleanupTenant(id);
    }
    await cleanupSuperAdmin();
  });

  it("creates tenant atomically — 201 with tenant + admin + 8 periods", async () => {
    if (SKIP) return;
    const tid = `t-int-${uuidv4().slice(0, 8)}`;
    const slug = `slug-${Date.now()}`;
    const res = await makeAgent()
      .post("/api/super-admin/tenants")
      .set("Authorization", `Bearer ${token}`)
      .send({
        id: tid,
        name: "Integration School",
        slug,
        admin: {
          name: "School Admin",
          email: `sa-${Date.now()}@school.local`,
          password: "Admin@Pass1",
        },
      });
    expect(res.status).toBe(201);
    expect(res.body.tenant.id).toBe(tid);
    expect(res.body.admin.roles).toContain("Admin");
    createdIds.push(tid);

    // Verify 8 periods seeded
    const periods = await testPool.query(
      "SELECT COUNT(*) FROM school_periods WHERE tenant_id = $1",
      [tid],
    );
    expect(Number(periods.rows[0]!.count)).toBe(8);
  });

  it("returns 409 DUPLICATE_TENANT on duplicate id/slug", async () => {
    if (SKIP) return;
    const tid = `t-dup-${uuidv4().slice(0, 8)}`;
    const slug = `slug-dup-${Date.now()}`;
    const body = {
      id: tid,
      name: "Dup School",
      slug,
      admin: {
        name: "Dup Admin",
        email: `dup-${Date.now()}@school.local`,
        password: "Admin@Pass1",
      },
    };
    await makeAgent()
      .post("/api/super-admin/tenants")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
    createdIds.push(tid);

    // Same ID again
    const res = await makeAgent()
      .post("/api/super-admin/tenants")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...body,
        admin: { ...body.admin, email: `dup2-${Date.now()}@school.local` },
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_TENANT");
  });

  it("returns 409 ADMIN_EMAIL_TAKEN when admin email already registered", async () => {
    if (SKIP) return;
    const fixedEmail = `admin-dup-${Date.now()}@school.local`;
    const tid1 = `t-ae1-${uuidv4().slice(0, 8)}`;
    const tid2 = `t-ae2-${uuidv4().slice(0, 8)}`;

    await makeAgent()
      .post("/api/super-admin/tenants")
      .set("Authorization", `Bearer ${token}`)
      .send({
        id: tid1,
        name: "First",
        slug: `slug-ae1-${Date.now()}`,
        admin: { name: "A1", email: fixedEmail, password: "Admin@Pass1" },
      });
    createdIds.push(tid1);

    const res = await makeAgent()
      .post("/api/super-admin/tenants")
      .set("Authorization", `Bearer ${token}`)
      .send({
        id: tid2,
        name: "Second",
        slug: `slug-ae2-${Date.now()}`,
        admin: { name: "A2", email: fixedEmail, password: "Admin@Pass1" },
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ADMIN_EMAIL_TAKEN");
    // Verify tenant was NOT persisted (transaction rolled back)
    const check = await testPool.query("SELECT id FROM tenants WHERE id = $1", [
      tid2,
    ]);
    expect(check.rowCount).toBe(0);
  });
});

describe("PUT /api/super-admin/tenants/:id/deactivate + reactivate", () => {
  let token: string;
  let tenant: TestTenant;

  beforeAll(async () => {
    if (SKIP) return;
    await seedSuperAdmin();
    token = await saLogin();
    tenant = await createTestTenant();
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
    await cleanupSuperAdmin();
  });

  it("deactivates an active tenant — 200", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/super-admin/tenants/${tenant.tenantId}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.tenant.status).toBe("inactive");
  });

  it("deactivating again returns 409 ALREADYINACTIVE", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/super-admin/tenants/${tenant.tenantId}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADYINACTIVE");
  });

  it("reactivates an inactive tenant — 200", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/super-admin/tenants/${tenant.tenantId}/reactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.tenant.status).toBe("active");
  });

  it("reactivating an active tenant returns 409 ALREADYACTIVE", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/super-admin/tenants/${tenant.tenantId}/reactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADYACTIVE");
  });
});

describe("GET/PUT /api/super-admin/tenants/:id/features", () => {
  let token: string;
  let tenant: TestTenant;

  beforeAll(async () => {
    if (SKIP) return;
    await seedSuperAdmin();
    token = await saLogin();
    tenant = await createTestTenant();
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
    await cleanupSuperAdmin();
  });

  it("GET returns 200 + features array", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/super-admin/tenants/${tenant.tenantId}/features`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.features)).toBe(true);
    const keys = (res.body.features as { featureKey: string }[]).map(
      (f) => f.featureKey,
    );
    expect(keys).toContain("timetable");
    expect(keys).toContain("attendance");
  });

  it("GET returns 404 for unknown tenant", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/super-admin/tenants/no-such-tenant/features")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("PUT enables timetable — 200", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/super-admin/tenants/${tenant.tenantId}/features/timetable`)
      .set("Authorization", `Bearer ${token}`)
      .send({ enabled: true });
    expect(res.status).toBe(200);
    expect(res.body.feature.enabled).toBe(true);
  });

  it("PUT enables attendance — 200 (no dependency error since timetable already on)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/super-admin/tenants/${tenant.tenantId}/features/attendance`)
      .set("Authorization", `Bearer ${token}`)
      .send({ enabled: true });
    expect(res.status).toBe(200);
    expect(res.body.feature.enabled).toBe(true);
  });

  it("PUT 400 FEATURE_DEPENDENCY when enabling attendance without timetable", async () => {
    if (SKIP) return;
    // First disable timetable, then disable attendance, then try to enable attendance alone
    await makeAgent()
      .put(`/api/super-admin/tenants/${tenant.tenantId}/features/attendance`)
      .set("Authorization", `Bearer ${token}`)
      .send({ enabled: false });
    await makeAgent()
      .put(`/api/super-admin/tenants/${tenant.tenantId}/features/timetable`)
      .set("Authorization", `Bearer ${token}`)
      .send({ enabled: false });

    const res = await makeAgent()
      .put(`/api/super-admin/tenants/${tenant.tenantId}/features/attendance`)
      .set("Authorization", `Bearer ${token}`)
      .send({ enabled: true });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("FEATURE_DEPENDENCY");
  });
});
