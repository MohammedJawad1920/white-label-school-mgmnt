/**
 * Integration tests: Students endpoints (v3.5 CR-13)
 *
 * Covers:
 *   GET  /api/students                  — lists students with v3.5 fields
 *   POST /api/students                  — atomic user+student creation
 *   PUT  /api/students/:id              — update; dob/admissionNumber change re-hashes password
 *   DELETE /api/students/:id            — soft delete (204)
 *   DELETE /api/students/bulk           — bulk soft delete (200)
 *
 * BUSINESS RULES (v3.5 CR-13):
 *   - loginId = {admissionNumber.toLowerCase()}@{tenantSlug}.local
 *   - password = admissionNumber + DDMMYYYY(dob)
 *   - POST atomically creates users row + students row
 *   - PUT recomputes password_hash when dob or admissionNumber changes
 *   - 409 ADMISSIONNUMBERCONFLICT on duplicate admissionNumber within tenant
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

/** Creates a batch + class via API. Returns { batchId, classId }. */
async function seedBatchAndClass(
  token: string,
  label: string,
): Promise<{ batchId: string; classId: string }> {
  const bRes = await makeAgent()
    .post("/api/batches")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: `Batch-${label}`, startYear: 2024, endYear: 2025 });

  const batchId = bRes.body.batch.id as string;

  const cRes = await makeAgent()
    .post("/api/classes")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: `Class-${label}`, batchId });

  return { batchId, classId: cRes.body.class.id as string };
}

describe("POST /api/students", () => {
  let tenant: TestTenant;
  let token: string;
  let batchId: string;
  let classId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);
    ({ batchId, classId } = await seedBatchAndClass(
      token,
      Date.now().toString(),
    ));
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("creates student atomically — 201 with all v3.5 CR-13 fields", async () => {
    if (SKIP) return;
    const admissionNumber = `ADM-${Date.now()}`;
    const dob = "2010-05-15";
    const res = await makeAgent()
      .post("/api/students")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Alice Test", classId, batchId, admissionNumber, dob });

    expect(res.status).toBe(201);
    const s = res.body.student;
    expect(s).toHaveProperty("id");
    expect(s).toHaveProperty("userId"); // linked user created atomically
    expect(s).toHaveProperty("loginId");
    expect(s).toHaveProperty("admissionNumber", admissionNumber);
    expect(s).toHaveProperty("dob", dob);
    // loginId format: {admissionNumber.toLowerCase()}@{tenantSlug}.local
    expect(s.loginId).toBe(
      `${admissionNumber.toLowerCase()}@${tenant.tenantSlug}.local`,
    );
  });

  it("student can log in with derived credentials (admissionNumber + DDMMYYYY)", async () => {
    if (SKIP) return;
    const admissionNumber = `LOGIN-${Date.now()}`;
    const dob = "2011-03-22";
    await makeAgent()
      .post("/api/students")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Bob Login", classId, batchId, admissionNumber, dob });

    // DDMMYYYY of 2011-03-22 → 22032011
    const derivedPassword = `${admissionNumber}22032011`;
    const loginRes = await makeAgent()
      .post("/api/auth/login")
      .send({
        email: `${admissionNumber.toLowerCase()}@${tenant.tenantSlug}.local`,
        password: derivedPassword,
        tenantSlug: tenant.tenantSlug,
      });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty("token");
  });

  it("returns 409 ADMISSIONNUMBERCONFLICT on duplicate admissionNumber", async () => {
    if (SKIP) return;
    const admissionNumber = `DUP-${Date.now()}`;
    const dob = "2010-01-01";
    await makeAgent()
      .post("/api/students")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "First", classId, batchId, admissionNumber, dob });

    const res = await makeAgent()
      .post("/api/students")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Second", classId, batchId, admissionNumber, dob });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ADMISSIONNUMBERCONFLICT");
  });

  it("returns 400 when required fields are missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/students")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Incomplete" });
    expect(res.status).toBe(400);
  });

  it("returns 400 BATCH_CLASS_MISMATCH when class is from a different batch", async () => {
    if (SKIP) return;
    const { batchId: otherBatch, classId: otherClass } =
      await seedBatchAndClass(token, `other-${Date.now()}`);
    // Use classId from original batch but otherBatch id
    const res = await makeAgent()
      .post("/api/students")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Mismatch",
        classId, // belongs to `batchId`
        batchId: otherBatch, // different batch
        admissionNumber: `MIS-${Date.now()}`,
        dob: "2010-06-10",
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BATCH_CLASS_MISMATCH");
  });
});

