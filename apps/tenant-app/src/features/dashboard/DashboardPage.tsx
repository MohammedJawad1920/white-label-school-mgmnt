/**
 * DashboardPage — Freeze §Screen: Dashboard (v4.5 CR-FE-016b/c/e/g)
 *
 * Role rules:
 *   Teacher → today's own slots + Class Rankings card (toppers, collapsed)
 *   Admin   → today's all slots + API-driven stat bar (daily-summary)
 *   Student → today's timetable (read-only) + live attendance history + streak badges
 *   All     → Upcoming Events card (CR-FE-016g)
 */
import { useNavigate } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import { timetableApi } from "@/api/timetable";
import { attendanceApi } from "@/api/attendance";
import { eventsApi } from "@/api/events";
import { useAuth } from "@/hooks/useAuth";
import { todayISO, todayDayOfWeek, formatDisplayDate } from "@/utils/dates";
import { parseApiError } from "@/utils/errors";
import { format, subDays } from "date-fns";
import type { Event, AttendanceTopper } from "@/types/api";

const TODAY = todayISO();
const THIRTY_DAYS_AGO = format(subDays(new Date(), 30), "yyyy-MM-dd");

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SlotSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-3 bg-muted rounded w-1/2" />
          <div className="h-3 bg-muted rounded w-2/5" />
        </div>
        <div className="h-8 w-32 bg-muted rounded" />
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Inline calendar SVG per Freeze §Screen: Dashboard empty state */}
      <svg
        className="h-16 w-16 text-muted-foreground/40 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <p className="text-base font-medium text-muted-foreground">
        No classes scheduled for today.
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        {todayDayOfWeek()}, {TODAY}
      </p>
    </div>
  );
}

// ── Feature disabled state ────────────────────────────────────────────────────
function FeatureDisabledState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <svg
        className="h-12 w-12 text-muted-foreground/40 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
        />
      </svg>
      <p className="text-base font-medium">
        Timetable feature not enabled for your school.
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        Contact your platform administrator to enable it.
      </p>
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <p className="text-sm text-muted-foreground mb-3">
        Failed to load timetable.
      </p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Tap to retry
      </button>
    </div>
  );
}

// ── Slot card ─────────────────────────────────────────────────────────────────
interface SlotCardProps {
  slot: {
    id: string;
    periodNumber: number;
    label?: string;
    startTime?: string;
    endTime?: string | null;
    className?: string;
    subjectName?: string;
    teacherName?: string;
    dayOfWeek: string;
  };
  onRecordAttendance: (slotId: string) => void;
}

