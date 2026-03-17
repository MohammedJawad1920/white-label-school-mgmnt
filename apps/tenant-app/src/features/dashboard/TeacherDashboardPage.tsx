/**
 * TeacherDashboardPage — Teacher-specific dashboard
 *
 * Shows:
 *   - Today's class schedule (timetable slots for today's day of week)
 *   - Quick attendance links for each period (links to /attendance/record)
 *   - Pending assignments count
 *
 * Uses:
 *   timetableApi.list({ dayOfWeek, teacherId })
 *   assignmentsApi.list({ classId? }) — count status=OPEN
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { timetableApi } from "@/api/timetable";
import { assignmentsApi } from "@/api/assignments.api";
import { useAuth } from "@/hooks/useAuth";
import { parseApiError } from "@/utils/errors";
import { QUERY_KEYS } from "@/utils/queryKeys";

function todayDayName(): string {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return days[new Date().getDay()] ?? "Monday";
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Skeleton ────────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border bg-card p-4 space-y-2">
      <div className="h-4 bg-muted rounded w-1/3" />
      <div className="h-3 bg-muted rounded w-2/3" />
      <div className="h-3 bg-muted rounded w-1/2" />
    </div>
  );
}

export default function TeacherDashboardPage() {
  const { user } = useAuth();
  const today = todayDayName();
  const todayDate = todayISO();

  // Today's slots for this teacher
  const timetableQ = useQuery({
    queryKey: QUERY_KEYS.timetable({
      dayOfWeek: today,
      teacherId: user?.id ?? "",
    }),
    queryFn: () => timetableApi.list({ dayOfWeek: today, teacherId: user?.id }),
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.id,
  });

  // Assignments for the teacher's class (to count pending)
  const assignmentsQ = useQuery({
    queryKey: QUERY_KEYS.assignments.list(
      user?.classTeacherOf
        ? { classId: user.classTeacherOf, status: "OPEN" }
        : { status: "OPEN" },
    ),
    queryFn: () =>
      assignmentsApi.list(
        user?.classTeacherOf
          ? { classId: user.classTeacherOf, status: "OPEN" }
          : { status: "OPEN" },
      ),
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.id,
  });

  const slots = timetableQ.data?.timetable ?? [];
  const sortedSlots = [...slots].sort(
    (a, b) => a.periodNumber - b.periodNumber,
  );
  const openAssignments = assignmentsQ.data?.assignments ?? [];
  const timetableError = timetableQ.isError
    ? parseApiError(timetableQ.error)
    : null;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Teacher Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {today}, {todayDate}
          {user && <span className="ml-2">· {user.name}</span>}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {/* Today's periods */}
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
            Today's Periods
          </p>
          {timetableQ.isLoading ? (
            <div className="animate-pulse h-6 bg-muted rounded w-12" />
          ) : (
            <p className="text-2xl font-bold">{sortedSlots.length}</p>
          )}
        </div>

        {/* Open assignments */}
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
            Open Assignments
          </p>
          {assignmentsQ.isLoading ? (
            <div className="animate-pulse h-6 bg-muted rounded w-12" />
          ) : (
            <p className="text-2xl font-bold">{openAssignments.length}</p>
          )}
          {openAssignments.length > 0 && (
            <Link
              to="/teacher/assignments"
              className="text-xs text-primary underline-offset-2 hover:underline mt-1 block"
            >
              View assignments
            </Link>
          )}
        </div>

        {/* Class teacher badge */}
        {user?.classTeacherOf && (
          <div className="rounded-lg border bg-primary/5 p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
              Class Teacher
            </p>
            <p className="text-sm font-medium text-primary">Assigned</p>
            <Link
              to="/teacher/leave-queue"
              className="text-xs text-primary underline-offset-2 hover:underline mt-1 block"
            >
              View leave queue
            </Link>
          </div>
        )}
      </div>

      {/* Today's timetable */}
      <section aria-label="Today's schedule">
        <h2 className="text-base font-semibold mb-3">Today's Schedule</h2>

        {/* Error */}
        {timetableQ.isError && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive mb-4"
          >
            {timetableError?.message ?? "Failed to load schedule."}
          </div>
        )}

        {/* Loading */}
        {timetableQ.isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty */}
        {!timetableQ.isLoading &&
          !timetableQ.isError &&
          sortedSlots.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border bg-muted/20">
              <p className="text-sm text-muted-foreground">
                No classes scheduled for {today}.
              </p>
            </div>
          )}

        {/* Slot cards */}
        {!timetableQ.isLoading && sortedSlots.length > 0 && (
          <ul className="space-y-3">
            {sortedSlots.map((slot) => (
              <li key={slot.id}>
                <article className="rounded-lg border bg-card p-4 flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Period {slot.periodNumber}
                      </span>
                      {slot.startTime && slot.endTime && (
                        <span className="text-xs text-muted-foreground">
                          {slot.startTime} – {slot.endTime}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">
                      {slot.className ?? "—"} · {slot.subjectName ?? "—"}
                    </p>
                  </div>
                  <Link
                    to={`/attendance/record?timeslotId=${slot.id}&date=${todayDate}`}
                    className="shrink-0 inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Record attendance for ${slot.className} period ${slot.periodNumber}`}
                  >
                    Record Attendance
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
