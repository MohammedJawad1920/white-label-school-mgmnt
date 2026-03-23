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
  const res = await client.post("/leave", {
    studentId,
    startDate,
    endDate,
    reason: "E2E test leave",
  });
  return res.data.leave.id;
}

export async function approveLeave(
  client: AxiosInstance,
  leaveId: string,
): Promise<void> {
  await client.patch(`/leave/${leaveId}/approve`, {});
}

export async function publishExam(
  client: AxiosInstance,
  examId: string,
): Promise<void> {
  await client.patch(`/exams/${examId}`, {
    status: "published",
  });
}

export async function createFeeCharge(
  client: AxiosInstance,
  studentId: string,
  amount: number,
  dueDate: string,
): Promise<string> {
  const res = await client.post("/fees/charges", {
    studentId,
    amount,
    dueDate,
    description: "E2E test fee",
  });
  return res.data.charge.id;
}

export async function recordPayment(
  client: AxiosInstance,
  chargeId: string,
  amountPaid: number,
  paidAt: string,
): Promise<void> {
  await client.post(`/fees/charges/${chargeId}/payment`, {
    amountPaid,
    paidAt,
    method: "cash",
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
  await client.post(`/academic-sessions/${sessionId}/activate`, {});
}

export async function seedBatch(
  client: AxiosInstance,
  name: string,
  level: string,
): Promise<string> {
  const res = await client.post("/batches", {
    name,
    level,
  });
  return res.data.batch.id;
}

export async function seedClass(
  client: AxiosInstance,
  batchId: string,
  sessionId: string,
  name: string,
): Promise<string> {
  const res = await client.post("/classes", {
    batchId,
    sessionId,
    name,
  });
  return res.data.class.id;
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
    registerNumber,
    name,
  });
  return res.data.student.id;
}
