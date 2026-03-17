/**
 * StudentAttendancePage — Monthly attendance calendar for the logged-in student.
 *
 * Uses CalendarGrid component to display status per day.
 * Month picker defaults to current month.
 * API: GET /students/:studentId/attendance (range-based, converted to calendar format)
 *      GET /students/:studentId/attendance/summary (monthly counts)
 *
 * Path: /student/attendance
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { attendanceApi } from "../../api/attendance";
import { CalendarGrid } from "../../components/CalendarGrid";
import { useAuth } from "../../hooks/useAuth";
import { parseApiError } from "../../utils/errors";
import { QUERY_KEYS } from "../../utils/queryKeys";

const THIS_YEAR = new Date().getFullYear();
const THIS_MONTH = new Date().getMonth() + 1;

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

const YEARS = Array.from({ length: 4 }, (_, i) => THIS_YEAR - i);

const selectCls =
  "rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function StudentAttendancePage() {
  const { user } = useAuth();
  const studentId = user?.studentId ?? null;

  const [year, setYear] = useState(THIS_YEAR);
  const [month, setMonth] = useState(THIS_MONTH);

  // Month string in YYYY-MM for CalendarGrid
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  // Date range for the month
  const from = `${monthStr}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const to = `${monthStr}-${String(daysInMonth).padStart(2, "0")}`;

  // Fetch attendance records for the selected month
  const historyQ = useQuery({
    queryKey: QUERY_KEYS.studentAttendance(studentId ?? "", from, to),
    queryFn: () => attendanceApi.getStudentHistory(studentId!, { from, to }),
    staleTime: 5 * 60 * 1000,
    enabled: !!studentId,
  });

  // Monthly summary (present/absent/late counts)
  const summaryQ = useQuery({
    queryKey: QUERY_KEYS.studentAttendanceSummary(studentId ?? "", year, month),
    queryFn: () => attendanceApi.getStudentSummary(studentId!, year, month),
    staleTime: 5 * 60 * 1000,
    enabled: !!studentId,
  });

  if (!studentId) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold mb-4">My Attendance</h1>
        <div
          role="alert"
          className="rounded-lg border bg-muted/20 px-4 py-8 text-center"
        >
          <p className="text-sm text-muted-foreground">
            Your student profile is not linked. Contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  // Convert records to CalendarGrid format — use first record per day as canonical status
  const dayMap: Record<string, string> = {};
  for (const rec of historyQ.data?.records ?? []) {
    // If multiple records for same day, latest status wins (server returns sorted)
    dayMap[rec.date] = rec.status;
  }

  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const date = `${monthStr}-${String(d).padStart(2, "0")}`;
    const dayOfWeek = new Date(date + "T00:00:00").getDay();
    return { date, dayOfWeek, status: dayMap[date] ?? null };
  });

  const summary = summaryQ.data?.summary;
  const apiError = historyQ.isError ? parseApiError(historyQ.error) : null;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold">My Attendance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Monthly calendar view
        </p>
      </div>

      {/* Month/year picker */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div>
          <label htmlFor="monthPicker" className="sr-only">
            Month
          </label>
          <select
            id="monthPicker"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
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
        <div>
          <label htmlFor="yearPicker" className="sr-only">
            Year
          </label>
          <select
            id="yearPicker"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
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
      </div>

      {/* Summary stats */}
      {summaryQ.isLoading && (
        <div className="animate-pulse flex gap-3 mb-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 flex-1 bg-muted rounded-lg" />
          ))}
        </div>
      )}
      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-lg bg-green-50 p-3 text-center">
            <div className="text-xl font-bold text-green-700">
              {summary.present}
            </div>
            <div className="text-xs text-green-600">Present</div>
          </div>
          <div className="rounded-lg bg-red-50 p-3 text-center">
            <div className="text-xl font-bold text-red-700">
              {summary.absent}
            </div>
            <div className="text-xs text-red-600">Absent</div>
          </div>
          <div className="rounded-lg bg-amber-50 p-3 text-center">
            <div className="text-xl font-bold text-amber-700">
              {summary.late}
            </div>
            <div className="text-xs text-amber-600">Late</div>
          </div>
        </div>
      )}
      {summary && (
        <p className="text-sm text-muted-foreground mb-5">
          Attendance rate:{" "}
          <span className="font-medium text-foreground">
            {summary.attendancePercentage.toFixed(1)}%
          </span>
        </p>
      )}

      {/* Error */}
      {historyQ.isError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive mb-4"
        >
          {apiError?.message ?? "Failed to load attendance records."}
        </div>
      )}

      {/* Loading calendar */}
      {historyQ.isLoading && (
        <div
          className="animate-pulse rounded-lg border bg-card p-4"
          aria-busy="true"
          aria-label="Loading calendar"
        >
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-8 bg-muted rounded" />
            ))}
          </div>
        </div>
      )}

      {/* Calendar */}
      {!historyQ.isLoading && !historyQ.isError && (
        <div className="rounded-lg border bg-card p-4">
          <CalendarGrid month={monthStr} days={calendarDays} />
        </div>
      )}
    </div>
  );
}
