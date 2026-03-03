/**
 * Integration tests: Attendance endpoints
 *
 * Covers:
 *   POST /api/attendance/record-class         — bulk record; 409 on duplicate
 *   GET  /api/students/:studentId/attendance  — paginated history (admin access)
 *   GET  /api/attendance/summary              — aggregate stats
 *
 * FREEZE INVARIANTS:
 *   - Feature guard: requires attendance (+ timetable) enabled
 *   - defaultStatus + exceptions pattern
 *   - UNIQUE(student_id, timeslot_id, date) → 409 ATTENDANCE_ALREADY_RECORDED
 *   - TIMESLOT_ENDED: cannot record for ended timeslot
 *   - NO_STUDENTS: 400 when class has no students
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
 * Full scaffold: subject + teacher + batch + class + student + timeslot.
 * Returns timeslotId + studentId.
 */
async function scaffoldAttendanceData(
  token: string,
  tenant: TestTenant,
): Promise<{ timeslotId: string; studentId: string; classId: string }> {
  const suffix = Date.now();

  // Create subject
  const subjectRes = await makeAgent()
    .post("/api/subjects")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: `ATT-Subj-${suffix}` });
  const subjectId = subjectRes.body.subject.id as string;

  // Create teacher user
  const teacherRes = await makeAgent()
    .post("/api/users")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: `ATT-Teacher-${suffix}`,
      email: `att-teacher-${suffix}@test.local`,
      password: "Teacher@Pass1",
      roles: ["Teacher"],
    });
  const teacherId = teacherRes.body.user.id as string;

  // Create batch + class
  const batchRes = await makeAgent()
    .post("/api/batches")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: `ATT-Batch-${suffix}`, startYear: 2024, endYear: 2025 });
  const batchId = batchRes.body.batch.id as string;

  const classRes = await makeAgent()
    .post("/api/classes")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: `ATT-Class-${suffix}`, batchId });
  const classId = classRes.body.class.id as string;

  // Create student (required — NO_STUDENTS would block attendance recording)
  const admissionNumber = `ATT-${suffix}`;
  const studentRes = await makeAgent()
    .post("/api/students")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: `ATT-Student-${suffix}`,
      classId,
      batchId,
      admissionNumber,
      dob: "2010-06-15",
    });
  const studentId = studentRes.body.student.id as string;

  // Create timeslot using the seeded period
  const tsRes = await makeAgent()
    .post("/api/timetable")
    .set("Authorization", `Bearer ${token}`)
    .send({
      classId,
      subjectId,
      teacherId,
      dayOfWeek: "Friday",
      periodNumber: tenant.periodNumber,
      effectiveFrom: "2024-01-01",
    });
  const timeslotId = tsRes.body.timeslot.id as string;

  return { timeslotId, studentId, classId };
}

describe("POST /api/attendance/record-class", () => {
  let tenant: TestTenant;
  let token: string;
  let timeslotId: string;
  let studentId: string;
  const testDate = "2024-09-02";

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);
    ({ timeslotId, studentId } = await scaffoldAttendanceData(token, tenant));
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("records attendance for class — 201 with counters", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/attendance/record-class")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timeSlotId: timeslotId,
        date: testDate,
        defaultStatus: "Present",
        exceptions: [{ studentId, status: "Late" }],
      });
    expect(res.status).toBe(201);
    expect(res.body.recorded).toBeGreaterThanOrEqual(1);
    expect(res.body.late).toBe(1); // the one student was set to Late via exception
    expect(res.body.present).toBe(0);
    expect(res.body).toHaveProperty("date", testDate);
  });

  it("returns 409 ATTENDANCE_ALREADY_RECORDED on duplicate date+timeslot", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/attendance/record-class")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timeSlotId: timeslotId,
        date: testDate, // same date as above
        defaultStatus: "Absent",
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ATTENDANCE_ALREADY_RECORDED");
  });

  it("returns 400 when required fields missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/attendance/record-class")
      .set("Authorization", `Bearer ${token}`)
      .send({ timeSlotId: timeslotId });
    expect(res.status).toBe(400);
  });

  it("returns 400 TIMESLOT_ENDED when timeslot has effectiveTo in the past", async () => {
    if (SKIP) return;
    // End the timeslot
    await makeAgent()
      .put(`/api/timetable/${timeslotId}/end`)
      .set("Authorization", `Bearer ${token}`)
      .send({ effectiveTo: "2024-09-01" });

    const anotherDate = "2024-09-05";
    const res = await makeAgent()
      .post("/api/attendance/record-class")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timeSlotId: timeslotId,
        date: anotherDate,
        defaultStatus: "Present",
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TIMESLOT_ENDED");
  });
});

describe("GET /api/students/:studentId/attendance", () => {
  let tenant: TestTenant;
  let token: string;
  let studentId: string;
  let timeslotId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);
    ({ timeslotId, studentId } = await scaffoldAttendanceData(token, tenant));

    // Seed attendance records for the student
    await makeAgent()
      .post("/api/attendance/record-class")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timeSlotId: timeslotId,
        date: "2024-10-01",
        defaultStatus: "Present",
      });
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with paginated records for admin", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/students/${studentId}/attendance`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.records)).toBe(true);
    expect(res.body).toHaveProperty("total");
    expect(res.body.records.length).toBeGreaterThanOrEqual(1);
  });

  it("returns 404 for unknown studentId", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/students/STU-no-such-id/attendance")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/attendance/summary", () => {
  let tenant: TestTenant;
  let token: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);
    const { timeslotId } = await scaffoldAttendanceData(token, tenant);

    // Seed one attendance session
    await makeAgent()
      .post("/api/attendance/record-class")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timeSlotId: timeslotId,
        date: "2024-11-01",
        defaultStatus: "Absent",
      });
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with summary array", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/attendance/summary?from=2024-11-01&to=2024-11-30")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("summary");
    expect(Array.isArray(res.body.summary)).toBe(true);
  });
});
