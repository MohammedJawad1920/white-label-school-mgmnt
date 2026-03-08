import { apiClient } from "./client";
import type {
  ListTimetableResponse,
  CreateTimeSlotRequest,
  CreateTimeSlotResponse,
} from "@/types/api";

export interface TimetableFilters {
  dayOfWeek?: string;
  teacherId?: string;
  classId?: string;
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
  deleteSlot: (timeSlotId: string) =>
    apiClient.delete(`/timetable/${timeSlotId}`).then(() => undefined),
};
