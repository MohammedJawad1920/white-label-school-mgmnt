/**
 * DashboardPage — Freeze §Screen: Dashboard
 *
 * Query: GET /timetable?date={today}
 * TQ key: ['timetable', 'today', isoDate] — stale 5 min, refetch on focus
 *
 * Role rules (Freeze §Screen: Dashboard):
 *   Teacher → filter client-side: only slots where teacherId === currentUser.id
 *   Admin   → show all slots
 *
 * Error codes handled:
 *   403 FEATURE_DISABLED → full-page feature-disabled state (via FeatureGate pattern)
 *   network/500          → toast with retry button
 */
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { timetableApi } from "@/api/timetable";
import { useAuth } from "@/hooks/useAuth";
import { todayISO, todayDayOfWeek } from "@/utils/dates";
import { parseApiError } from "@/utils/errors";

const TODAY = todayISO();

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
    endTime?: string;
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["timetable", "today", TODAY],
    queryFn: () => timetableApi.list({ date: TODAY }),
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

  // Student view — FE-006: placeholder until student-facing screens are built
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
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-lg border bg-muted/30">
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
              d="M12 14l9-5-9-5-9 5 9 5zm0 7v-7m0 0l-9-5m9 5l9-5"
            />
          </svg>
          <p className="text-base font-medium text-muted-foreground">
            Welcome, {user.name}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Contact your admin for your attendance records and timetable
            details.
          </p>
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
    </div>
  );
}
