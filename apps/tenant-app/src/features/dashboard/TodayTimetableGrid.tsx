/**
 * TodayTimetableGrid — Freeze §Screen: Dashboard CR-FE-023 §C
 *
 * Renders a class × period matrix for today's timetable.
 * Y-axis: unique class names sorted alphabetically.
 * X-axis: union of all period numbers present in today's slots, sorted ascending.
 *
 * Cell states:
 *   Marked, 0 absent    → green
 *   Marked, N absent    → green + red absent badge (clickable → absentee popup)
 *   Unmarked, ongoing   → yellow
 *   Unmarked, overdue   → orange
 *   Empty (no slot)     → muted/transparent
 *
 * Absentee popup: Radix Popover, lazy TQ fired only when popup opens.
 * Cell click: Admin any slot → navigate to Record Attendance.
 *             Teacher own slot → navigate. Other Teacher slots: no-op.
 * Teacher's own slot cells get a left accent border.
 */
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as Popover from "@radix-ui/react-popover";
import type { UseQueryResult } from "@tanstack/react-query";
import { format } from "date-fns";
import { attendanceApi } from "@/api/attendance";
import { todayISO } from "@/utils/dates";
import type {
  TimeSlot,
  SchoolPeriod,
  AttendanceDailySummaryResponse,
  DailySummarySlot,
} from "@/types/api";

const TODAY = todayISO();

// ── Absentee popup ─────────────────────────────────────────────────────────────
interface AbsenteePopupProps {
  timeSlotId: string;
  absentCount: number;
  totalStudents: number;
}

