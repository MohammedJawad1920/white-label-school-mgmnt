/**
 * e2e/global-setup.ts
 *
 * Seeds test tenant, users, and data for E2E tests.
 * Runs once before all tests.
 *
 * Exports environment variables that all tests can access.
 */

import axios from "axios";

const API_BASE_URL =
  process.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";
const SUPERADMIN_EMAIL =
  process.env.E2E_SUPERADMIN_EMAIL || "admin@platform.com";
const SUPERADMIN_PASSWORD =
  process.env.E2E_SUPERADMIN_PASSWORD || "SuperAdmin@123";

export default async function globalSetup() {
  console.log("E2E Global Setup: seeding test data...");

  try {
    const suffix = Date.now();

    // Login as super-admin first (all tenant management endpoints are protected).
    const saLogin = await axios.post(`${API_BASE_URL}/super-admin/auth/login`, {
      email: SUPERADMIN_EMAIL,
      password: SUPERADMIN_PASSWORD,
    });
    const saToken = saLogin.data.token as string;

    const saClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        Authorization: `Bearer ${saToken}`,
      },
    });

    const adminEmail = `admin-e2e-${suffix}@test.local`;
    const adminPassword = "Admin@E2E123!";

    // Create tenant + first admin user.
    const tenantRes = await saClient.post(`/super-admin/tenants`, {
      name: "E2E Test School",
      slug: `e2e-test-${suffix}`,
      timezone: "Asia/Kolkata",
      admin: {
        name: "E2E Admin",
        email: adminEmail,
        password: adminPassword,
      },
    });

    const tenantId =
      (tenantRes.data.data?.tenant?.id as string | undefined) ||
      (tenantRes.data.tenant?.id as string | undefined);
    if (!tenantId) {
      throw new Error("Tenant creation response did not include tenant id");
    }

    console.log(`Created test tenant: ${tenantId}`);

    // Enable all tenant features required by E2E flows.
    const featureKeys = [
      "timetable",
      "attendance",
      "leave",
      "exams",
      "fees",
      "announcements",
      "assignments",
      "import",
      "guardian",
      "notifications",
    ] as const;
    for (const key of featureKeys) {
      await saClient.put(`/super-admin/tenants/${tenantId}/features/${key}`, {
        enabled: true,
      });
    }

    // Tenant-admin auth for tenant-scoped seed operations.
    const adminLogin = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: adminEmail,
      password: adminPassword,
      tenantId,
    });
    const adminToken = adminLogin.data.token as string;
    const adminClient = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    // Seed one batch/class/session/student so guardian/student flows have data.
    const now = new Date();
    const startYear = now.getFullYear();
    const endYear = startYear + 1;
    const sessionRes = await adminClient.post(`/academic-sessions`, {
      name: `E2E ${startYear}-${endYear}`,
      startDate: `${startYear}-06-01`,
      endDate: `${endYear}-05-31`,
    });
    const sessionId =
      (sessionRes.data.data?.id as string | undefined) ||
      (sessionRes.data.session?.id as string | undefined);
    if (!sessionId) {
      throw new Error("Session creation response did not include id");
    }
    await adminClient.put(`/academic-sessions/${sessionId}/activate`);

    const batchRes = await adminClient.post(`/batches`, {
      name: `E2E Batch ${startYear}`,
      startYear,
      endYear,
    });
    const batchId =
      (batchRes.data.data?.id as string | undefined) ||
      (batchRes.data.batch?.id as string | undefined);
    if (!batchId) {
      throw new Error("Batch creation response did not include id");
    }

    const classRes = await adminClient.post(`/classes`, {
      name: "E2E Class A",
      batchId,
    });
    const classId =
      (classRes.data.data?.id as string | undefined) ||
      (classRes.data.class?.id as string | undefined);
    if (!classId) {
      throw new Error("Class creation response did not include id");
    }

    const studentAdmission = `E2E${String(suffix).slice(-5)}`;
    const studentDob = "2012-01-15";
    const studentRes = await adminClient.post(`/students`, {
      name: "E2E Student",
      batchId,
      classId,
      admissionNumber: studentAdmission,
      dob: studentDob,
    });
    const student =
      (studentRes.data.data as { id: string; loginId: string } | undefined) ||
      (studentRes.data.student as { id: string; loginId: string } | undefined);
    if (!student?.id || !student.loginId) {
      throw new Error("Student creation response missing id/loginId");
    }

    // Teacher account
    const teacherRes = await adminClient.post(`/users`, {
      name: "E2E Teacher",
      email: `teacher-e2e-${suffix}@test.local`,
      password: "Teacher@E2E123!",
      roles: ["Teacher"],
    });
    const teacherEmail =
      (teacherRes.data.user?.email as string | undefined) ||
      (teacherRes.data.data?.email as string | undefined);
    if (!teacherEmail) {
      throw new Error("Teacher creation response missing email");
    }

    // Guardian account linked to student
    const guardianRes = await adminClient.post(`/guardians`, {
      studentId: student.id,
      name: "E2E Guardian",
      phone: "9999999999",
      email: `guardian-e2e-${suffix}@test.local`,
      relationship: "Parent",
      isPrimary: true,
      canSubmitLeave: true,
      createUserAccount: true,
    });
    const guardian = guardianRes.data.guardian as { email?: string } | undefined;
    const guardianEmail = guardian?.email;
    const guardianPassword = guardianRes.data.temporaryPassword as
      | string
      | undefined;
    if (!guardianEmail || !guardianPassword) {
      throw new Error(
        "Guardian creation response missing email/temporaryPassword",
      );
    }

    const studentPassword = `${studentAdmission}${studentDob
      .split("-")
      .reverse()
      .join("")}`;

    // Export environment variables for tests
    process.env.E2E_TENANT_ID = tenantId;
    process.env.E2E_ADMIN_EMAIL = adminEmail;
    process.env.E2E_ADMIN_PASSWORD = adminPassword;
    process.env.E2E_TEACHER_EMAIL = teacherEmail;
    process.env.E2E_TEACHER_PASSWORD = "Teacher@E2E123!";
    process.env.E2E_GUARDIAN_EMAIL = guardianEmail;
    process.env.E2E_GUARDIAN_PASSWORD = guardianPassword;
    process.env.E2E_STUDENT_EMAIL = student.loginId;
    process.env.E2E_STUDENT_PASSWORD = studentPassword;
    process.env.E2E_STUDENT_ID = student.id;
    process.env.E2E_SESSION_ID = sessionId;
    process.env.E2E_CLASS_ID = classId;
    process.env.E2E_BATCH_ID = batchId;

    console.log("E2E Global Setup complete");
  } catch (error) {
    console.error("E2E Global Setup failed:", error);
    process.exit(1);
  }
}
