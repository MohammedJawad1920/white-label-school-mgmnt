/**
 * api/events.ts — Academic Calendar Events (v4.5 CR-37)
 *
 * Wraps POST/GET /api/events and PUT/DELETE /api/events/:eventId.
 * All operations are tenant-scoped via the Bearer token in apiClient.
 */

import { apiClient } from "./client";
import type {
  CreateEventRequest,
  CreateEventResponse,
  ListEventsResponse,
  UpdateEventRequest,
  UpdateEventResponse,
  EventType,
} from "@/types/api";

export interface ListEventsFilters {
  from?: string;
  to?: string;
  type?: EventType;
}

export const eventsApi = {
  // POST /api/events  — Admin only
  create: (data: CreateEventRequest) =>
    apiClient.post<CreateEventResponse>("/events", data).then((r) => r.data),

  // GET /api/events  — Admin, Teacher, Student
  list: (filters: ListEventsFilters = {}) =>
    apiClient
      .get<ListEventsResponse>("/events", { params: filters })
      .then((r) => r.data),

  // PUT /api/events/:eventId  — Admin only
  update: (eventId: string, data: UpdateEventRequest) =>
    apiClient
      .put<UpdateEventResponse>(`/events/${eventId}`, data)
      .then((r) => r.data),

  // DELETE /api/events/:eventId  — Admin only
  remove: (eventId: string) =>
    apiClient.delete(`/events/${eventId}`).then((r) => r.data),
};
