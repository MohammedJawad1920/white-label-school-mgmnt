/**
 * StudentAttendanceHistoryPage — Freeze §Screen: Student Attendance History
 *
 * Query: GET /students/:studentId/attendance?from&to&limit=50&offset
 * TQ key: ['student-attendance', studentId, from, to, page]  stale: 2 min
 *
 * Pagination: server-side, limit 50 per page.
 * Page is derived: offset = (page - 1) * 50
 *
 * Error handling:
 *   404 → inline "Student not found."
 *   403 → inline "You do not have access to this student's records."
 *   500 → full-page error with retry
 */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { attendanceApi } from "@/api/attendance";
import { parseApiError } from "@/utils/errors";
import { formatDisplayDate, todayISO } from "@/utils/dates";

const PAGE_LIMIT = 50;

type StatusLabel = "Present" | "Absent" | "Late";

const STATUS_STYLES: Record<StatusLabel, string> = {
  Present: "bg-green-100 text-green-800",
  Absent: "bg-red-100 text-red-800",
  Late: "bg-yellow-100 text-yellow-800",
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div
      className="animate-pulse"
      aria-busy="true"
      aria-label="Loading records"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b">
          <div className="h-4 bg-muted rounded w-24" />
          <div className="h-4 bg-muted rounded w-32 flex-1" />
          <div className="h-4 bg-muted rounded w-20" />
          <div className="h-4 bg-muted rounded w-16" />
        </div>
      ))}
    </div>
  );
}

// ── Pagination controls ───────────────────────────────────────────────────────
interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}
function Pagination({ page, total, limit, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
      <span className="text-muted-foreground">
        Page {page} of {totalPages} ({total} records)
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          ← Prev
        </button>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StudentAttendanceHistoryPage() {
  const { studentId } = useParams<{ studentId: string }>();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const offset = (page - 1) * PAGE_LIMIT;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["student-attendance", studentId, dateFrom, dateTo, page],
    queryFn: () =>
      attendanceApi.getStudentHistory(studentId!, {
        from: dateFrom || undefined,
        to: dateTo || undefined,
        limit: PAGE_LIMIT,
        offset,
      }),
    staleTime: 2 * 60 * 1000,
    enabled: !!studentId,
  });

  // Handle filter changes — reset to page 1
  function handleFilterChange(from: string, to: string) {
    setDateFrom(from);
    setDateTo(to);
    setPage(1);
  }

  // Error classification
  const apiErr = isError ? parseApiError(error) : null;
  const is404 = apiErr?.code === "NOT_FOUND";
  const is403 = apiErr?.code === "FORBIDDEN";
  const is500 = isError && !is404 && !is403;

  const records = data?.records ?? [];
  // Cast student to include className — API returns it but base type omits it
  const student = data?.student as
    | { id: string; name: string; className?: string }
    | undefined;
  const pagination = data?.pagination;
  const total = pagination?.total ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold">
          {student
            ? `${student.name} — Attendance History`
            : "Attendance History"}
        </h1>
        {student?.className && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {student.className}
          </p>
        )}
      </div>

      {/* Inline error states */}
      {is404 && (
        <div
          role="alert"
          className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground"
        >
          Student not found.
        </div>
      )}
      {is403 && (
        <div
          role="alert"
          className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground"
        >
          You do not have access to this student's records.
        </div>
      )}
      {is500 && (
        <div className="flex flex-col items-center py-12 text-center gap-3">
          <p className="text-sm text-muted-foreground">
            Failed to load attendance records.
          </p>
          <button
            onClick={() => void refetch()}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry
          </button>
        </div>
      )}

      {!is404 && !is403 && (
        <>
          {/* Date filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div>
              <label
                htmlFor="dateFrom"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                From
              </label>
              <input
                id="dateFrom"
                type="date"
                value={dateFrom}
                max={dateTo || todayISO()}
                onChange={(e) => handleFilterChange(e.target.value, dateTo)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label
                htmlFor="dateTo"
                className="block text-xs font-medium text-muted-foreground mb-1"
              >
                To
              </label>
              <input
                id="dateTo"
                type="date"
                value={dateTo}
                min={dateFrom}
                max={todayISO()}
                onChange={(e) => handleFilterChange(dateFrom, e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {(dateFrom || dateTo) && (
              <div className="flex items-end">
                <button
                  onClick={() => handleFilterChange("", "")}
                  className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="rounded-lg border overflow-hidden">
            {/* Caption for a11y */}
            <table
              className="w-full text-sm"
              aria-label={
                student
                  ? `${student.name} attendance records`
                  : "Attendance records"
              }
            >
              <caption className="sr-only">
                {student
                  ? `Attendance history for ${student.name}`
                  : "Student attendance history"}
              </caption>
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                  >
                    Subject
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                  >
                    Period
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <TableSkeleton />
                    </td>
                  </tr>
                )}

                {!isLoading && records.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      No attendance records found for this period.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  records.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b last:border-b-0 hover:bg-muted/20"
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {formatDisplayDate(record.date)}
                      </td>
                      <td className="px-4 py-2.5">
                        {record.timeSlot.subjectName ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        P{record.timeSlot.periodNumber}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[record.status as StatusLabel] ?? ""}`}
                        >
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            <Pagination
              page={page}
              total={total}
              limit={PAGE_LIMIT}
              onChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
