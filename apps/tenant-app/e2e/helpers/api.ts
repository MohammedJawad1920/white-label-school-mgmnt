/**
 * e2e/helpers/api.ts
 *
 * API helpers for E2E tests.
 * Provides functions to seed/prepare test data via API calls.
 */

import axios, { AxiosInstance } from "axios";

const API_BASE_URL =
  process.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

export function createApiClient(token: string): AxiosInstance {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getAdminToken(): Promise<string> {
  const res = await axios.post(`${API_BASE_URL}/auth/login`, {
    email: process.env.E2E_ADMIN_EMAIL,
    password: process.env.E2E_ADMIN_PASSWORD,
    tenantId: process.env.E2E_TENANT_ID,
  });
  return res.data.token;
}

export async function getTeacherToken(): Promise<string> {
  const res = await axios.post(`${API_BASE_URL}/auth/login`, {
    email: process.env.E2E_TEACHER_EMAIL,
    password: process.env.E2E_TEACHER_PASSWORD,
    tenantId: process.env.E2E_TENANT_ID,
  });
  return res.data.token;
}

export async function seedLeaveRequest(
  client: AxiosInstance,
  studentId: string,
  startDate: string,
  endDate: string,
): Promise<string> {
  const current = await client.get("/academic-sessions/current");
  const sessionId = current.data.data?.id as string;
  const res = await client.post("/leave", {
    studentId,
    sessionId,
    leaveType: "HomeVisit",
    durationType: startDate === endDate ? "SingleDay" : "MultiDay",
    startDate,
    endDate,
    reason: "E2E test leave",
    expectedReturnAt: `${endDate}T18:00:00.000Z`,
  });
  return (res.data.data?.id as string | undefined) ?? (res.data.leave?.id as string);
}

export async function approveLeave(
  client: AxiosInstance,
  leaveId: string,
): Promise<void> {
  await client.put(`/leave/${leaveId}/approve`, {});
}

export async function publishExam(
  client: AxiosInstance,
  examId: string,
): Promise<void> {
  await client.put(`/exams/${examId}/publish`);
}

export async function createFeeCharge(
  client: AxiosInstance,
  studentId: string,
  amount: number,
  dueDate: string,
): Promise<string> {
  const current = await client.get("/academic-sessions/current");
  const sessionId = current.data.data?.id as string;
  const res = await client.post("/fees/charges", {
    studentId,
    sessionId,
    category: "TUITION",
    amount,
    dueDate,
    description: "E2E test fee",
  });
  return (res.data.data?.id as string | undefined) ?? (res.data.charge?.id as string);
}

export async function recordPayment(
  client: AxiosInstance,
  chargeId: string,
  amountPaid: number,
  paidAt: string,
): Promise<void> {
  await client.post(`/fees/charges/${chargeId}/payments`, {
    amountPaid,
    paidAt,
    paymentMode: "Cash",
  });
}

export async function seedAcademicSession(
  client: AxiosInstance,
  name: string,
  startDate: string,
  endDate: string,
): Promise<string> {
  const res = await client.post("/academic-sessions", {
    name,
    startDate,
    endDate,
  });
  return res.data.session.id;
}

export async function activateSession(
  client: AxiosInstance,
  sessionId: string,
): Promise<void> {
  await client.put(`/academic-sessions/${sessionId}/activate`);
}

export async function seedBatch(
  client: AxiosInstance,
  name: string,
  _level: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const res = await client.post("/batches", {
    name,
    startYear: year,
    endYear: year + 1,
  });
  return (res.data.data?.id as string | undefined) ?? (res.data.batch?.id as string);
}

export async function seedClass(
  client: AxiosInstance,
  batchId: string,
  _sessionId: string,
  name: string,
): Promise<string> {
  const res = await client.post("/classes", {
    batchId,
    name,
  });
  return (res.data.data?.id as string | undefined) ?? (res.data.class?.id as string);
}

export async function seedStudent(
  client: AxiosInstance,
  batchId: string,
  classId: string,
  registerNumber: string,
  name: string,
): Promise<string> {
  const res = await client.post("/students", {
    batchId,
    classId,
    admissionNumber: registerNumber,
    dob: "2012-01-15",
    name,
  });
  return (res.data.data?.id as string | undefined) ?? (res.data.student?.id as string);
}
