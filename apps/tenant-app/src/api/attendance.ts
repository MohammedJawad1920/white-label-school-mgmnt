import { apiClient } from "./client";
import type {
  RecordClassAttendanceRequest,
  RecordClassAttendanceResponse,
  StudentAttendanceResponse,
  StudentAttendanceSummaryResponse,
  AttendanceSummaryResponse,
  CorrectAttendanceRequest,
  CorrectAttendanceResponse,
  GetAttendanceStreaksResponse,
  GetAttendanceToppersResponse,
  AttendanceDailySummaryResponse,
  MonthlySheetResponse,
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

  // v4.5 CR-33: consecutive absent streaks per student×subject
  getStreaks: (timeSlotId: string) =>
    apiClient
      .get<GetAttendanceStreaksResponse>("/attendance/streaks", {
        params: { timeSlotId },
      })
      .then((r) => r.data),

  // v4.5 CR-34: ranked attendance percentages for a class+date range
  getToppers: (params: {
    classId: string;
    from: string;
    to: string;
    limit?: number;
    offset?: number;
  }) =>
    apiClient
      .get<GetAttendanceToppersResponse>("/attendance/toppers", { params })
      .then((r) => r.data),

  // v4.5 CR-35: per-slot attendance marking status for a class on a given date
  getDailySummary: (classId: string, date: string) =>
    apiClient
      .get<AttendanceDailySummaryResponse>("/attendance/daily-summary", {
        params: { classId, date },
      })
      .then((r) => r.data),

  // v4.5 CR-36: student×day attendance grid for a class+subject+month
  getMonthlySheet: (params: {
    classId: string;
    subjectId: string;
    year: number;
    month: number;
  }) =>
    apiClient
      .get<MonthlySheetResponse>("/attendance/monthly-sheet", { params })
      .then((r) => r.data),
};
