/**
 * AttendanceSummaryPage — Freeze §Screen: Attendance Summary (CR-FE-013c/d)
 *
 * Admin picks a student + year + month.
 * Calls GET /students/{studentId}/attendance/summary?year=&month=
 * TQ key: ['student-attendance-summary', studentId, year, month]  stale: 5 min
 *
 * CR-FE-013d: empty-state guard uses summary.totalClasses === 0
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { attendanceApi } from "@/api/attendance";
import { studentsApi } from "@/api/students";
import { parseApiError } from "@/utils/errors";

// ── Constants ─────────────────────────────────────────────────────────────────
const THIS_YEAR = new Date().getFullYear();
const THIS_MONTH = new Date().getMonth() + 1; // 1-based

const YEARS = Array.from({ length: 5 }, (_, i) => THIS_YEAR - i);
const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

// ── Attendance percentage bar ─────────────────────────────────────────────────
// CR-FE-013d clarification: attendancePercentage is 0–100 (not 0–1 fraction).
function PctBar({ pct }: { pct: number }) {
  const rounded = Math.round(pct);
  const color =
    rounded >= 75
      ? "bg-green-500"
      : rounded >= 50
        ? "bg-yellow-500"
        : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${rounded}%` }}
          aria-hidden="true"
        />
      </div>
      <span className="text-sm tabular-nums font-semibold w-10 text-right">
        {rounded}%
      </span>
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
      <div className="h-16 bg-muted rounded-lg" />
    </div>
  );
}

// ── Select helpers ────────────────────────────────────────────────────────────
const selectCls =
  "rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labelCls = "block text-xs font-medium text-muted-foreground mb-1";

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AttendanceSummaryPage() {
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedYear, setSelectedYear] = useState(THIS_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(THIS_MONTH);

  // Fetch students for the picker (Admin only route)
  const studentsQ = useQuery({
    queryKey: ["students-list-picker"],
    queryFn: () => studentsApi.list({ limit: 500 }),
    staleTime: 2 * 60 * 1000,
  });

  // CR-25: monthly attendance summary
  const summaryQ = useQuery({
    queryKey: [
      "student-attendance-summary",
      selectedStudentId,
      selectedYear,
      selectedMonth,
    ],
    queryFn: () =>
      attendanceApi.getStudentSummary(
        selectedStudentId,
        selectedYear,
        selectedMonth,
      ),
    staleTime: 5 * 60 * 1000,
    enabled: !!selectedStudentId,
  });

  const apiErr = summaryQ.isError ? parseApiError(summaryQ.error) : null;
  const is403 =
    apiErr?.code === "FORBIDDEN" || apiErr?.code === "STUDENT_ACCESS_DENIED";
  const is404 = apiErr?.code === "NOT_FOUND";

  const summary = summaryQ.data?.summary;

  // CR-FE-013d: empty state guard — totalClasses === 0 (NOT totalRecords)
  const hasData = !!summary && summary.totalClasses > 0;

  const monthLabel = MONTHS.find((m) => m.value === selectedMonth)?.label ?? "";
  const selectedStudentName =
    studentsQ.data?.students.find((s) => s.id === selectedStudentId)?.name ??
    "";

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Attendance Summary</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Monthly attendance summary for a student
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* Student selector */}
        <div>
          <label htmlFor="studentFilter" className={labelCls}>
            Student
          </label>
          <select
            id="studentFilter"
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className={selectCls}
            aria-label="Select student"
          >
            <option value="">— Select a student —</option>
            {studentsQ.data?.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Year selector */}
        <div>
          <label htmlFor="yearFilter" className={labelCls}>
            Year
          </label>
          <select
            id="yearFilter"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className={selectCls}
            aria-label="Select year"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Month selector */}
        <div>
          <label htmlFor="monthFilter" className={labelCls}>
            Month
          </label>
          <select
            id="monthFilter"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className={selectCls}
            aria-label="Select month"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* No student selected */}
      {!selectedStudentId && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Select a student to view their attendance summary.
          </p>
        </div>
      )}

      {/* Error states */}
      {selectedStudentId && is403 && (
        <div
          role="alert"
          className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground mb-4"
        >
          Access denied — you are not authorised to view this student's
          attendance.
        </div>
      )}
      {selectedStudentId && is404 && (
        <div
          role="alert"
          className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground mb-4"
        >
          Student not found.
        </div>
      )}
      {selectedStudentId && summaryQ.isError && !is403 && !is404 && apiErr && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive mb-4"
        >
          {apiErr.message ?? "Failed to load attendance summary."}
        </div>
      )}

      {/* Loading skeleton */}
      {selectedStudentId && summaryQ.isLoading && <SummarySkeleton />}

      {/* Empty state — CR-FE-013d: guard on totalClasses */}
      {selectedStudentId &&
        !summaryQ.isLoading &&
        !summaryQ.isError &&
        summary &&
        !hasData && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No attendance records for {selectedStudentName} in {monthLabel}{" "}
              {selectedYear}.
            </p>
          </div>
        )}

      {/* Results */}
      {selectedStudentId &&
        !summaryQ.isLoading &&
        !summaryQ.isError &&
        hasData &&
        summary && (
          <div className="space-y-5">
            {/* Context label */}
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {selectedStudentName}
              </span>
              <span className="mx-1.5">·</span>
              <span>
                {monthLabel} {selectedYear}
              </span>
              <span className="ml-1.5">
                · {summary.totalClasses} classes recorded
              </span>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total Classes" value={summary.totalClasses} />
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

            {/* Attendance percentage bar */}
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Attendance</span>
                <span className="text-xs text-muted-foreground">
                  (Present + Late counted)
                </span>
              </div>
              <PctBar pct={summary.attendancePercentage} />
            </div>
          </div>
        )}
    </div>
  );
}
