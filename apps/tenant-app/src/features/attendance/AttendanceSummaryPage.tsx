/**
 * AttendanceSummaryPage — Freeze §Screen: Attendance Summary
 *
 * GET /attendance/summary?classId={id}&from={YYYY-MM-DD}&to={YYYY-MM-DD}
 * TQ key: ['attendance-summary', classId, from, to]  stale: 5 min
 *
 * WHY from/to not month picker:
 * OpenAPI uses from+to date range (not YYYY-MM month param).
 * We derive from+to from a month picker for UX convenience:
 *   from = first day of selected month
 *   to   = last day of selected month
 *
 * Response shape (from OpenAPI):
 *   class: { id, name, studentCount }
 *   period: { from, to, days }
 *   summary: { totalRecords, present, absent, late, attendanceRate }
 *   byStudent: [{ studentId, studentName, present, absent, late, attendanceRate }]
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { attendanceApi } from "@/api/attendance";
import { classesApi } from "@/api/classes";
import { parseApiError } from "@/utils/errors";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";

// Derive from/to from YYYY-MM string
function monthToRange(yyyyMm: string): { from: string; to: string } {
  const d = parseISO(`${yyyyMm}-01`);
  return {
    from: format(startOfMonth(d), "yyyy-MM-dd"),
    to: format(endOfMonth(d), "yyyy-MM-dd"),
  };
}

function currentMonth(): string {
  return format(new Date(), "yyyy-MM");
}

function maxMonth(): string {
  return format(new Date(), "yyyy-MM");
}

// ── Attendance rate bar ───────────────────────────────────────────────────────
function RateBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color =
    pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
      </div>
      <span className="text-xs tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SummarySkeleton() {
  return (
    <div
      className="animate-pulse space-y-4"
      aria-busy="true"
      aria-label="Loading summary"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="h-64 bg-muted rounded-lg" />
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 text-center">
      <p className={`text-2xl font-bold tabular-nums ${color ?? ""}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AttendanceSummaryPage() {
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());

  const { from, to } = monthToRange(selectedMonth);

  const classesQ = useQuery({
    queryKey: ["classes"],
    queryFn: () => classesApi.list(),
    staleTime: 2 * 60 * 1000,
  });

  const summaryQ = useQuery({
    queryKey: ["attendance-summary", selectedClass, from, to],
    queryFn: () =>
      attendanceApi.getSummary({
        classId: selectedClass || undefined,
        from,
        to,
      }),
    staleTime: 5 * 60 * 1000,
    enabled: true, // Allow summary without class filter
  });

  const apiErr = summaryQ.isError ? parseApiError(summaryQ.error) : null;
  const is403 = apiErr?.code === "FORBIDDEN";
  const is404 = apiErr?.code === "NOT_FOUND";

  const summaryData = summaryQ.data as
    | {
        class?: { id: string; name: string; studentCount: number };
        period?: { from: string; to: string; days: number };
        summary?: {
          totalRecords: number;
          present: number;
          absent: number;
          late: number;
          attendanceRate: number;
        };
        byStudent?: Array<{
          studentId: string;
          studentName: string;
          present: number;
          absent: number;
          late: number;
          attendanceRate: number;
        }>;
      }
    | undefined;

  const summary = summaryData?.summary;
  const byStudent = summaryData?.byStudent ?? [];
  const periodInfo = summaryData?.period;
  const classInfo = summaryData?.class;
  const hasData = !!summary && summary.totalRecords > 0;

  const monthLabel = format(parseISO(`${selectedMonth}-01`), "MMMM yyyy");

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Attendance Summary</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Monthly overview by class
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div>
          <label
            htmlFor="classFilter"
            className="block text-xs font-medium text-muted-foreground mb-1"
          >
            Class
          </label>
          <select
            id="classFilter"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All Classes</option>
            {classesQ.data?.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="monthPicker"
            className="block text-xs font-medium text-muted-foreground mb-1"
          >
            Month
          </label>
          <input
            id="monthPicker"
            type="month"
            value={selectedMonth}
            max={maxMonth()}
            onChange={(e) => setSelectedMonth(e.target.value)}
            aria-label="Select month"
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Inline error states */}
      {is403 && (
        <div
          role="alert"
          className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground mb-4"
        >
          Not authorized to view attendance summary.
        </div>
      )}
      {is404 && (
        <div
          role="alert"
          className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground mb-4"
        >
          No data found for the selected class.
        </div>
      )}

      {summaryQ.isLoading && <SummarySkeleton />}

      {/* Empty state */}
      {!summaryQ.isLoading && !summaryQ.isError && !hasData && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No attendance data for {monthLabel}
            {classInfo ? ` · ${classInfo.name}` : ""}.
          </p>
        </div>
      )}

      {/* Summary cards + table */}
      {!summaryQ.isLoading && !summaryQ.isError && hasData && summary && (
        <>
          {/* Context */}
          <div className="mb-4 text-sm text-muted-foreground">
            {classInfo && (
              <span className="font-medium text-foreground">
                {classInfo.name}
              </span>
            )}
            {classInfo && <span className="mx-1.5">·</span>}
            <span>{monthLabel}</span>
            {periodInfo && (
              <span className="ml-1.5">
                ({periodInfo.days} school day{periodInfo.days !== 1 ? "s" : ""})
              </span>
            )}
            {classInfo?.studentCount !== undefined && (
              <span className="ml-1.5">
                · {classInfo.studentCount} students
              </span>
            )}
          </div>

          {/* Summary stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatCard label="Total Records" value={summary.totalRecords} />
            <StatCard
              label="Present"
              value={summary.present}
              color="text-green-600"
            />
            <StatCard
              label="Absent"
              value={summary.absent}
              color="text-red-600"
            />
            <StatCard
              label="Late"
              value={summary.late}
              color="text-yellow-600"
            />
          </div>

          {/* Attendance rate summary card */}
          <div className="rounded-lg border bg-card p-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                Overall Attendance Rate
              </span>
              <span className="text-lg font-bold tabular-nums">
                {Math.round(summary.attendanceRate * 100)}%
              </span>
            </div>
            <RateBar rate={summary.attendanceRate} />
          </div>

          {/* Per-student breakdown */}
          {byStudent.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <table
                className="w-full text-sm"
                aria-label={`Attendance breakdown for ${monthLabel}`}
              >
                <caption className="sr-only">
                  Per-student attendance breakdown for {monthLabel}
                </caption>
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                    >
                      Student
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                    >
                      Present
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                    >
                      Absent
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                    >
                      Late
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-40"
                    >
                      Rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byStudent.map((row) => (
                    <tr
                      key={row.studentId}
                      className="border-b last:border-b-0 hover:bg-muted/20"
                    >
                      <td className="px-4 py-2.5 font-medium">
                        {row.studentName}
                      </td>
                      <td className="px-4 py-2.5 text-center text-green-700 tabular-nums">
                        {row.present}
                      </td>
                      <td className="px-4 py-2.5 text-center text-red-700 tabular-nums">
                        {row.absent}
                      </td>
                      <td className="px-4 py-2.5 text-center text-yellow-700 tabular-nums">
                        {row.late}
                      </td>
                      <td className="px-4 py-2.5">
                        <RateBar rate={row.attendanceRate} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
