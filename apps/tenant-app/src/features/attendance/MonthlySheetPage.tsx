/**
 * MonthlySheetPage — Freeze §Screen: Monthly Attendance Sheet (v4.5 CR-36 / CR-FE-016f)
 *
 * Route:  /attendance/monthly-sheet  (Admin + Teacher, feature: attendance)
 * API:    GET /attendance/monthly-sheet?classId=&subjectId=&year=&month=
 * TQ key: ['monthly-sheet', classId, subjectId, year, month]  stale: 5 min
 *
 * Grid: students as rows, days 1–<daysInMonth> as columns.
 * Each cell shows the attendance status for that student on that day.
 * When multiple slots exist for the same day (same subject), the worst status wins:
 *   Absent > Late > Present.
 *
 * Teachers can only see their own class+subject (backend enforces 403 otherwise).
 * Frontend shows the 403 inline.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { attendanceApi } from "@/api/attendance";
import { classesApi } from "@/api/classes";
import { subjectsApi } from "@/api/subjects";
import { parseApiError } from "@/utils/errors";

// ── Constants ─────────────────────────────────────────────────────────────────
const THIS_YEAR = new Date().getFullYear();
const THIS_MONTH = new Date().getMonth() + 1;

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

// ── Cell colour ───────────────────────────────────────────────────────────────
function statusCls(status: string | null): string {
  if (status === "Present") return "bg-green-100 text-green-800";
  if (status === "Absent") return "bg-red-100 text-red-800";
  if (status === "Late") return "bg-amber-100 text-amber-800";
  return "bg-muted/30 text-muted-foreground";
}

function statusLabel(status: string | null): string {
  if (status === "Present") return "P";
  if (status === "Absent") return "A";
  if (status === "Late") return "L";
  return "·";
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SheetSkeleton() {
  return (
    <div
      className="animate-pulse space-y-2"
      aria-busy="true"
      aria-label="Loading monthly sheet"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-1">
          <div className="h-8 w-32 bg-muted rounded shrink-0" />
          {Array.from({ length: 10 }).map((_, j) => (
            <div key={j} className="h-8 flex-1 bg-muted rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Select helpers ─────────────────────────────────────────────────────────────
const selectCls =
  "rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const labelCls = "block text-xs font-medium text-muted-foreground mb-1";

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MonthlySheetPage() {
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [year, setYear] = useState(THIS_YEAR);
  const [month, setMonth] = useState(THIS_MONTH);

  const classesQ = useQuery({
    queryKey: ["classes"],
    queryFn: () => classesApi.list(),
    staleTime: 2 * 60 * 1000,
  });

  const subjectsQ = useQuery({
    queryKey: ["subjects"],
    queryFn: () => subjectsApi.list(),
    staleTime: 2 * 60 * 1000,
  });

  const sheetQ = useQuery({
    queryKey: ["monthly-sheet", classId, subjectId, year, month],
    queryFn: () =>
      attendanceApi.getMonthlySheet({ classId, subjectId, year, month }),
    staleTime: 5 * 60 * 1000,
    enabled: !!classId && !!subjectId,
  });

  const apiErr = sheetQ.isError ? parseApiError(sheetQ.error) : null;
  const is403 = apiErr?.code === "FORBIDDEN";

  const daysInMonth = new Date(year, month, 0).getDate();
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const students = sheetQ.data?.students ?? [];

  const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? "";
  const className =
    classesQ.data?.classes.find((c) => c.id === classId)?.name ?? "";
  const subjectName =
    subjectsQ.data?.subjects.find((s) => s.id === subjectId)?.name ?? "";

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Monthly Attendance Sheet</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Student × day attendance grid
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div>
          <label htmlFor="msClassFilter" className={labelCls}>
            Class <span aria-hidden="true">*</span>
          </label>
          <select
            id="msClassFilter"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className={selectCls}
            aria-label="Select class"
            aria-required="true"
          >
            <option value="">— Select a class —</option>
            {classesQ.data?.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="msSubjectFilter" className={labelCls}>
            Subject <span aria-hidden="true">*</span>
          </label>
          <select
            id="msSubjectFilter"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className={selectCls}
            aria-label="Select subject"
            aria-required="true"
          >
            <option value="">— Select a subject —</option>
            {subjectsQ.data?.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="msYearFilter" className={labelCls}>
            Year
          </label>
          <select
            id="msYearFilter"
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

        <div>
          <label htmlFor="msMonthFilter" className={labelCls}>
            Month
          </label>
          <select
            id="msMonthFilter"
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
      </div>

      {/* Prompt to select class + subject */}
      {(!classId || !subjectId) && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Select a class and subject to view the monthly sheet.
          </p>
        </div>
      )}

      {/* 403 — teacher not assigned */}
      {classId && subjectId && is403 && (
        <div
          role="alert"
          className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground"
        >
          You are not assigned to teach this subject in this class.
        </div>
      )}

      {/* Other errors */}
      {classId && subjectId && sheetQ.isError && !is403 && apiErr && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {apiErr.message ?? "Failed to load monthly sheet."}
        </div>
      )}

      {/* Loading */}
      {classId && subjectId && sheetQ.isLoading && <SheetSkeleton />}

      {/* Empty */}
      {classId &&
        subjectId &&
        !sheetQ.isLoading &&
        !sheetQ.isError &&
        students.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No attendance records found for {subjectName} in {className},{" "}
              {monthLabel} {year}.
            </p>
          </div>
        )}

      {/* Grid */}
      {classId &&
        subjectId &&
        !sheetQ.isLoading &&
        !sheetQ.isError &&
        students.length > 0 && (
          <div className="space-y-4">
            {/* Context label */}
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{className}</span>
              <span className="mx-1.5">·</span>
              <span className="font-medium text-foreground">{subjectName}</span>
              <span className="mx-1.5">·</span>
              <span>
                {monthLabel} {year}
              </span>
            </div>

            {/* Legend */}
            <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <span className="inline-block w-5 h-5 rounded text-center leading-5 bg-green-100 text-green-800 font-medium">
                  P
                </span>
                Present
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-5 h-5 rounded text-center leading-5 bg-red-100 text-red-800 font-medium">
                  A
                </span>
                Absent
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-5 h-5 rounded text-center leading-5 bg-amber-100 text-amber-800 font-medium">
                  L
                </span>
                Late
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-5 h-5 rounded text-center leading-5 bg-muted/30 text-muted-foreground font-medium">
                  ·
                </span>
                No record
              </span>
            </div>

            {/* Scrollable grid */}
            <div className="overflow-x-auto -mx-4 md:mx-0 rounded-lg border">
              <div
                role="table"
                aria-label={`Monthly attendance sheet: ${subjectName} – ${className}, ${monthLabel} ${year}`}
                style={{ minWidth: `${daysInMonth * 36 + 200}px` }}
              >
                {/* Header row — day numbers */}
                <div
                  role="row"
                  className="flex bg-muted/50 border-b sticky top-0"
                >
                  <div
                    role="columnheader"
                    className="w-44 shrink-0 px-3 py-2 text-xs font-semibold text-muted-foreground"
                  >
                    Student
                  </div>
                  {dayNumbers.map((d) => (
                    <div
                      key={d}
                      role="columnheader"
                      className="w-9 shrink-0 text-center px-1 py-2 text-xs font-medium text-muted-foreground"
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Data rows */}
                {students.map((student) => (
                  <div
                    key={student.studentId}
                    role="row"
                    className="flex border-b last:border-b-0 hover:bg-muted/10"
                  >
                    {/* Student name + admission number */}
                    <div
                      role="rowheader"
                      className="w-44 shrink-0 px-3 py-2 truncate"
                    >
                      <span className="text-sm font-medium block truncate">
                        {student.studentName}
                      </span>
                      <span className="text-xs text-muted-foreground block truncate">
                        {student.admissionNumber}
                      </span>
                    </div>

                    {/* Day cells — one badge per timeslot, stacked vertically */}
                    {dayNumbers.map((d) => {
                      const records = student.days[String(d)] ?? [];
                      const ariaDesc =
                        records.length === 0
                          ? "no record"
                          : records.map((r) => r.status).join(", ");
                      return (
                        <div
                          key={d}
                          role="cell"
                          aria-label={`${student.studentName} day ${d}: ${ariaDesc}`}
                          className="w-9 shrink-0 flex flex-col items-center justify-center py-1 gap-0.5"
                        >
                          {records.length === 0 ? (
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${statusCls(null)}`}
                              aria-hidden="true"
                            >
                              ·
                            </span>
                          ) : (
                            records.map((r) => (
                              <span
                                key={r.timeSlotId}
                                className={`inline-flex items-center justify-center w-6 h-5 rounded text-xs font-medium ${statusCls(r.status)}`}
                                aria-label={r.status}
                              >
                                {statusLabel(r.status)}
                              </span>
                            ))
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