function SlotCard({ slot, onRecordAttendance }: SlotCardProps) {
  const timeLabel =
    slot.startTime && slot.endTime
      ? `${slot.startTime} – ${slot.endTime}`
      : (slot.label ?? `Period ${slot.periodNumber}`);

  return (
    <article
      className="rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow"
      aria-label={`${slot.className ?? ""} ${slot.subjectName ?? ""} Period ${slot.periodNumber}`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1 min-w-0">
          {/* Period + time */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Period {slot.periodNumber}
            </span>
            <span className="text-xs text-muted-foreground">{timeLabel}</span>
          </div>
          {/* Class + subject */}
          <p className="text-sm font-medium truncate">
            {slot.className ?? "—"} · {slot.subjectName ?? "—"}
          </p>
          {/* Teacher */}
          {slot.teacherName && (
            <p className="text-xs text-muted-foreground truncate">
              {slot.teacherName}
            </p>
          )}
        </div>

        {/* Record Attendance CTA */}
        <button
          onClick={() => onRecordAttendance(slot.id)}
          aria-label={`Record attendance for ${slot.className ?? ""} ${slot.subjectName ?? ""} Period ${slot.periodNumber}`}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[36px]"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Record Attendance
        </button>
      </div>
    </article>
  );
}

// ── Upcoming Events card (all roles, CR-FE-016g) ─────────────────────────────
function UpcomingEventsCard() {
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const monthEnd = format(
    new Date(now.getFullYear(), now.getMonth() + 1, 0),
    "yyyy-MM-dd",
  );

  const { data, isLoading } = useQuery({
    queryKey: ["events", "upcoming", today],
    queryFn: () => eventsApi.list({ from: today, to: monthEnd }),
    staleTime: 10 * 60 * 1000,
  });

  const events = data?.events ?? [];

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-muted rounded w-2/3" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
      </div>
    );
  }

  function typeColor(type: Event["type"]) {
    switch (type) {
      case "Holiday":
        return "bg-red-100 text-red-700";
      case "Exam":
        return "bg-amber-100 text-amber-700";
      case "Event":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-muted text-muted-foreground";
    }
  }

  return (
    <section
      aria-label="Upcoming events"
      className="rounded-lg border bg-card p-4"
    >
      <h2 className="text-sm font-semibold mb-3">Upcoming Events</h2>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">No events this month.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <li key={ev.id} className="flex items-start gap-2 text-sm">
              <span
                className={`mt-0.5 shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${typeColor(ev.type)}`}
              >
                {ev.type}
              </span>
              <div className="min-w-0">
                <p className="font-medium truncate">{ev.title}</p>
                <p className="text-xs text-muted-foreground">
                  {ev.startDate === ev.endDate
                    ? formatDisplayDate(ev.startDate)
                    : `${formatDisplayDate(ev.startDate)} – ${formatDisplayDate(ev.endDate)}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Admin stat bar (CR-FE-016c) ───────────────────────────────────────────────
function AdminStatBar({ classIds }: { classIds: string[] }) {
  const dailySummaryQueries = useQueries({
    queries: classIds.map((classId) => ({
      queryKey: ["daily-summary", classId, TODAY],
      queryFn: () => attendanceApi.getDailySummary(classId, TODAY),
      staleTime: 2 * 60 * 1000,
    })),
  });

  const isLoading = dailySummaryQueries.some((q) => q.isLoading);
  if (isLoading) {
    return (
      <div
        className="animate-pulse h-10 bg-muted rounded-lg mb-4"
        aria-busy="true"
      />
    );
  }

  let totalPeriods = 0;
  let marked = 0;
  for (const q of dailySummaryQueries) {
    if (q.data) {
      for (const slot of q.data.slots) {
        totalPeriods++;
        if (slot.attendanceMarked) marked++;
      }
    }
  }
  const unmarked = totalPeriods - marked;

  return (
    <div
      className="flex flex-wrap gap-4 rounded-lg border bg-muted/30 px-4 py-2.5 mb-4 text-sm"
      role="status"
      aria-label="Today's attendance marking status"
    >
      <span>
        Total Periods: <strong>{totalPeriods}</strong>
      </span>
      <span className="text-green-700">
        Marked: <strong>{marked}</strong>
      </span>
      <span className="text-amber-700">
        Unmarked: <strong>{unmarked}</strong>
      </span>
    </div>
  );
}

// ── Teacher Class Rankings card (CR-FE-016e) ──────────────────────────────────
import React from "react";

function ClassRankingsCard({
  classIds,
  classNameMap,
}: {
  classIds: string[];
  classNameMap: Record<string, string>;
}) {
  const [open, setOpen] = React.useState(false);

  const topperQueries = useQueries({
    queries: classIds.map((classId) => ({
      queryKey: ["toppers", classId, THIRTY_DAYS_AGO, TODAY],
      queryFn: () =>
        attendanceApi.getToppers({
          classId,
          from: THIRTY_DAYS_AGO,
          to: TODAY,
          limit: 5,
        }),
      enabled: open,
      staleTime: 5 * 60 * 1000,
    })),
  });

  return (
    <section className="rounded-lg border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors"
      >
        <span>Class Rankings (last 30 days)</span>
        <svg
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t">
          {classIds.map((classId, i) => {
            const q = topperQueries[i];
            return (
              <div key={classId} className="mt-3">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  {classNameMap[classId] ?? classId}
                </h3>
                {q?.isLoading ? (
                  <div className="animate-pulse space-y-1.5">
                    {[...Array(3)].map((_, k) => (
                      <div key={k} className="h-3 bg-muted rounded w-full" />
                    ))}
                  </div>
                ) : q?.isError ? (
                  <p className="text-xs text-destructive">Failed to load.</p>
                ) : (q?.data?.toppers.length ?? 0) === 0 ? (
                  <p className="text-xs text-muted-foreground">No data yet.</p>
                ) : (
                  <ol className="space-y-1.5">
                    {(q!.data!.toppers as AttendanceTopper[]).map((t) => (
                      <li
                        key={t.studentId}
                        className="flex items-center justify-between text-sm gap-2"
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs text-muted-foreground w-4 shrink-0">
                            #{t.rank}
                          </span>
                          <span className="truncate">{t.studentName}</span>
                        </span>
                        <span
                          className={`shrink-0 font-medium ${
                            (t.attendancePercentage ?? 0) >= 75
                              ? "text-green-700"
                              : "text-amber-700"
                          }`}
                        >
                          {t.attendancePercentage !== null
                            ? `${t.attendancePercentage.toFixed(1)}%`
                            : "—"}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Student attendance history + streak (CR-FE-016b/story 18) ─────────────────
function StudentDashboard() {
  const { user } = useAuth();
  const studentId = user?.studentId ?? null;

  const { data: attendanceData, isLoading: loadingHistory } = useQuery({
    queryKey: ["student-attendance", studentId, { limit: 10 }],
    queryFn: () =>
      attendanceApi.getStudentHistory(studentId!, { limit: 10, offset: 0 }),
    enabled: !!studentId,
    staleTime: 3 * 60 * 1000,
  });

  const { data: timetableData } = useQuery({
    queryKey: ["timetable"],
    queryFn: () => timetableApi.list({}),
    staleTime: 5 * 60 * 1000,
  });

  const uniqueTimeSlotIds = React.useMemo(() => {
    const set = new Set<string>();
    timetableData?.timetable?.forEach((s) => set.add(s.id));
    return Array.from(set);
  }, [timetableData]);

  const streakQueries = useQueries({
    queries: uniqueTimeSlotIds.map((tsId) => ({
      queryKey: ["streaks", tsId],
      queryFn: () => attendanceApi.getStreaks(tsId),
      enabled: !!studentId && uniqueTimeSlotIds.length > 0,
      staleTime: 5 * 60 * 1000,
    })),
  });

  // Aggregate streaks: per subject, find max consecutiveAbsentCount
  const streakMap = React.useMemo(() => {
    const map: Record<string, { subjectName: string; streak: number }> = {};
    for (const q of streakQueries) {
      if (q.data) {
        const subjectId = q.data.subjectId;
        const subjectName =
          timetableData?.timetable?.find((sl) => sl.subjectId === subjectId)
            ?.subjectName ?? subjectId;
        for (const s of q.data.streaks) {
          const count = s.consecutiveAbsentCount;
          if (!map[subjectId] || map[subjectId]!.streak < count) {
            map[subjectId] = { subjectName, streak: count };
          }
        }
      }
    }
    return Object.values(map).filter((e) => e.streak > 0);
  }, [streakQueries, timetableData]);

  if (!studentId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-lg border bg-muted/30">
        <svg
          className="h-10 w-10 text-muted-foreground/40 mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
          />
        </svg>
        <p className="text-sm font-medium">
          Your student profile is not yet linked.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Contact your administrator.
        </p>
      </div>
    );
  }

  const records = attendanceData?.records ?? [];

  return (
    <div className="space-y-4">
      {/* Streak badges */}
      {streakMap.length > 0 && (
        <section
          className="rounded-lg border bg-amber-50 p-4"
          aria-label="Absence streaks"
        >
          <h2 className="text-sm font-semibold mb-2 text-amber-800">
            Consecutive Absence Streaks
          </h2>
          <ul className="flex flex-wrap gap-2">
            {streakMap.map((s) => (
              <li
                key={s.subjectName}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800"
              >
                {s.subjectName}
                <span className="rounded-full bg-amber-600 text-white px-1.5 py-0.5 text-xs font-bold">
                  {s.streak}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recent attendance history */}
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold mb-3">Recent Attendance</h2>
        {loadingHistory ? (
          <div className="animate-pulse space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-4 bg-muted rounded w-full" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No attendance records yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {records.slice(0, 8).map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground text-xs">{r.date}</span>
                <span className="text-xs">
                  {r.timeSlot?.subjectName ?? "—"}
                </span>
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                    r.status === "Present"
                      ? "bg-green-100 text-green-700"
                      : r.status === "Absent"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["timetable", { dayOfWeek: todayDayOfWeek() }],
    queryFn: () => timetableApi.list({ dayOfWeek: todayDayOfWeek() }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // 403 FEATURE_DISABLED → full-page state
  const apiError = isError ? parseApiError(error) : null;
  if (apiError?.code === "FEATURE_DISABLED") {
    return (
      <div className="p-6">
        <FeatureDisabledState />
      </div>
    );
  }

  // Student view — CR-FE-016b: live attendance + streak badges
  if (user?.activeRole === "Student") {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {todayDayOfWeek()}, {TODAY}
            {user && <span className="ml-2">· {user.name}</span>}
          </p>
        </div>
        <div className="space-y-4">
          <StudentDashboard />
          <UpcomingEventsCard />
        </div>
      </div>
    );
  }

  // Filter slots by role — Freeze §Screen: Dashboard permissions
  const allSlots = data?.timetable ?? [];
  const slots =
    user?.activeRole === "Teacher"
      ? allSlots.filter((s) => s.teacherId === user.id)
      : allSlots;

  // Unique classIds for stat bar (Admin) and ranking card (Teacher)
  const uniqueClassIds = Array.from(new Set(slots.map((s) => s.classId)));
  // Map classId → className for display in rankings card
  const classNameMap: Record<string, string> = {};
  for (const s of slots) {
    if (!classNameMap[s.classId]) classNameMap[s.classId] = s.className;
  }

  function handleRecordAttendance(slotId: string) {
    // Navigate to record page with slotId pre-selected via state
    navigate("/attendance/record", { state: { slotId } });
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {todayDayOfWeek()}, {TODAY}
          {user && <span className="ml-2">· {user.name}</span>}
        </p>
      </div>

      {/* Admin: API-driven stat bar (CR-FE-016c) */}
      {user?.activeRole === "Admin" &&
        !isLoading &&
        uniqueClassIds.length > 0 && <AdminStatBar classIds={uniqueClassIds} />}

      {/* Loading */}
      {isLoading && (
        <div
          className="space-y-3"
          aria-label="Loading timetable"
          aria-busy="true"
        >
          <SlotSkeleton />
          <SlotSkeleton />
          <SlotSkeleton />
        </div>
      )}

      {/* Error */}
      {isError && apiError?.code !== "FEATURE_DISABLED" && (
        <ErrorState onRetry={() => void refetch()} />
      )}

      {/* Empty */}
      {!isLoading && !isError && slots.length === 0 && <EmptyState />}

      {/* Slot list */}
      {!isLoading && !isError && slots.length > 0 && (
        <div className="space-y-3" role="list" aria-label="Today's classes">
          {slots
            .sort((a, b) => a.periodNumber - b.periodNumber)
            .map((slot) => (
              <div key={slot.id} role="listitem">
                <SlotCard
                  slot={slot}
                  onRecordAttendance={handleRecordAttendance}
                />
              </div>
            ))}
        </div>
      )}

      {/* Teacher: Class Rankings card (CR-FE-016e) */}
      {user?.activeRole === "Teacher" &&
        !isLoading &&
        uniqueClassIds.length > 0 && (
          <div className="mt-4">
            <ClassRankingsCard classIds={uniqueClassIds} classNameMap={classNameMap} />
          </div>
        )}

      {/* All roles: Upcoming Events (CR-FE-016g) */}
      <div className="mt-4">
        <UpcomingEventsCard />
      </div>
    </div>
  );
}
