import { apiClient } from "./client";
import type {
  RecordClassAttendanceRequest,
  RecordClassAttendanceResponse,
  StudentAttendanceResponse,
  AttendanceSummaryResponse,
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
};
