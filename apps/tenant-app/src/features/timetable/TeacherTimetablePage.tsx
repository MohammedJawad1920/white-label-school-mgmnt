/**
 * TeacherTimetablePage — Read-only full weekly timetable for the teacher.
 *
 * Filters automatically by the logged-in teacher's ID.
 * Displays a grid: Rows = periods, Columns = days (Mon–Sun, or the active day filter).
 * No create/delete actions — Teacher role is read-only.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { timetableApi } from "@/api/timetable";
import { schoolPeriodsApi } from "@/api/schoolPeriods";
import { useAuth } from "@/hooks/useAuth";
import { parseApiError } from "@/utils/errors";
import type { TimeSlot } from "@/types/api";
import { QUERY_KEYS } from "@/utils/queryKeys";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type Day = (typeof DAYS)[number];

function todayDayName(): Day {
  const days: Day[] = [
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

// ── Skeleton ────────────────────────────────────────────────────────────────
function GridSkeleton() {
  return (
    <div
      className="animate-pulse space-y-2"
      aria-label="Loading timetable"
      aria-busy="true"
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-2">
          <div className="h-14 w-20 bg-muted rounded shrink-0" />
          {DAYS.slice(0, 5).map((d) => (
            <div key={d} className="h-14 flex-1 bg-muted rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Slot cell — read-only ───────────────────────────────────────────────────
function SlotCell({ slot }: { slot: TimeSlot }) {
  return (
    <div className="rounded-md border border-l-2 border-l-primary/60 bg-primary/5 px-2 py-1.5 text-xs shadow-sm">
      <p className="font-semibold leading-snug">{slot.className ?? "—"}</p>
      <p className="text-muted-foreground leading-snug">
        {slot.subjectName ?? "—"}
      </p>
    </div>
  );
}

export default function TeacherTimetablePage() {
  const { user } = useAuth();
  const todayDay = todayDayName();
  const [filterDay, setFilterDay] = useState<Day | "">("");

  const activeDays = filterDay ? [filterDay] : DAYS;

  const timetableQ = useQuery({
    queryKey: QUERY_KEYS.timetable({ teacherId: user?.id ?? "" }),
    queryFn: () => timetableApi.list({ teacherId: user?.id }),
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.id,
  });

  const periodsQ = useQuery({
    queryKey: QUERY_KEYS.schoolPeriods(),
    queryFn: () => schoolPeriodsApi.list(),
    staleTime: 10 * 60 * 1000,
  });

  const slots = timetableQ.data?.timetable ?? [];
  const periods = [...(periodsQ.data?.periods ?? [])].sort(
    (a, b) => a.periodNumber - b.periodNumber,
  );

  // Build grid: periodNumber → dayOfWeek → TimeSlot[]
  const grid: Record<number, Record<string, TimeSlot[]>> = {};
  for (const slot of slots) {
    if (!grid[slot.periodNumber]) grid[slot.periodNumber] = {};
    if (!grid[slot.periodNumber]![slot.dayOfWeek]) {
      grid[slot.periodNumber]![slot.dayOfWeek] = [];
    }
    grid[slot.periodNumber]![slot.dayOfWeek]!.push(slot);
  }

  const apiError = timetableQ.isError ? parseApiError(timetableQ.error) : null;
  const isEmpty =
    !timetableQ.isLoading &&
    !timetableQ.isError &&
    slots.length === 0 &&
    periods.length === 0;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold">My Timetable</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your weekly schedule — read only
        </p>
      </div>

      {/* Day filter */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select
          value={filterDay}
          onChange={(e) => setFilterDay(e.target.value as Day | "")}
          aria-label="Filter by day"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All days</option>
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        {filterDay && (
          <button
            onClick={() => setFilterDay("")}
            className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Loading */}
      {timetableQ.isLoading && <GridSkeleton />}

      {/* Error */}
      {timetableQ.isError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
        >
          {apiError?.message ?? "Failed to load timetable."}
          <button
            onClick={() => void timetableQ.refetch()}
            className="ml-2 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No timetable slots assigned to you yet.
          </p>
        </div>
      )}

      {/* Grid */}
      {!timetableQ.isLoading &&
        !timetableQ.isError &&
        (slots.length > 0 || periods.length > 0) && (
          <div className="overflow-x-auto -mx-4 md:mx-0 rounded-lg border">
            <div
              role="grid"
              aria-label="Teacher timetable grid"
              style={{ minWidth: `${activeDays.length * 130 + 80}px` }}
            >
              {/* Column headers */}
              <div role="row" className="flex bg-muted/50 border-b">
                <div
                  role="columnheader"
                  className="w-20 shrink-0 px-2 py-2.5 text-xs font-semibold text-muted-foreground"
                >
                  Period
                </div>
                {activeDays.map((day) => (
                  <div
                    key={day}
                    role="columnheader"
                    className={`flex-1 min-w-[110px] px-2 py-2.5 text-xs font-semibold text-center border-l${day === todayDay ? " bg-primary/5 text-primary" : ""}`}
                  >
                    {day.slice(0, 3)}
                    {day === todayDay && (
                      <span className="ml-1 text-[10px]">(today)</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Period rows */}
              {periods.length > 0 ? (
                periods.map((period) => (
                  <div
                    key={period.id}
                    role="row"
                    className="flex border-b last:border-b-0"
                  >
                    <div
                      role="rowheader"
                      className="w-20 shrink-0 flex flex-col justify-center px-2 py-2 bg-muted/20 border-r"
                    >
                      <span className="text-xs font-semibold">
                        P{period.periodNumber}
                      </span>
                      {period.label && (
                        <span className="text-xs text-muted-foreground truncate">
                          {period.label}
                        </span>
                      )}
                      {period.startTime && period.endTime && (
                        <span className="text-xs text-muted-foreground">
                          {period.startTime}–{period.endTime}
                        </span>
                      )}
                    </div>
                    {activeDays.map((day) => {
                      const cellSlots = grid[period.periodNumber]?.[day] ?? [];
                      return (
                        <div
                          key={day}
                          role="gridcell"
                          aria-label={`${day} Period ${period.periodNumber}`}
                          className="flex-1 min-w-[110px] p-1.5 border-l flex flex-col gap-1"
                        >
                          {cellSlots.map((slot) => (
                            <SlotCell key={slot.id} slot={slot} />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))
              ) : (
                // No periods configured — flat list
                <div role="row" className="p-3">
                  <div
                    role="gridcell"
                    className="text-xs text-muted-foreground"
                  >
                    No school periods configured. Showing {slots.length}{" "}
                    slot(s):
                    <ul className="mt-2 space-y-1">
                      {slots.map((slot) => (
                        <li
                          key={slot.id}
                          className="rounded border px-2 py-1.5 text-sm"
                        >
                          {slot.dayOfWeek} · P{slot.periodNumber} ·{" "}
                          {slot.className} · {slot.subjectName}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
