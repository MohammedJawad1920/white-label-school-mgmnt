/**
 * AttendanceCorrectionPage — Admin attendance correction.
 * Admin selects class + date, sees attendance grid, can set Excused status.
 * Only Admins can set Excused status.
 */
import { useState, useCallback } from "react";
import { QUERY_KEYS } from "@/utils/queryKeys";
import {
  useQuery,
  useMutation,
  useQueries,
  useQueryClient,
} from "@tanstack/react-query";
import { studentsApi } from "@/api/students";
import { attendanceApi } from "@/api/attendance";
import { classesApi } from "@/api/classes";
import { parseApiError } from "@/utils/errors";
import { useAppToast } from "@/hooks/useAppToast";
import type { AttendanceStatus } from "@/types/api";

const CORRECTION_STATUSES: AttendanceStatus[] = [
  "Present",
  "Absent",
  "Late",
  "Excused",
];

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  Present: "text-green-700 border-green-300 bg-green-50",
  Absent: "text-red-700 border-red-300 bg-red-50",
  Late: "text-yellow-700 border-yellow-300 bg-yellow-50",
  Excused: "text-purple-700 border-purple-300 bg-purple-50",
};

function todayISO(): string {
  return new Date().toISOString().split("T")[0]!;
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

export default function AttendanceCorrectionPage() {
  const qc = useQueryClient();
  const toast = useAppToast();

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [overrides, setOverrides] = useState<Map<string, AttendanceStatus>>(
    new Map(),
  );
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const classesQuery = useQuery({
    queryKey: QUERY_KEYS.classes(),
    queryFn: () => classesApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const studentsQuery = useQuery({
    queryKey: QUERY_KEYS.custom("students", { classId: selectedClassId }),
    queryFn: () => studentsApi.list({ classId: selectedClassId }),
    staleTime: 2 * 60 * 1000,
    enabled: !!selectedClassId,
  });

  const classStudents = studentsQuery.data?.students ?? [];

  // Load each student's attendance for the selected date
  const historyQueries = useQueries({
    queries: classStudents.map((student) => ({
      queryKey: QUERY_KEYS.custom("student-attendance", student.id, selectedDate, "correction"),
      queryFn: () =>
        attendanceApi.getStudentHistory(student.id, {
          from: selectedDate,
          to: selectedDate,
          limit: 50,
          offset: 0,
        }),
      staleTime: 0,
      enabled: !!selectedClassId && !!selectedDate,
    })),
  });

  const recordMap = new Map<string, { id: string; status: AttendanceStatus }>();
  historyQueries.forEach((result, i) => {
    const student = classStudents[i];
    if (result.data && student) {
      const rec = result.data.records[0];
      if (rec) {
        recordMap.set(student.id, {
          id: rec.id,
          status: rec.status as AttendanceStatus,
        });
      }
    }
  });

  const historyLoading = historyQueries.some((q) => q.isLoading);

  const correctionMut = useMutation({
    mutationFn: () => {
      const calls = classStudents.flatMap((student) => {
        const original = recordMap.get(student.id);
        if (!original) return [];
        const desired = overrides.get(student.id) ?? original.status;
        if (desired === original.status) return [];
        return [attendanceApi.correctRecord(original.id, { status: desired })];
      });
      if (calls.length === 0) return Promise.resolve([]);
      return Promise.all(calls);
    },
    onSuccess: (results) => {
      const updated = Array.isArray(results) ? results.length : 0;
      setSubmitError(null);
      setSubmitMsg(
        updated === 0
          ? "No changes to save."
          : `${updated} record${updated !== 1 ? "s" : ""} updated.`,
      );
      if (updated > 0) {
        toast.success("Attendance corrected successfully.");
        void qc.invalidateQueries({ queryKey: QUERY_KEYS.custom("student-attendance") });
      }
    },
    onError: (err) => {
      setSubmitError(parseApiError(err).message);
      toast.mutationError("Failed to save corrections.");
    },
  });

  const handleOverride = useCallback(
    (studentId: string, status: AttendanceStatus) => {
      setOverrides((prev) => {
        const next = new Map(prev);
        const original = recordMap.get(studentId);
        if (original && status === original.status) {
          next.delete(studentId);
        } else {
          next.set(studentId, status);
        }
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historyQueries],
  );

  function handleClassChange(classId: string) {
    setSelectedClassId(classId);
    setOverrides(new Map());
    setSubmitMsg(null);
    setSubmitError(null);
  }

  function handleDateChange(date: string) {
    setSelectedDate(date);
    setOverrides(new Map());
    setSubmitMsg(null);
    setSubmitError(null);
  }

  const classes = classesQuery.data?.classes ?? [];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Attendance Correction</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Correct attendance records for a class on a specific date.
        </p>
      </div>

      {/* Admin-only note */}
      <div
        role="note"
        className="mb-5 flex items-start gap-2 rounded-md bg-purple-50 border border-purple-200 px-3 py-2 text-sm text-purple-800"
      >
        <svg
          className="h-4 w-4 shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Only Admins can set <strong className="mx-1">Excused</strong> status for
        attendance records.
      </div>

      {/* Selectors */}
      <div className="rounded-lg border bg-card p-4 mb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="ac-class"
            className="block text-sm font-medium mb-1.5"
          >
            Class
          </label>
          <select
            id="ac-class"
            value={selectedClassId}
            onChange={(e) => handleClassChange(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Select class…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ac-date" className="block text-sm font-medium mb-1.5">
            Date
          </label>
          <input
            id="ac-date"
            type="date"
            value={selectedDate}
            max={todayISO()}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Student grid */}
      {selectedClassId && (
        <div className="rounded-lg border bg-card mb-5">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Students
              {classStudents.length > 0 && (
                <span className="ml-2 font-normal normal-case text-muted-foreground">
                  ({classStudents.length})
                </span>
              )}
            </h2>
          </div>

          {(studentsQuery.isLoading || historyLoading) && (
            <div aria-busy="true" aria-label="Loading students">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-4 py-3 border-b animate-pulse"
                >
                  <Skeleton className="h-4 flex-1" />
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map((j) => (
                      <Skeleton key={j} className="h-8 w-20" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!studentsQuery.isLoading &&
            !historyLoading &&
            classStudents.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No students in this class.
              </div>
            )}

          {!studentsQuery.isLoading &&
            !historyLoading &&
            classStudents.length > 0 && (
              <div role="list" aria-label="Student attendance correction">
                {classStudents.map((student) => {
                  const existing = recordMap.get(student.id);
                  const currentStatus =
                    overrides.get(student.id) ?? existing?.status;
                  const hasNoRecord = !existing;
                  return (
                    <div
                      key={student.id}
                      role="listitem"
                      className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 hover:bg-muted/20"
                    >
                      <span className="flex-1 text-sm font-medium min-w-0 truncate">
                        {student.name}
                      </span>
                      {hasNoRecord ? (
                        <span className="text-xs text-muted-foreground italic">
                          No record for this date
                        </span>
                      ) : (
                        <div
                          role="radiogroup"
                          aria-label={`${student.name} attendance status`}
                          className="flex gap-1.5 flex-wrap"
                        >
                          {CORRECTION_STATUSES.map((status) => {
                            const isSelected = currentStatus === status;
                            return (
                              <label
                                key={status}
                                className={`flex items-center justify-center rounded border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors min-h-[32px] select-none ${
                                  isSelected
                                    ? STATUS_COLORS[status]
                                    : "text-muted-foreground border-input hover:bg-muted"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`status-${student.id}`}
                                  value={status}
                                  checked={isSelected}
                                  onChange={() =>
                                    handleOverride(student.id, status)
                                  }
                                  className="sr-only"
                                  aria-label={`${status} for ${student.name}`}
                                />
                                {status}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      )}

      {/* Feedback */}
      {submitError && (
        <div
          role="alert"
          className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
        >
          {submitError}
        </div>
      )}
      {submitMsg && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800"
        >
          {submitMsg}
        </div>
      )}

      {/* Save button */}
      {selectedClassId && classStudents.length > 0 && !historyLoading && (
        <button
          type="button"
          disabled={correctionMut.isPending || overrides.size === 0}
          onClick={() => {
            setSubmitMsg(null);
            setSubmitError(null);
            correctionMut.mutate();
          }}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {correctionMut.isPending ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Saving…
            </>
          ) : (
            `Save ${overrides.size > 0 ? `${overrides.size} ` : ""}Correction${overrides.size !== 1 ? "s" : ""}`
          )}
        </button>
      )}
    </div>
  );
}