describe("GET /api/students", () => {
  let tenant: TestTenant;
  let token: string;
  let studentId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);
    const { batchId, classId } = await seedBatchAndClass(
      token,
      Date.now().toString(),
    );
    const res = await makeAgent()
      .post("/api/students")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "List Student",
        classId,
        batchId,
        admissionNumber: `LIST-${Date.now()}`,
        dob: "2009-07-04",
      });
    studentId = res.body.student.id as string;
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 + students array including all v3.5 fields", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/students")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.students)).toBe(true);
    const student = (res.body.students as { id: string }[]).find(
      (s) => s.id === studentId,
    );
    expect(student).toBeDefined();
    // v3.5 CR-13 required fields
    expect(student).toHaveProperty("loginId");
    expect(student).toHaveProperty("admissionNumber");
    expect(student).toHaveProperty("dob");
    expect(student).toHaveProperty("userId");
  });
});

describe("PUT /api/students/:id", () => {
  let tenant: TestTenant;
  let token: string;
  let studentId: string;
  let admissionNumber: string;
  let classId: string;
  let batchId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);
    ({ batchId, classId } = await seedBatchAndClass(
      token,
      `put-${Date.now()}`,
    ));
    admissionNumber = `PUT-${Date.now()}`;
    const dob = "2008-12-05";
    const res = await makeAgent()
      .post("/api/students")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Put Student", classId, batchId, admissionNumber, dob });
    studentId = res.body.student.id as string;
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("updates name — 200", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .put(`/api/students/${studentId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated Name" });
    expect(res.status).toBe(200);
    expect(res.body.student.name).toBe("Updated Name");
  });

  it("changing dob re-hashes password and student can log in with new credential", async () => {
    if (SKIP) return;
    const newDob = "2008-11-20"; // DDMMYYYY → 20112008
    const res = await makeAgent()
      .put(`/api/students/${studentId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ dob: newDob });
    expect(res.status).toBe(200);

    // Login with new derived password
    const newPassword = `${admissionNumber}20112008`;
    const loginRes = await makeAgent()
      .post("/api/auth/login")
      .send({
        email: `${admissionNumber.toLowerCase()}@${tenant.tenantSlug}.local`,
        password: newPassword,
        tenantSlug: tenant.tenantSlug,
      });
    expect(loginRes.status).toBe(200);
  });
});

describe("DELETE /api/students/:id and bulk", () => {
  let tenant: TestTenant;
  let token: string;
  let batchId: string;
  let classId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);
    ({ batchId, classId } = await seedBatchAndClass(
      token,
      `del-${Date.now()}`,
    ));
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("soft-deletes a student — 204", async () => {
    if (SKIP) return;
    const res1 = await makeAgent()
      .post("/api/students")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "ToDelete",
        classId,
        batchId,
        admissionNumber: `DEL-${Date.now()}`,
        dob: "2010-01-01",
      });
    const sid = res1.body.student.id as string;
    const res = await makeAgent()
      .delete(`/api/students/${sid}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  it("bulk-deletes students — 200 with deleted/failed arrays", async () => {
    if (SKIP) return;
    const [r1, r2] = await Promise.all([
      makeAgent()
        .post("/api/students")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Bulk1",
          classId,
          batchId,
          admissionNumber: `BULK1-${Date.now()}`,
          dob: "2010-02-02",
        }),
      makeAgent()
        .post("/api/students")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Bulk2",
          classId,
          batchId,
          admissionNumber: `BULK2-${Date.now()}`,
          dob: "2010-03-03",
        }),
    ]);
    const ids = [r1.body.student.id as string, r2.body.student.id as string];
    const res = await makeAgent()
      .delete("/api/students/bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids });
    expect(res.status).toBe(200);
    expect(res.body.deleted.length).toBe(2);
  });
});
