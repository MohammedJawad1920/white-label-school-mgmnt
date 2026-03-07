import { apiClient } from "./client";
import type {
  RecordClassAttendanceRequest,
  RecordClassAttendanceResponse,
  StudentAttendanceResponse,
  StudentAttendanceSummaryResponse,
  AttendanceSummaryResponse,
  CorrectAttendanceRequest,
  CorrectAttendanceResponse,
} from "@/types/api";

export interface StudentAttendanceFilters {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}
export interface AttendanceSummaryFilters {
  classId?: string;
  from: string;
  to: string;
}

export const attendanceApi = {
  recordClass: (data: RecordClassAttendanceRequest) =>
    apiClient
      .post<RecordClassAttendanceResponse>("/attendance/record-class", data)
      .then((r) => r.data),
  getStudentHistory: (
    studentId: string,
    filters: StudentAttendanceFilters = {},
  ) =>
    apiClient
      .get<StudentAttendanceResponse>(`/students/${studentId}/attendance`, {
        params: filters,
      })
      .then((r) => r.data),
  getSummary: (filters: AttendanceSummaryFilters) =>
    apiClient
      .get<AttendanceSummaryResponse>("/attendance/summary", {
        params: filters,
      })
      .then((r) => r.data),
  // v3.4 CR-09: correct a single attendance record
  correctRecord: (recordId: string, data: CorrectAttendanceRequest) =>
    apiClient
      .put<CorrectAttendanceResponse>(`/attendance/${recordId}`, data)
      .then((r) => r.data),
  // CR-25: monthly attendance summary for a student
  getStudentSummary: (studentId: string, year: number, month: number) =>
    apiClient
      .get<StudentAttendanceSummaryResponse>(
        `/students/${studentId}/attendance/summary`,
        { params: { year, month } },
      )
      .then((r) => r.data),
};
