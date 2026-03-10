/**
 * Integration tests: Attendance analytics endpoints (v4.5 CR-33–36)
 *
 * Covers:
 *   GET /api/attendance/streaks         — consecutive absent streak per student
 *   GET /api/attendance/toppers         — students ranked by attendance %
 *   GET /api/attendance/daily-summary   — per-slot counts for a class on a date
 *   GET /api/attendance/monthly-sheet   — student × day × period grid
 *
 * FREEZE INVARIANTS:
 *   - All endpoints require attendance feature flag
 *   - daily-summary additionally requires timetable feature flag
 *   - Admin: full access to any class in tenant
 *   - Teacher: only timeslots/classes they are assigned to
 *   - Soft-deleted timeslots and students are excluded
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
 * Returns ids needed by analytics endpoints.
 */
async function scaffoldData(
  token: string,
  tenant: TestTenant,
): Promise<{
  timeslotId: string;
  studentId: string;
  classId: string;
  subjectId: string;
}> {
  const suffix = Date.now();

  const subjectRes = await makeAgent()
    .post("/api/subjects")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: `ANA-Subj-${suffix}` });
  const subjectId = subjectRes.body.subject.id as string;

  const teacherRes = await makeAgent()
    .post("/api/users")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: `ANA-Teacher-${suffix}`,
      email: `ana-teacher-${suffix}@test.local`,
      password: "Teacher@Pass1",
      roles: ["Teacher"],
    });
  const teacherId = teacherRes.body.user.id as string;

  const batchRes = await makeAgent()
    .post("/api/batches")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: `ANA-Batch-${suffix}`, startYear: 2024, endYear: 2025 });
  const batchId = batchRes.body.batch.id as string;

  const classRes = await makeAgent()
    .post("/api/classes")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: `ANA-Class-${suffix}`, batchId });
  const classId = classRes.body.class.id as string;

  const studentRes = await makeAgent()
    .post("/api/students")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: `ANA-Student-${suffix}`,
      classId,
      batchId,
      admissionNumber: `ANA-${suffix}`,
      dob: "2010-06-15",
    });
  const studentId = studentRes.body.student.id as string;

  // Timeslot on Friday (so daily-summary can target a Friday date)
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
  const timeslotId = tsRes.body.timeSlot.id as string;

  return { timeslotId, studentId, classId, subjectId };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/attendance/streaks  (CR-33)
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/attendance/streaks", () => {
  let tenant: TestTenant;
  let token: string;
  let timeslotId: string;
  let studentId: string;
  let classId: string;
  let subjectId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);
    ({ timeslotId, studentId, classId, subjectId } = await scaffoldData(
      token,
      tenant,
    ));

    // Record 2 consecutive absences so streak = 2
    await makeAgent()
      .post("/api/attendance/record-class")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timeSlotId: timeslotId,
        date: "2025-03-07",
        defaultStatus: "Absent",
      });
    await makeAgent()
      .post("/api/attendance/record-class")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timeSlotId: timeslotId,
        date: "2025-03-14",
        defaultStatus: "Absent",
      });
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with streaks array containing the student", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/attendance/streaks?timeSlotId=${timeslotId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("classId", classId);
    expect(res.body).toHaveProperty("subjectId", subjectId);
    expect(Array.isArray(res.body.streaks)).toBe(true);

    const entry = (
      res.body.streaks as Array<{
        studentId: string;
        consecutiveAbsentCount: number;
      }>
    ).find((s) => s.studentId === studentId);
    expect(entry).toBeDefined();
    expect(entry!.consecutiveAbsentCount).toBe(2);
  });

  it("returns 400 when timeSlotId is missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/attendance/streaks")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for unknown timeSlotId", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/attendance/streaks?timeSlotId=TS-no-such-id")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    if (SKIP) return;
    const res = await makeAgent().get(
      `/api/attendance/streaks?timeSlotId=${timeslotId}`,
    );
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/attendance/toppers  (CR-34)
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/attendance/toppers", () => {
  let tenant: TestTenant;
  let token: string;
  let classId: string;
  let studentId: string;
  let timeslotId: string;
  const from = "2025-01-01";
  const to = "2025-03-31";

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);
    ({ timeslotId, studentId, classId } = await scaffoldData(token, tenant));

    // Record one Present to give the student a non-null attendancePercentage
    await makeAgent()
      .post("/api/attendance/record-class")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timeSlotId: timeslotId,
        date: "2025-03-07",
        defaultStatus: "Present",
      });
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with toppers array and pagination meta", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/attendance/toppers?classId=${classId}&from=${from}&to=${to}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("classId", classId);
    expect(res.body).toHaveProperty("from", from);
    expect(res.body).toHaveProperty("to", to);
    expect(res.body).toHaveProperty("total");
    expect(Array.isArray(res.body.toppers)).toBe(true);
    expect(typeof res.body.limit).toBe("number");
    expect(typeof res.body.offset).toBe("number");
  });

  it("includes the seeded student with rank and attendancePercentage", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/attendance/toppers?classId=${classId}&from=${from}&to=${to}`)
      .set("Authorization", `Bearer ${token}`);
    const entry = (
      res.body.toppers as Array<{
        studentId: string;
        rank: number;
        attendancePercentage: number | null;
      }>
    ).find((s) => s.studentId === studentId);
    expect(entry).toBeDefined();
    expect(entry!.rank).toBe(1);
    expect(entry!.attendancePercentage).toBe(100);
  });

  it("returns 400 when required params are missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/attendance/toppers?classId=X")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for unknown classId", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(`/api/attendance/toppers?classId=CLS-no-such&from=${from}&to=${to}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("respects limit and offset pagination", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(
        `/api/attendance/toppers?classId=${classId}&from=${from}&to=${to}&limit=1&offset=0`,
      )
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.toppers.length).toBeLessThanOrEqual(1);
    expect(res.body.limit).toBe(1);
  });

  it("returns 401 when unauthenticated", async () => {
    if (SKIP) return;
    const res = await makeAgent().get(
      `/api/attendance/toppers?classId=${classId}&from=${from}&to=${to}`,
    );
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/attendance/daily-summary  (CR-35)
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/attendance/daily-summary", () => {
  let tenant: TestTenant;
  let token: string;
  let classId: string;
  let timeslotId: string;
  // 2025-03-07 is a Friday — matches the timeslot's dayOfWeek
  const fridayDate = "2025-03-07";

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);
    ({ timeslotId, classId } = await scaffoldData(token, tenant));

    // Record attendance for that Friday so a slot appears as attendanceMarked
    await makeAgent()
      .post("/api/attendance/record-class")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timeSlotId: timeslotId,
        date: fridayDate,
        defaultStatus: "Present",
      });
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with slots array for the class on that date", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(
        `/api/attendance/daily-summary?classId=${classId}&date=${fridayDate}`,
      )
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("classId", classId);
    expect(res.body).toHaveProperty("date", fridayDate);
    expect(res.body).toHaveProperty("dayOfWeek", "Friday");
    expect(Array.isArray(res.body.slots)).toBe(true);
  });

  it("marks the attendance-recorded slot as attendanceMarked: true", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(
        `/api/attendance/daily-summary?classId=${classId}&date=${fridayDate}`,
      )
      .set("Authorization", `Bearer ${token}`);
    const slot = (
      res.body.slots as Array<{
        timeSlotId: string;
        attendanceMarked: boolean;
      }>
    ).find((s) => s.timeSlotId === timeslotId);
    expect(slot).toBeDefined();
    expect(slot!.attendanceMarked).toBe(true);
  });

  it("returns empty slots array for a non-school day (Saturday)", async () => {
    if (SKIP) return;
    const saturdayDate = "2025-03-08"; // Saturday — no timeslots
    const res = await makeAgent()
      .get(
        `/api/attendance/daily-summary?classId=${classId}&date=${saturdayDate}`,
      )
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.slots).toHaveLength(0);
  });

  it("returns 400 when required params are missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get("/api/attendance/daily-summary?classId=X")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for unknown classId", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(
        `/api/attendance/daily-summary?classId=CLS-no-such&date=${fridayDate}`,
      )
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    if (SKIP) return;
    const res = await makeAgent().get(
      `/api/attendance/daily-summary?classId=${classId}&date=${fridayDate}`,
    );
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/attendance/monthly-sheet  (CR-36)
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/attendance/monthly-sheet", () => {
  let tenant: TestTenant;
  let token: string;
  let classId: string;
  let subjectId: string;
  let studentId: string;
  let timeslotId: string;

  beforeAll(async () => {
    if (SKIP) return;
    tenant = await createTestTenant();
    token = await loginAsAdmin(tenant);
    ({ timeslotId, studentId, classId, subjectId } = await scaffoldData(
      token,
      tenant,
    ));

    // Seed an attendance record in March 2025 for the student
    await makeAgent()
      .post("/api/attendance/record-class")
      .set("Authorization", `Bearer ${token}`)
      .send({
        timeSlotId: timeslotId,
        date: "2025-03-07",
        defaultStatus: "Present",
      });
  });

  afterAll(async () => {
    if (SKIP) return;
    await cleanupTenant(tenant.tenantId);
  });

  it("returns 200 with student grid for the month", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(
        `/api/attendance/monthly-sheet?classId=${classId}&subjectId=${subjectId}&year=2025&month=3`,
      )
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("classId", classId);
    expect(res.body).toHaveProperty("subjectId", subjectId);
    expect(res.body).toHaveProperty("year", 2025);
    expect(res.body).toHaveProperty("month", 3);
    expect(res.body).toHaveProperty("daysInMonth", 31);
    expect(Array.isArray(res.body.students)).toBe(true);
  });

  it("includes the seeded student with attendance entry on day 7", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(
        `/api/attendance/monthly-sheet?classId=${classId}&subjectId=${subjectId}&year=2025&month=3`,
      )
      .set("Authorization", `Bearer ${token}`);
    const student = (
      res.body.students as Array<{
        studentId: string;
        days: Record<string, Array<{ timeSlotId: string; status: string }>>;
      }>
    ).find((s) => s.studentId === studentId);
    expect(student).toBeDefined();
    // Day 7 should have one entry with status Present
    const day7 = student!.days["7"];
    expect(Array.isArray(day7)).toBe(true);
    if (!day7) return; // guard for type-narrowing
    expect(day7.length).toBeGreaterThanOrEqual(1);
    expect(day7[0]!.status).toBe("Present");
  });

  it("returns 400 when required params are missing", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(
        `/api/attendance/monthly-sheet?classId=${classId}&subjectId=${subjectId}&year=2025`,
      )
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid month value", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(
        `/api/attendance/monthly-sheet?classId=${classId}&subjectId=${subjectId}&year=2025&month=13`,
      )
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for unknown classId", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(
        `/api/attendance/monthly-sheet?classId=CLS-no-such&subjectId=${subjectId}&year=2025&month=3`,
      )
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown subjectId", async () => {
    if (SKIP) return;
    const res = await makeAgent()
      .get(
        `/api/attendance/monthly-sheet?classId=${classId}&subjectId=SUB-no-such&year=2025&month=3`,
      )
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    if (SKIP) return;
    const res = await makeAgent().get(
      `/api/attendance/monthly-sheet?classId=${classId}&subjectId=${subjectId}&year=2025&month=3`,
    );
    expect(res.status).toBe(401);
  });
});
