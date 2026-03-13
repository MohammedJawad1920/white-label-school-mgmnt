import { apiClient } from "./client";
import type {
  AcademicSession,
  CreateSessionRequest,
  CreateSessionResponse,
  ListSessionsResponse,
  CopyTimetableRequest,
  CopyTimetableResponse,
  TransitionPreviewRequest,
  PromotionPreview,
  TransitionCommitRequest,
  TransitionCommitResponse,
  RollbackPromotionResponse,
} from "@/types/api";

/**
 * academicSessionsApi — Academic Sessions domain API client
 *
 * C-04fe: TransitionPreviewRequest.targetSessionId renamed → toSessionId (OpenAPI v5.0.2).
 *   Callers must now pass { toSessionId: '...' } not { targetSessionId: '...' }.
 * C-05fe: TransitionCommitRequest.previewId renamed → promotionPreviewId; batches array added.
 *   Callers must now pass { promotionPreviewId, batches: [...] }.
 * The API endpoint paths are unchanged.
 */
export const academicSessionsApi = {
  list: () =>
    apiClient
      .get<ListSessionsResponse>("/academic-sessions")
      .then((r) => r.data),

  /** H-04fe: fetch a single session by ID directly */
  getById: (id: string) =>
    apiClient
      .get<{ session: AcademicSession }>(`/academic-sessions/${id}`)
      .then((r) => r.data),

  getCurrent: () =>
    apiClient
      .get<AcademicSession>("/academic-sessions/current")
      .then((r) => r.data),

  create: (payload: CreateSessionRequest) =>
    apiClient
      .post<CreateSessionResponse>("/academic-sessions", payload)
      .then((r) => r.data),

  activate: (id: string) =>
    apiClient
      .put<{ session: AcademicSession }>(`/academic-sessions/${id}/activate`)
      .then((r) => r.data),

  close: (id: string) =>
    apiClient
      .put<{ session: AcademicSession }>(`/academic-sessions/${id}/close`)
      .then((r) => r.data),

  copyTimetable: (id: string, payload: CopyTimetableRequest) =>
    apiClient
      .post<CopyTimetableResponse>(
        `/academic-sessions/${id}/copy-timetable`,
        payload,
      )
      .then((r) => r.data),

  transitionPreview: (id: string, payload: TransitionPreviewRequest) =>
    apiClient
      .post<PromotionPreview>(
        `/academic-sessions/${id}/transition/preview`,
        payload,
      )
      .then((r) => r.data),

  transitionCommit: (id: string, payload: TransitionCommitRequest) =>
    apiClient
      .post<TransitionCommitResponse>(
        `/academic-sessions/${id}/transition/commit`,
        payload,
      )
      .then((r) => r.data),

  rollbackPromotion: (promotionLogId: string) =>
    apiClient
      .post<RollbackPromotionResponse>(`/promotions/${promotionLogId}/rollback`)
      .then((r) => r.data),
};