function AbsenteePopup({
  timeSlotId,
  absentCount,
  totalStudents,
}: AbsenteePopupProps) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["absentees", timeSlotId, TODAY],
    queryFn: () => attendanceApi.getAbsentees(timeSlotId, TODAY),
    enabled: open,
    staleTime: 2 * 60 * 1000,
    retry: (failureCount, error) => {
      // Never retry on 403 or 404
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 403 || status === 404) return false;
      return failureCount < 2;
    },
  });

  const presentCount = totalStudents - absentCount;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-semibold px-1.5 min-w-[18px] h-[18px] hover:bg-red-200 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500 shrink-0"
          aria-label={`${absentCount} absent students — click to view names`}
        >
          {absentCount}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="center"
          sideOffset={6}
          className="z-50 w-64 rounded-lg border bg-popover shadow-lg p-3 text-sm outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <p className="font-semibold text-sm mb-2">
            {absentCount} absent · {presentCount} present of {totalStudents}
          </p>

          {/* Content */}
          {isLoading ? (
            <ul className="space-y-2">
              {[1, 2, 3].map((i) => (
                <li key={i} className="h-3 bg-muted rounded animate-pulse" />
              ))}
            </ul>
          ) : isError ? (
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Failed to load. Tap to retry.
              </p>
              <button
                onClick={() => void refetch()}
                className="text-xs text-primary underline"
              >
                Retry
              </button>
            </div>
          ) : data?.absentees.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No absences recorded for this period.
            </p>
          ) : (
            <ul className="space-y-1.5 max-h-48 overflow-y-auto">
              {data?.absentees.map((a) => (
                <li
                  key={a.studentId}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="min-w-0">
                    <span className="font-medium block truncate">
                      {a.studentName}
                    </span>
                    <span className="text-muted-foreground">
                      {a.admissionNumber}
                    </span>
                  </span>
                  {a.consecutiveAbsentCount >= 2 && (
                    <span className="shrink-0 bg-red-100 text-red-700 rounded-full px-1.5 text-xs font-semibold whitespace-nowrap">
                      {a.consecutiveAbsentCount} consecutive
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function TodayTimetableGridSkeleton({
  rows = 3,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[360px] border-collapse">
        <thead>
          <tr>
            <th className="w-24" />
            {[...Array(cols)].map((_, i) => (
              <th key={i} className="p-2">
                <div className="h-3 bg-muted rounded animate-pulse w-16 mx-auto" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, r) => (
            <tr key={r}>
              <td className="p-2">
                <div className="h-3 bg-muted rounded animate-pulse w-20" />
              </td>
              {[...Array(cols)].map((_, c) => (
                <td key={c} className="p-1">
                  <div className="rounded border bg-muted/30 p-2 h-16 animate-pulse" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Cell ───────────────────────────────────────────────────────────────────────
interface CellProps {
  slot: TimeSlot | undefined;
  summary: DailySummarySlot | undefined;
  period: SchoolPeriod | undefined;
  isOwnSlot: boolean;
  isClickable: boolean;
  onClick: () => void;
}

function TimetableCell({
  slot,
  summary,
  period,
  isOwnSlot,
  isClickable,
  onClick,
}: CellProps) {
  if (!slot) {
    return (
      <td className="p-1">
        <div className="rounded border border-transparent bg-muted/20 p-2 h-16" />
      </td>
    );
  }

  // Determine overdue: current time > period.endTime AND attendance not marked
  const overdue = (() => {
    if (!summary || summary.attendanceMarked !== false) return false;
    if (!period?.endTime) return false;
    const parts = period.endTime.split(":");
    const h = parseInt(parts[0] ?? "0", 10);
    const m = parseInt(parts[1] ?? "0", 10);
    const now = new Date();
    return now.getHours() > h || (now.getHours() === h && now.getMinutes() > m);
  })();

  // Cell background based on state
  const cellBg = (() => {
    if (!summary)
      return "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800";
    if (summary.attendanceMarked)
      return "bg-green-100 border-green-200 dark:bg-green-900/40 dark:border-green-800";
    if (overdue)
      return "bg-orange-50 border-orange-300 dark:bg-orange-900/30 dark:border-orange-700";
    return "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800";
  })();

  const cursorCls = isClickable
    ? "cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
    : "cursor-default";

  const leftAccent = isOwnSlot ? "border-l-2 border-l-primary" : "";

  return (
    <td className="p-1">
      <div
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onClick={isClickable ? onClick : undefined}
        onKeyDown={
          isClickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
        aria-label={
          isClickable
            ? `${slot.className} ${slot.subjectName ?? ""} Period ${slot.periodNumber} — record attendance`
            : undefined
        }
        className={`rounded border p-2 h-16 flex flex-col justify-between ${cellBg} ${cursorCls} ${leftAccent}`}
      >
        {/* Subject + Teacher */}
        <div className="text-xs leading-tight min-w-0">
          <p className="font-medium truncate">{slot.subjectName ?? "—"}</p>
          {slot.teacherName && (
            <p className="text-muted-foreground truncate">{slot.teacherName}</p>
          )}
        </div>

        {/* Status indicator + absent badge */}
        <div className="flex items-center gap-1 mt-1">
          {!summary && (
            <span className="text-xs text-yellow-700" aria-hidden="true">
              ⏳
            </span>
          )}
          {summary && !summary.attendanceMarked && overdue && (
            <span
              className="text-xs text-orange-700"
              aria-label="Attendance overdue"
            >
              ⚠
            </span>
          )}
          {summary && !summary.attendanceMarked && !overdue && (
            <span className="text-xs text-yellow-700" aria-hidden="true">
              ⏳
            </span>
          )}
          {summary?.attendanceMarked && summary.absentCount > 0 && (
            <AbsenteePopup
              timeSlotId={summary.timeSlotId}
              absentCount={summary.absentCount}
              totalStudents={summary.totalStudents}
            />
          )}
        </div>
      </div>
    </td>
  );
}

// ── Main grid ──────────────────────────────────────────────────────────────────
export interface TodayTimetableGridProps {
  allSlots: TimeSlot[];
  periodsData: SchoolPeriod[];
  dailySummaryQueries: UseQueryResult<AttendanceDailySummaryResponse>[];
  activeRole: "Admin" | "Teacher" | "Student";
  currentUserId: string;
  isLoading: boolean;
  onRefresh: () => void;
  isRefetching: boolean;
  lastUpdatedAt: Date | null;
}

export default function TodayTimetableGrid({
  allSlots,
  periodsData,
  dailySummaryQueries,
  activeRole,
  currentUserId,
  isLoading,
  onRefresh,
  isRefetching,
  lastUpdatedAt,
}: TodayTimetableGridProps) {
  const navigate = useNavigate();
  const [mobileView, setMobileView] = useState<"grid" | "list">("grid");

  // Build period map: periodNumber → SchoolPeriod
  const periodsMap = useMemo(() => {
    const m = new Map<number, SchoolPeriod>();
    for (const p of periodsData) {
      m.set(p.periodNumber, p);
    }
    return m;
  }, [periodsData]);

  // Derive unique sorted class rows (Y-axis)
  const classRows = useMemo(() => {
    const map = new Map<string, string>(); // classId → className
    for (const s of allSlots) {
      if (!map.has(s.classId)) {
        map.set(s.classId, s.className ?? s.classId);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [allSlots]);

  // Derive union of period numbers (X-axis), sorted ascending
  const periodNums = useMemo(() => {
    const set = new Set<number>();
    for (const s of allSlots) set.add(s.periodNumber);
    return [...set].sort((a, b) => a - b);
  }, [allSlots]);

  // Slot map: "classId::periodNumber" → TimeSlot
  const slotMap = useMemo(() => {
    const m = new Map<string, TimeSlot>();
    for (const s of allSlots) {
      m.set(`${s.classId}::${s.periodNumber}`, s);
    }
    return m;
  }, [allSlots]);

  // Summary map: "classId::periodNumber" → DailySummarySlot
  const summaryMap = useMemo(() => {
    const m = new Map<string, DailySummarySlot>();
    for (const q of dailySummaryQueries) {
      if (q.data) {
        for (const slot of q.data.slots) {
          m.set(`${q.data.classId}::${slot.periodNumber}`, slot);
        }
      }
    }
    return m;
  }, [dailySummaryQueries]);

  function handleCellClick(slot: TimeSlot) {
    if (activeRole === "Admin") {
      navigate("/attendance/record", { state: { slotId: slot.id } });
    } else if (activeRole === "Teacher" && slot.teacherId === currentUserId) {
      navigate("/attendance/record", { state: { slotId: slot.id } });
    }
  }

  // Skeleton
  if (isLoading) {
    return (
      <TodayTimetableGridSkeleton
        rows={Math.max(classRows.length || 3, 3)}
        cols={Math.max(periodNums.length || 4, 4)}
      />
    );
  }

  if (allSlots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No classes scheduled in today&apos;s timetable.
      </p>
    );
  }

  return (
    <div>
      {/* Grid header: title + mobile toggle + refresh */}
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h2 className="text-sm font-semibold">Today&apos;s Timetable</h2>
        <div className="flex items-center gap-2">
          {/* Mobile view toggle */}
          <button
            className="sm:hidden text-xs text-muted-foreground border rounded px-2 py-1"
            onClick={() =>
              setMobileView((v) => (v === "grid" ? "list" : "grid"))
            }
            aria-label={`Switch to ${mobileView === "grid" ? "list" : "grid"} view`}
          >
            {mobileView === "grid" ? "≡ List" : "⊞ Grid"}
          </button>

          {/* Last updated timestamp */}
          {lastUpdatedAt && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Last updated: {format(lastUpdatedAt, "HH:mm")}
            </span>
          )}

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={isRefetching}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground border rounded px-2 py-1 hover:bg-muted/50 disabled:opacity-50 transition-colors"
            aria-label="Refresh timetable"
          >
            {isRefetching ? (
              <svg
                className="h-3 w-3 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            ) : (
              <span aria-hidden="true">↻</span>
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Mobile list view */}
      {mobileView === "list" && (
        <div className="sm:hidden space-y-2">
          {allSlots
            .slice()
            .sort(
              (a, b) =>
                (a.className?.localeCompare(b.className ?? "") ?? 0) ||
                a.periodNumber - b.periodNumber,
            )
            .map((slot) => {
              const summary = summaryMap.get(
                `${slot.classId}::${slot.periodNumber}`,
              );
              const isOwn =
                activeRole === "Teacher" && slot.teacherId === currentUserId;
              const period = periodsMap.get(slot.periodNumber);
              const timeLabel = period
                ? `${period.startTime}–${period.endTime}`
                : `P${slot.periodNumber}`;

              return (
                <div
                  key={slot.id}
                  className={`rounded-lg border p-3 text-sm ${
                    isOwn ? "border-l-2 border-l-primary" : ""
                  } ${summary?.attendanceMarked ? "bg-green-50" : "bg-yellow-50"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {slot.className ?? "—"} · {slot.subjectName ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {timeLabel} · {slot.teacherName}
                      </p>
                    </div>
                    {summary?.attendanceMarked && summary.absentCount > 0 && (
                      <AbsenteePopup
                        timeSlotId={summary.timeSlotId}
                        absentCount={summary.absentCount}
                        totalStudents={summary.totalStudents}
                      />
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Grid view */}
      <div
        className={`overflow-x-auto ${mobileView === "list" ? "hidden sm:block" : ""}`}
      >
        <table className="w-full min-w-[360px] border-collapse text-xs">
          <thead>
            <tr>
              {/* Class name column header */}
              <th className="sticky left-0 bg-background z-10 border-b border-r border-border px-2 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap w-[72px] max-w-[72px]">
                Class
              </th>
              {periodNums.map((pn) => {
                const p = periodsMap.get(pn);
                return (
                  <th
                    key={pn}
                    className="border-b border-border px-1.5 py-2 text-center font-medium text-muted-foreground whitespace-nowrap min-w-[72px]"
                  >
                    <div>P{pn}</div>
                    {p && (
                      <div className="text-[10px] font-normal text-muted-foreground/70">
                        {p.startTime}–{p.endTime}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {classRows.map(([classId, className]) => (
              <tr key={classId}>
                {/* Class name cell (sticky) */}
                <td className="sticky left-0 bg-background z-10 border-r border-border px-2 py-2 text-xs font-medium whitespace-nowrap w-[72px] max-w-[72px] truncate">
                  {className}
                </td>
                {/* Period cells */}
                {periodNums.map((pn) => {
                  const key = `${classId}::${pn}`;
                  const slot = slotMap.get(key);
                  const summary = summaryMap.get(key);
                  const period = periodsMap.get(pn);
                  const isOwn =
                    activeRole === "Teacher" &&
                    slot?.teacherId === currentUserId;
                  const isClickable =
                    !!slot &&
                    (activeRole === "Admin" ||
                      (activeRole === "Teacher" &&
                        slot.teacherId === currentUserId));
                  return (
                    <TimetableCell
                      key={pn}
                      slot={slot}
                      summary={summary}
                      period={period}
                      isOwnSlot={!!isOwn}
                      isClickable={isClickable}
                      onClick={() => slot && handleCellClick(slot)}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
