/**
 * Integration tests: Attendance endpoints
 *
 * Covers:
 *   POST /api/v1/attendance/record-class         — bulk record; UPSERT on duplicate
 *   GET  /api/v1/students/:studentId/attendance  — paginated history (admin access)
 *   GET  /api/v1/attendance/summary              — aggregate stats
 *
 * FREEZE INVARIANTS:
 *   - Feature guard: requires attendance (+ timetable) enabled
 *   - students array payload pattern
 *   - UNIQUE(student_id, timeslot_id, date) with UPSERT updates existing records
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
  const res = await makeAgent().post("/api/v1/auth/login").send({
    email: tenant.adminEmail,
    password: tenant.adminPassword,
    tenantId: tenant.tenantId,
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
    .post("/api/v1/subjects")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: `ATT-Subj-${suffix}` });
  const subjectId = subjectRes.body.subject.id as string;

  // Create teacher user
  const teacherRes = await makeAgent()
    .post("/api/v1/users")
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
    .post("/api/v1/batches")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: `ATT-Batch-${suffix}`, startYear: 2024, endYear: 2025 });
  const batchId = batchRes.body.batch.id as string;

  const classRes = await makeAgent()
    .post("/api/v1/classes")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: `ATT-Class-${suffix}`, batchId });
  const classId = classRes.body.class.id as string;

  // Create student (required — NO_STUDENTS would block attendance recording)
  const admissionNumber = `ATT-${suffix}`;
  const studentRes = await makeAgent()
    .post("/api/v1/students")
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
    .post("/api/v1/timetable")
    .set("Authorization", `Bearer ${token}`)
    .send({
      classId,
      subjectId,
      teacherId,
      dayOfWeek: "Friday",
      periodNumber: tenant.periodNumber,
      effectiveFrom: "2024-01-01",
    });
  const timeslotId = tsRes.body.timeSlot.id as string;

  return { timeslotId, studentId, classId };
}

describe("POST /api/v1/attendance/record-class", () => {
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

  it("records attendance for class — 200 with counters", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/attendance/record-class")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timeslotId,
        date: testDate,
        students: [{ studentId, status: "Late" }],
      });
    expect(res.status).toBe(200);
    expect(res.body.recorded).toBeGreaterThanOrEqual(1);
    expect(res.body.late).toBe(1); // the one student was set to Late via exception
    expect(res.body.present).toBe(0);
  });

  it("upserts on duplicate date+timeslot", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/attendance/record-class")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timeslotId,
        date: testDate, // same date as above
        students: [{ studentId, status: "Absent" }],
      });
    expect(res.status).toBe(200);
    expect(res.body.absent).toBe(1);
  });

  it("returns 400 when required fields missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .post("/api/v1/attendance/record-class")
      .set("Authorization", `Bearer ${token}`)
      .send({ timeslotId });
    expect(res.status).toBe(422);
  });

  it("returns 404 when timeslot has been deleted (CR-31: effectiveTo removed)", async () => {
    if (SKIP) return;
    // Soft-delete the timeslot (PUT /end removed in CR-31; deletion replaces it)
    await makeAgent()
      .delete(`/api/v1/timetable/${timeslotId}`)
      .set("Authorization", `Bearer ${token}`);

    const anotherDate = "2024-09-05";
    const res = await makeAgent()
      .post("/api/v1/attendance/record-class")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timeslotId,
        date: anotherDate,
        students: [{ studentId, status: "Present" }],
      });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/students/:studentId/attendance", () => {
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
      .post("/api/v1/attendance/record-class")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timeslotId,
        date: "2024-10-01",
        students: [{ studentId, status: "Present" }],
      });
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with paginated records for admin", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/v1/students/${studentId}/attendance`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.records)).toBe(true);
    expect(res.body).toHaveProperty("pagination.total");
    expect(res.body.records.length).toBeGreaterThanOrEqual(1);
  });

  it("returns 404 for unknown studentId", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/students/00000000-0000-0000-0000-000000000020/attendance")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/attendance/summary", () => {
  let tenant: TestTenant;
  let token: string;
  let classId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);
    const {
      timeslotId,
      classId: cid,
      studentId,
    } = await scaffoldAttendanceData(token, tenant);
    classId = cid;

    // Seed one attendance session
    await makeAgent()
      .post("/api/v1/attendance/record-class")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timeslotId,
        date: "2024-11-01",
        students: [{ studentId, status: "Absent" }],
      });
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with summary object", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(
        `/api/v1/attendance/summary?classId=${classId}&from=2024-11-01&to=2024-11-30`,
      )
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("summary");
    expect(res.body.summary).toHaveProperty("totalClasses");
    expect(res.body.summary).toHaveProperty("averageAttendanceRate");
  });
});

// ── GET /api/v1/attendance/absentees (CR-39 / CR-41) ──────────────────────────────
describe("GET /api/v1/attendance/absentees", () => {
  let tenant: TestTenant;
  let adminToken: string;
  let teacherToken: string;
  let studentRoleToken: string;
  let timeslotId: string;
  const testDate = "2024-12-06";

  /**
   * Scaffold data with known teacher credentials so we can obtain a teacher JWT.
   * Returns timeslotId and the teacher email/password.
   */
  async function scaffoldWithTeacher(
    tkn: string,
    tn: TestTenant,
  ): Promise<{
    timeslotId: string;
    teacherEmail: string;
    studentId: string;
    studentAdmissionNumber: string;
    studentDob: string;
  }> {
    const suffix = Date.now();
    const teacherPassword = "Teacher@Abs1";
    const teacherEmail = `abs-teacher-${suffix}@test.local`;

    const subjectRes = await makeAgent()
      .post("/api/v1/subjects")
      .set("Authorization", `Bearer ${tkn}`)
      .send({ name: `ABS-Subj-${suffix}` });
    const subjectId = subjectRes.body.subject.id as string;

    const teacherRes = await makeAgent()
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${tkn}`)
      .send({
        name: `ABS-Teacher-${suffix}`,
        email: teacherEmail,
        password: teacherPassword,
        roles: ["Teacher"],
      });
    const teacherId = teacherRes.body.user.id as string;

    const batchRes = await makeAgent()
      .post("/api/v1/batches")
      .set("Authorization", `Bearer ${tkn}`)
      .send({ name: `ABS-Batch-${suffix}`, startYear: 2024, endYear: 2025 });
    const batchId = batchRes.body.batch.id as string;

    const classRes = await makeAgent()
      .post("/api/v1/classes")
      .set("Authorization", `Bearer ${tkn}`)
      .send({ name: `ABS-Class-${suffix}`, batchId });
    const classId = classRes.body.class.id as string;

    const studentAdmissionNumber = `ABS-${suffix}`;
    const studentDob = "2010-06-15";
    const studentRes = await makeAgent()
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${tkn}`)
      .send({
        name: `ABS-Student-${suffix}`,
        classId,
        batchId,
        admissionNumber: studentAdmissionNumber,
        dob: studentDob,
      });
    const studentId = studentRes.body.student.id as string;

    const tsRes = await makeAgent()
      .post("/api/v1/timetable")
      .set("Authorization", `Bearer ${tkn}`)
      .send({
        classId,
        subjectId,
        teacherId,
        dayOfWeek: "Monday",
        periodNumber: tn.periodNumber,
        effectiveFrom: "2024-01-01",
      });
    const tsId = tsRes.body.timeSlot.id as string;

    return {
      timeslotId: tsId,
      teacherEmail,
      studentId,
      studentAdmissionNumber,
      studentDob,
    };
  }

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    adminToken = await loginAsAdmin(tenant);

    const {
      timeslotId: tsId,
      teacherEmail,
      studentId,
      studentAdmissionNumber,
      studentDob,
    } = await scaffoldWithTeacher(adminToken, tenant);
    timeslotId = tsId;

    // Teacher login
    const teacherLoginRes = await makeAgent().post("/api/v1/auth/login").send({
      email: teacherEmail,
      password: "Teacher@Abs1",
      tenantId: tenant.tenantId,
    });
    teacherToken = teacherLoginRes.body.token as string;

    // Student login (created via POST /students with auto-generated credentials)
    // loginId: {admissionNumber.toLowerCase()}@{tenantSlug}.local
    // password: {admissionNumber}{ddMMYYYY(dob)}
    const studentLoginId = `${studentAdmissionNumber.toLowerCase()}@${tenant.tenantSlug}.local`;
    // dob 2010-06-15 → ddMMYYYY → 15062010
    const dobParts = studentDob.split("-");
    const studentPassword = `${studentAdmissionNumber}${dobParts[2]}${dobParts[1]}${dobParts[0]}`;
    const studentLoginRes = await makeAgent().post("/api/v1/auth/login").send({
      email: studentLoginId,
      password: studentPassword,
      tenantId: tenant.tenantId,
    });
    studentRoleToken = studentLoginRes.body.token as string;

    // Record attendance (all absent) so absentees endpoint has data
    await makeAgent()
      .post("/api/v1/attendance/record-class")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        timeslotId,
        date: testDate,
        students: [{ studentId, status: "Absent" }],
      });
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with absentee list for Admin (CR-39)", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(
        `/api/v1/attendance/absentees?timeSlotId=${timeslotId}&date=${testDate}`,
      )
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("absentees");
    expect(Array.isArray(res.body.absentees)).toBe(true);
    expect(res.body.absentees.length).toBeGreaterThan(0);
    // Validate shape of each absentee entry
    const entry = res.body.absentees[0] as Record<string, unknown>;
    expect(entry).toHaveProperty("studentId");
    expect(entry).toHaveProperty("studentName");
    expect(entry).toHaveProperty("admissionNumber");
    expect(entry).toHaveProperty("consecutiveAbsentCount");
  });

  it("returns 200 for Teacher on any class slot (CR-41: no ownership restriction)", async () => {
    if (SKIP) return;
    // teacherToken belongs to a Teacher user; timeslotId belongs to the scaffold class
    // CR-41: Teacher can access absentees for any class (not just own timeslots)
    const res = await makeAgent()
      .get(
        `/api/v1/attendance/absentees?timeSlotId=${timeslotId}&date=${testDate}`,
      )
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("absentees");
  });

  it("returns 403 for Student role", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(
        `/api/v1/attendance/absentees?timeSlotId=${timeslotId}&date=${testDate}`,
      )
      .set("Authorization", `Bearer ${studentRoleToken}`);
    expect(res.status).toBe(403);
  });

  it("returns 200 with empty absentees for unmarked slot (different date)", async () => {
    if (SKIP) return;
    // Use a date that has no attendance records → no absence rows → empty array
    const unmarkedDate = "2024-12-20";
    const res = await makeAgent()
      .get(
        `/api/v1/attendance/absentees?timeSlotId=${timeslotId}&date=${unmarkedDate}`,
      )
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.absentees).toEqual([]);
  });

  it("returns 404 for deleted timeslot", async () => {
    if (SKIP) return;
    // Soft-delete the timeslot
    await makeAgent()
      .delete(`/api/v1/timetable/${timeslotId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    const res = await makeAgent()
      .get(
        `/api/v1/attendance/absentees?timeSlotId=${timeslotId}&date=${testDate}`,
      )
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 when required query params are missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/v1/attendance/absentees")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it("returns 401 for unauthenticated request", async () => {
    if (SKIP) return;
    const res = await makeAgent().get(
      `/api/v1/attendance/absentees?timeSlotId=${timeslotId}&date=${testDate}`,
    );
    expect(res.status).toBe(401);
  });
});
