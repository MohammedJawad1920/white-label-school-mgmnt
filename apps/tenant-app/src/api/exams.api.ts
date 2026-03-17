import { apiClient } from "./client";
import type {
  Exam,
  ExamSubject,
  ExamResult,
  ConsolidatedResults,
  ExamStudentSummary,
  ExternalResult,
  GradeBoundary,
} from "@/types/api";

export interface ExamFilters {
  sessionId?: string;
  classId?: string;
  status?: string;
}

export const examsApi = {
  create: (data: {
    name: string;
    type: string;
    classId: string;
    sessionId: string;
    gradeBoundaries?: GradeBoundary[];
  }) => apiClient.post<Exam>("/exams", data).then((r) => r.data),

  list: (filters?: ExamFilters) =>
    apiClient
      .get<{ exams: Exam[] }>("/exams", { params: filters })
      .then((r) => r.data),

  get: (id: string) => apiClient.get<Exam>(`/exams/${id}`).then((r) => r.data),

  update: (id: string, data: Partial<{ name: string; type: string }>) =>
    apiClient.put<Exam>(`/exams/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete<{ message: string }>(`/exams/${id}`).then((r) => r.data),

  publish: (id: string) =>
    apiClient.put<Exam>(`/exams/${id}/publish`).then((r) => r.data),

  unpublish: (id: string) =>
    apiClient.put<Exam>(`/exams/${id}/unpublish`).then((r) => r.data),

  addSubject: (
    examId: string,
    data: { subjectId: string; totalMarks: number; passMarks: number },
  ) =>
    apiClient
      .post<ExamSubject>(`/exams/${examId}/subjects`, data)
      .then((r) => r.data),

  updateSubject: (
    examId: string,
    subjectId: string,
    data: { totalMarks?: number; passMarks?: number },
  ) =>
    apiClient
      .put<ExamSubject>(`/exams/${examId}/subjects/${subjectId}`, data)
      .then((r) => r.data),

  removeSubject: (examId: string, subjectId: string) =>
    apiClient
      .delete<{ message: string }>(`/exams/${examId}/subjects/${subjectId}`)
      .then((r) => r.data),

  getMarks: (examId: string, subjectId: string) =>
    apiClient
      .get<{
        marks: ExamResult[];
      }>(`/exams/${examId}/subjects/${subjectId}/marks`)
      .then((r) => r.data),

  enterMarks: (
    examId: string,
    subjectId: string,
    marks: { studentId: string; marksObtained?: number; isAbsent?: boolean }[],
  ) =>
    apiClient
      .put<{
        message: string;
      }>(`/exams/${examId}/subjects/${subjectId}/marks`, { marks })
      .then((r) => r.data),

  getResults: (id: string) =>
    apiClient
      .get<ConsolidatedResults>(`/exams/${id}/results`)
      .then((r) => r.data),

  getStudentResult: (examId: string, studentId: string) =>
    apiClient
      .get<ExamStudentSummary>(`/exams/${examId}/results/${studentId}`)
      .then((r) => r.data),

  /** Returns a URL string for direct download — does not call apiClient */
  reportCardUrl: (examId: string, studentId: string) =>
    `/exams/${examId}/report-card/${studentId}`,

  /** Returns a URL string for direct download — does not call apiClient */
  allReportCardsUrl: (examId: string) => `/exams/${examId}/report-cards`,

  // External results
  listExternal: (filters?: { studentId?: string; sessionId?: string }) =>
    apiClient
      .get<{
        results: ExternalResult[];
      }>("/external-results", { params: filters })
      .then((r) => r.data),

  createExternal: (data: {
    studentId: string;
    examName: string;
    examBody: string;
    year: number;
    grade?: string;
    marksObtained?: number;
    totalMarks?: number;
    remarks?: string;
  }) =>
    apiClient
      .post<ExternalResult>("/external-results", data)
      .then((r) => r.data),
};
