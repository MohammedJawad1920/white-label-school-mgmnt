import { apiClient } from "./client";
import type {
  GuardianChild,
  GuardianAttendanceCalendar,
  LeaveRequest,
  FeeCharge,
  Assignment,
  ExamStudentSummary,
} from "@/types/api";

export const guardianPortalApi = {
  listChildren: () =>
    apiClient
      .get<{ children: GuardianChild[] }>("/guardian/children")
      .then((r) => r.data),

  childAttendance: (studentId: string, month: string) =>
    apiClient
      .get<GuardianAttendanceCalendar>(
        `/guardian/children/${studentId}/attendance`,
        { params: { month } },
      )
      .then((r) => r.data),

  childTimetable: (studentId: string) =>
    apiClient
      .get<{
        periods: Record<string, unknown>[];
      }>(`/guardian/children/${studentId}/timetable`)
      .then((r) => r.data),

  childResults: (studentId: string, sessionId?: string) =>
    apiClient
      .get<{
        results: ExamStudentSummary[];
      }>(`/guardian/children/${studentId}/results`, { params: sessionId ? { sessionId } : undefined })
      .then((r) => r.data),

  childFees: (studentId: string, sessionId?: string) =>
    apiClient
      .get<{
        charges: FeeCharge[];
      }>(`/guardian/children/${studentId}/fees`, { params: sessionId ? { sessionId } : undefined })
      .then((r) => r.data),

  childAssignments: (studentId: string, sessionId?: string) =>
    apiClient
      .get<{
        assignments: Assignment[];
      }>(`/guardian/children/${studentId}/assignments`, { params: sessionId ? { sessionId } : undefined })
      .then((r) => r.data),

  childLeave: (studentId: string) =>
    apiClient
      .get<{ leaves: LeaveRequest[] }>(`/guardian/children/${studentId}/leave`)
      .then((r) => r.data),
};
