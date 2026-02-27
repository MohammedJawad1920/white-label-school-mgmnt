import { apiClient } from "./client";
import type {
  ListTimetableResponse,
  CreateTimeSlotRequest,
  CreateTimeSlotResponse,
  EndTimeSlotRequest,
  EndTimeSlotResponse,
} from "@/types/api";

export interface TimetableFilters {
  date?: string;
  dayOfWeek?: string;
  teacherId?: string;
  classId?: string;
  status?: "Active" | "All";
}

export const timetableApi = {
  list: (filters: TimetableFilters = {}) =>
    apiClient
      .get<ListTimetableResponse>("/timetable", { params: filters })
      .then((r) => r.data),
  create: (data: CreateTimeSlotRequest) =>
    apiClient
      .post<CreateTimeSlotResponse>("/timetable", data)
      .then((r) => r.data),
  end: (timeSlotId: string, data: EndTimeSlotRequest) =>
    apiClient
      .put<EndTimeSlotResponse>(`/timetable/${timeSlotId}/end`, data)
      .then((r) => r.data),
};
