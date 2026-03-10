/**
 * TimetablePage — Freeze §Screen: Timetable
 *
 * Queries:
 *   ['timetable', filters]  — GET /timetable?...filters
 *   ['school-periods']      — GET /school-periods (for grid row headers)
 *   Both: stale 5 min
 *
 * Role rules (Freeze §Screen: Timetable permissions):
 *   Teacher: read-only — no Create button, no slot actions
 *   Admin:   Create button (opens CreateSlotDrawer) + Edit/Delete per slot
 *
 * Grid layout:
 *   Rows    = school periods (sorted by periodNumber)
 *   Columns = days of week (Mon–Sun, filtered by active day filter)
 *
 * WHY role="grid" with role="row"/"gridcell":
 * Freeze §6 Accessibility: "Grid uses role='grid' with role='row' and
 * role='gridcell'". This gives screen readers proper table semantics without
 * using <table> (which is hard to make responsive).
 */
import { useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { timetableApi } from "@/api/timetable";
import { attendanceApi } from "@/api/attendance";
import { schoolPeriodsApi } from "@/api/schoolPeriods";
import { classesApi } from "@/api/classes";
import { usersApi } from "@/api/users";
import { todayISO, todayDayOfWeek } from "@/utils/dates";
import { parseApiError } from "@/utils/errors";
import { CreateSlotDrawer } from "./CreateSlotDrawer";
import { DeleteSlotDialog } from "./EndSlotDialog";
import type { TimeSlot } from "@/types/api";

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

// ── Skeletons ─────────────────────────────────────────────────────────────────
function GridSkeleton() {
  return (
    <div
      className="animate-pulse space-y-2"
      aria-label="Loading timetable"
      aria-busy="true"
    >
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-2">
          <div className="h-16 w-20 bg-muted rounded shrink-0" />
          {DAYS.slice(0, 5).map((d) => (
            <div key={d} className="h-16 flex-1 bg-muted rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Feature disabled ──────────────────────────────────────────────────────────
function FeatureDisabledState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
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

// ── Slot cell ─────────────────────────────────────────────────────────────────
interface SlotCellProps {
  slot: TimeSlot;
  isAdmin: boolean;
  onDelete: (slot: TimeSlot) => void;
  markingStatus?: "marked" | "unmarked" | null;
}

function SlotCell({ slot, isAdmin, onDelete, markingStatus }: SlotCellProps) {
  const bg =
    markingStatus === "marked"
      ? "bg-green-100"
      : markingStatus === "unmarked"
        ? "bg-yellow-50"
        : "bg-primary/5";
  return (
    <div className={`rounded border ${bg} p-2 text-xs space-y-1 h-full group`}>
      <p className="font-medium truncate">{slot.className}</p>
      <p className="text-muted-foreground truncate">{slot.subjectName}</p>
      <p className="text-muted-foreground truncate">{slot.teacherName}</p>
      {isAdmin && (
        <div className="flex flex-col gap-1 mt-1">
          <button
            onClick={() => onDelete(slot)}
            aria-label={`Delete slot: ${slot.className} ${slot.subjectName} Period ${slot.periodNumber}`}
            className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TimetablePage() {
  const { user } = useAuth();
  const isAdmin = user?.activeRole === "Admin";

  // ── Filters (local UI state) ───────────────────────────────────────────────
  const [filterDay, setFilterDay] = useState<Day | "">("");
  const [filterClassId, setFilterClassId] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");

  // ── Drawer / Dialog state ──────────────────────────────────────────────────
  const [activeCell, setActiveCell] = useState<{
    dayOfWeek: Day;
    periodNumber: number;
  } | null>(null);
  const [deleteSlot, setDeleteSlot] = useState<TimeSlot | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const filters = {
    dayOfWeek: filterDay || undefined,
    classId: filterClassId || undefined,
    teacherId: filterTeacher || undefined,
  };

  const timetableQ = useQuery({
    queryKey: ["timetable", filters],
    queryFn: () => timetableApi.list(filters),
    staleTime: 5 * 60 * 1000,
  });

  const periodsQ = useQuery({
    queryKey: ["school-periods"],
    queryFn: () => schoolPeriodsApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const classesQ = useQuery({
    queryKey: ["classes"],
    queryFn: () => classesApi.list(),
    staleTime: 2 * 60 * 1000,
  });

  const teachersQ = useQuery({
    queryKey: ["users", "Teacher", ""],
    queryFn: () => usersApi.list({ role: "Teacher" }),
    staleTime: 2 * 60 * 1000,
  });

  // ── Marking-status queries (CR-FE-016c) — hoisted before early return ──────
  // useQueries must be called before any conditional return (Rules of Hooks).
  const slots = timetableQ.data?.timetable ?? [];
  const activeDays = filterDay ? [filterDay] : DAYS;
  const todayDay = todayDayOfWeek() as Day;
  const todayInGrid = activeDays.some((d) => d === todayDay);
  const todayClassIds = todayInGrid
    ? Array.from(
        new Set(
          slots.filter((s) => s.dayOfWeek === todayDay).map((s) => s.classId),
        ),
      )
    : [];

  const dailySummaryQueries = useQueries({
    queries: todayClassIds.map((classId) => ({
      queryKey: ["daily-summary", classId, todayISO()],
      queryFn: () => attendanceApi.getDailySummary(classId, todayISO()),
      staleTime: 2 * 60 * 1000,
      enabled: todayInGrid,
    })),
  });

  // Build marking map keyed by "classId:periodNumber"
  const markingMap = new Map<string, "marked" | "unmarked">();
  for (const q of dailySummaryQueries) {
    if (q.data) {
      for (const s of q.data.slots) {
        markingMap.set(
          `${q.data.classId}:${s.periodNumber}`,
          s.attendanceMarked ? "marked" : "unmarked",
        );
      }
    }
  }

  // ── Feature-disabled check ─────────────────────────────────────────────────
  const apiError = timetableQ.isError ? parseApiError(timetableQ.error) : null;
  if (apiError?.code === "FEATURE_DISABLED")
    return (
      <div className="p-6">
        <FeatureDisabledState />
      </div>
    );

  // ── Build grid ─────────────────────────────────────────────────────────────
  // (slots and activeDays hoisted above for Rules-of-Hooks compliance)
  const periods = [...(periodsQ.data?.periods ?? [])].sort(
    (a, b) => a.periodNumber - b.periodNumber,
  );

  // Map: periodNumber → dayOfWeek → slots[]
  const grid: Record<number, Record<string, TimeSlot[]>> = {};
  for (const slot of slots) {
    if (!grid[slot.periodNumber]) grid[slot.periodNumber] = {};
    if (!grid[slot.periodNumber]![slot.dayOfWeek])
      grid[slot.periodNumber]![slot.dayOfWeek] = [];
    grid[slot.periodNumber]![slot.dayOfWeek]!.push(slot);
  }

  const isEmpty =
    !timetableQ.isLoading &&
    !timetableQ.isError &&
    slots.length === 0 &&
    periods.length === 0;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Timetable</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Active slot assignments
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select
          value={filterDay}
          onChange={(e) => setFilterDay(e.target.value as Day | "")}
          aria-label="Filter by day"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Days</option>
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          value={filterClassId}
          onChange={(e) => setFilterClassId(e.target.value)}
          aria-label="Filter by class"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Classes</option>
          {classesQ.data?.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={filterTeacher}
          onChange={(e) => setFilterTeacher(e.target.value)}
          aria-label="Filter by teacher"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Teachers</option>
          {teachersQ.data?.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        {(filterDay || filterClassId || filterTeacher) && (
          <button
            onClick={() => {
              setFilterDay("");
              setFilterClassId("");
              setFilterTeacher("");
            }}
            className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Loading */}
      {timetableQ.isLoading && <GridSkeleton />}

      {/* Error (non-feature) */}
      {timetableQ.isError && apiError?.code !== "FEATURE_DISABLED" && (
        <div
          className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          Failed to load timetable.{" "}
          <button
            onClick={() => void timetableQ.refetch()}
            className="underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* School periods warning */}
      {periodsQ.isError && (
        <div
          className="mb-4 rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800"
          role="alert"
        >
          School periods not configured. Period row headers may be missing.
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No timetable entries found.
            {isAdmin
              ? " Click an empty cell to add a slot."
              : " Use filters to adjust."}
          </p>
        </div>
      )}

      {/* Grid — scrollable horizontally on mobile */}
      {!timetableQ.isLoading && !timetableQ.isError && periods.length > 0 && (
        <div className="overflow-x-auto -mx-4 md:mx-0 rounded-lg border">
          <div
            role="grid"
            aria-label="Timetable grid"
            style={{ minWidth: `${activeDays.length * 140 + 80}px` }}
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
                  className="flex-1 min-w-[120px] px-2 py-2.5 text-xs font-semibold text-center border-l"
                >
                  {day.slice(0, 3)}
                </div>
              ))}
            </div>

            {/* Period rows */}
            {periods.length > 0 ? (
              periods.map((period) => (
                <div
                  key={period.id}
                  role="row"
                  className="flex border-b last:border-b-0 min-h-[72px]"
                >
                  {/* Period header cell */}
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
                    <span className="text-xs text-muted-foreground">
                      {period.startTime}–{period.endTime}
                    </span>
                  </div>

                  {/* Day cells */}
                  {activeDays.map((day) => {
                    const cellSlots = grid[period.periodNumber]?.[day] ?? [];
                    const cellIsEmpty = cellSlots.length === 0;
                    return (
                      <div
                        key={day}
                        role="gridcell"
                        className={[
                          "flex-1 min-w-[120px] p-1.5 border-l space-y-1",
                          isAdmin && cellIsEmpty
                            ? "cursor-pointer hover:bg-muted/30 border-dashed transition-colors group"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-label={
                          isAdmin && cellIsEmpty
                            ? `Add slot for ${day} Period ${period.periodNumber}`
                            : `${day} Period ${period.periodNumber}`
                        }
                        tabIndex={isAdmin && cellIsEmpty ? 0 : undefined}
                        onClick={
                          isAdmin && cellIsEmpty
                            ? () =>
                                setActiveCell({
                                  dayOfWeek: day,
                                  periodNumber: period.periodNumber,
                                })
                            : undefined
                        }
                        onKeyDown={
                          isAdmin && cellIsEmpty
                            ? (e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setActiveCell({
                                    dayOfWeek: day,
                                    periodNumber: period.periodNumber,
                                  });
                                }
                              }
                            : undefined
                        }
                      >
                        {cellIsEmpty && isAdmin && (
                          <div
                            className="flex min-h-[56px] items-center justify-center opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none"
                            aria-hidden="true"
                          >
                            <svg
                              className="h-5 w-5 text-muted-foreground"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                          </div>
                        )}
                        {cellSlots.map((slot) => (
                          <SlotCell
                            key={slot.id}
                            slot={slot}
                            isAdmin={isAdmin}
                            onDelete={setDeleteSlot}
                            markingStatus={
                              day === todayDay
                                ? (markingMap.get(
                                    `${slot.classId}:${period.periodNumber}`,
                                  ) ?? null)
                                : null
                            }
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              // No periods configured — show flat list grouped by day
              <div role="row" className="flex border-b p-3">
                <div role="gridcell" className="text-xs text-muted-foreground">
                  School periods not configured — showing all {slots.length}{" "}
                  slot(s) without period rows.
                  <div className="mt-2 space-y-1">
                    {slots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between rounded border px-2 py-1.5"
                      >
                        <span>
                          {slot.dayOfWeek} P{slot.periodNumber} ·{" "}
                          {slot.className} · {slot.subjectName}
                        </span>
                        {isAdmin && (
                          <div className="flex gap-1 ml-2">
                            <button
                              onClick={() => setDeleteSlot(slot)}
                              className="text-xs text-destructive underline"
                              aria-label={`Delete: ${slot.className} P${slot.periodNumber}`}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create slot drawer — Admin only, triggered by empty cell click (CR-11) */}
      {isAdmin && (
        <CreateSlotDrawer
          open={activeCell !== null}
          onClose={() => setActiveCell(null)}
          activeCell={activeCell}
          filterDefaults={{
            dayOfWeek: filterDay || undefined,
            classId: filterClassId || undefined,
            teacherId: filterTeacher || undefined,
          }}
        />
      )}

      {/* Delete slot dialog — Admin only */}
      {isAdmin && (
        <DeleteSlotDialog
          slot={deleteSlot}
          onClose={() => setDeleteSlot(null)}
        />
      )}
    </div>
  );
}
