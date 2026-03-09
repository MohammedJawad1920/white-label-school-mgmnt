/**
 * useTodaySlots — derives today's timetable slots from TanStack Query cache.
 *
 * Freeze §5.6 HK inventory:
 *   - No extra fetch — reads the existing timetableToday cache entry only.
 *   - Shared between Dashboard (upcoming classes widget) and Record Attendance.
 *   - Teacher: further filtered client-side by teacherId === user.id.
 *   - Student/Admin: backend already scopes the cached data by context.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { QUERY_KEYS } from "@/utils/queryKeys";
import type { TimeSlot, DayOfWeek, ListTimetableResponse } from "@/types/api";
import type { Role } from "@/config/nav";

const DAYS_OF_WEEK: DayOfWeek[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function useTodaySlots(role: Role): TimeSlot[] {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const today = new Date();
  const todayDateString = today.toISOString().slice(0, 10);
  const todayDayOfWeek = DAYS_OF_WEEK[today.getDay()];

  const cached = queryClient.getQueryData<ListTimetableResponse>(
    QUERY_KEYS.timetableToday(todayDateString),
  );

  const slots = cached?.timetable ?? [];

  // Guard: filter by today's day in case the cache holds a broader dataset
  const todaySlots = slots.filter((s) => s.dayOfWeek === todayDayOfWeek);

  if (role === "Teacher" && user?.id) {
    return todaySlots.filter((s) => s.teacherId === user.id);
  }

  return todaySlots;
}
