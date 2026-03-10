/**
 * RecordAttendancePage — Freeze §Screen: Record Attendance
 *
 * Flow:
 *  1. Load today's slots (Teacher: own slots only, Admin: all)
 *  2. User selects a slot → load all students
 *  3. User sets defaultStatus (Present/Absent/Late) — applies to ALL students
 *  4. Override individual students via exceptions Map
 *  5. POST /attendance/record-class
 *
 * WHY exceptions as Map<studentId, status>:
 * Freeze §Screen: "exceptions stored as a Map for O(1) lookup."
 * On render, each student row checks map.has(id) — constant time regardless of class size.
 * Students NOT in the map inherit defaultStatus.
 *
 * Permissions (Freeze §Screen):
 *   Teacher → GET /timetable?teacherId=currentUser.id&dayOfWeek=today (own slots only)
 *   Admin   → GET /timetable?dayOfWeek=today (all slots)
 *
 * Error codes:
 *   400 future date      → inline "Attendance cannot be recorded for a future date."
 *   409 already recorded → inline "Attendance already recorded for this class, date, and period."
 *   403 FEATURE_DISABLED → full-page feature-not-enabled state
 *   403 not assigned     → toast "You are not assigned to this class."
 */
import { useState, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  useQuery,
  useMutation,
  useQueryClient,
  useQueries,
} from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { timetableApi } from "@/api/timetable";
import { studentsApi } from "@/api/students";
import { attendanceApi } from "@/api/attendance";
import { todayISO, todayDayOfWeek } from "@/utils/dates";
import { parseApiError } from "@/utils/errors";
import { cn } from "@/utils/cn";
import { AT_RISK_THRESHOLD } from "@/utils/attendance";
import type { TimeSlot, Student, AttendanceStreak } from "@/types/api";

type AttendanceStatus = "Present" | "Absent" | "Late";

const STATUS_OPTIONS: AttendanceStatus[] = ["Present", "Absent", "Late"];

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  Present: "text-green-700 border-green-300 bg-green-50",
  Absent: "text-red-700 border-red-300 bg-red-50",
  Late: "text-yellow-700 border-yellow-300 bg-yellow-50",
};

// ── Skeleton rows ─────────────────────────────────────────────────────────────
function StudentRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b animate-pulse">
      <div className="h-4 bg-muted rounded w-40 flex-1" />
      <div className="flex gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-20 bg-muted rounded" />
        ))}
      </div>
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
        Attendance feature not enabled for your school.
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        Contact your platform administrator to enable it.
      </p>
    </div>
  );
}

// ── Student row ───────────────────────────────────────────────────────────────
interface StudentRowProps {
  student: Student;
  defaultStatus: AttendanceStatus;
  exception: AttendanceStatus | undefined;
  onStatusChange: (
    studentId: string,
    status: AttendanceStatus | undefined,
  ) => void;
}

function StudentRow({
  student,
  defaultStatus,
  exception,
  onStatusChange,
}: StudentRowProps) {
  const effectiveStatus = exception ?? defaultStatus;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 hover:bg-muted/20">
      {/* Student name */}
      <span className="flex-1 text-sm font-medium break-words min-w-0">
        {student.name}
      </span>

      {/* Status radio group — WCAG: aria-label per student */}
      <div
        role="radiogroup"
        aria-label={`${student.name} attendance status`}
        className="flex gap-1.5 shrink-0"
      >
        {STATUS_OPTIONS.map((status) => {
          const isSelected = effectiveStatus === status;
          const isDefault = exception === undefined && defaultStatus === status;
          return (
            <label
              key={status}
              className={cn(
                "flex items-center justify-center rounded border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors select-none min-h-[36px] min-w-[32px] sm:min-w-[60px]",
                isSelected
                  ? STATUS_COLORS[status]
                  : "text-muted-foreground border-input hover:bg-muted",
                isDefault && !exception ? "opacity-70" : "",
              )}
            >
              <input
                type="radio"
                name={`status-${student.id}`}
                value={status}
                checked={isSelected}
                onChange={() => {
                  // If user picks the same as defaultStatus, clear exception
                  onStatusChange(
                    student.id,
                    status === defaultStatus ? undefined : status,
                  );
                }}
                className="sr-only"
                aria-label={`${status} for ${student.name}`}
              />
              <span className="sm:hidden" aria-hidden="true">
                {status[0]}
              </span>
              <span className="hidden sm:inline" aria-hidden="true">
                {status}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RecordAttendancePage() {
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isAdmin = user?.activeRole === "Admin";

  // Pre-select slot from Dashboard "Record Attendance" click
  const preselectedSlotId =
    (location.state as { slotId?: string } | null)?.slotId ?? "";

  const [selectedSlotId, setSelectedSlotId] = useState(preselectedSlotId);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [defaultStatus, setDefaultStatus] =
    useState<AttendanceStatus>("Present");
  // Map<studentId, overrideStatus> — O(1) lookup per Freeze
  const [exceptions, setExceptions] = useState<Map<string, AttendanceStatus>>(
    new Map(),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  // True after 409 — activates per-student PUT mode behind the same UI
  const [alreadyRecorded, setAlreadyRecorded] = useState(false);
  // At-risk panel expansion state
  const [atRiskOpen, setAtRiskOpen] = useState(false);

  // ── Slot list query ───────────────────────────────────────────────────────
  const slotsQ = useQuery({
    queryKey: [
      "timetable",
      {
        dayOfWeek: todayDayOfWeek(),
        teacherId: isAdmin ? undefined : user?.id,
      },
    ],
    queryFn: () =>
      timetableApi.list({
        dayOfWeek: todayDayOfWeek(),
        teacherId: isAdmin ? undefined : user?.id,
      }),
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  const slots = slotsQ.data?.timetable ?? [];

  // Derived: selected slot object
  const selectedSlot: TimeSlot | undefined = slots.find(
    (s) => s.id === selectedSlotId,
  );

  // ── At-risk streaks query (CR-FE-016d) ──────────────────────────────────
  const streaksQ = useQuery({
    queryKey: ["streaks", selectedSlotId],
    queryFn: () => attendanceApi.getStreaks(selectedSlotId),
    staleTime: 3 * 60 * 1000,
    enabled: !!selectedSlotId,
  });
  const atRiskStudents: AttendanceStreak[] = (
    streaksQ.data?.streaks ?? []
  ).filter((s) => s.consecutiveAbsentCount >= AT_RISK_THRESHOLD);

  // ── Students query — loads when slot selected ─────────────────────────────
  const studentsQ = useQuery({
    queryKey: ["students"],
    queryFn: () => studentsApi.list(),
    staleTime: 2 * 60 * 1000,
    enabled: !!selectedSlotId,
  });

  // Filter students by class of selected slot
  const allStudents = studentsQ.data?.students ?? [];
  const classStudents = selectedSlot
    ? allStudents.filter((s) => s.classId === selectedSlot.classId)
    : [];

  // ── Correction queries — one per student, enabled after 409 ALREADY_RECORDED ───
  const correctionQueries = useQueries({
    queries: classStudents.map((student) => ({
      queryKey: ["student-attendance", student.id, selectedDate, "correction"],
      queryFn: () =>
        attendanceApi.getStudentHistory(student.id, {
          from: selectedDate,
          to: selectedDate,
          limit: 10,
          offset: 0,
        }),
      staleTime: 0,
      enabled: !!selectedSlotId && !!selectedDate && classStudents.length > 0,
    })),
  });

  // Map studentId → existing attendance record for this slot+date
  const correctionRecordMap = new Map<
    string,
    { id: string; status: AttendanceStatus }
  >();
  correctionQueries.forEach((result, i) => {
    const student = classStudents[i];
    if (result.data && student) {
      const match = result.data.records.find(
        (r) => r.timeSlot.id === selectedSlotId,
      );
      if (match)
        correctionRecordMap.set(student.id, {
          id: match.id,
          status: match.status as AttendanceStatus,
        });
    }
  });
  const correctionLoading = correctionQueries.some((q) => q.isLoading);

  // Stable key — changes whenever any correction query settles
  const correctionFetchId = correctionQueries
    .map((q) => `${q.status}:${q.dataUpdatedAt ?? 0}`)
    .join(",");

  // Auto-detect already-recorded — sets alreadyRecorded before teacher clicks Save
  useEffect(() => {
    if (!selectedSlotId || correctionLoading) return;
    const hasRecords = correctionQueries.some((result) =>
      result.data?.records.some((r) => r.timeSlot.id === selectedSlotId),
    );
    setAlreadyRecorded(hasRecords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correctionFetchId, selectedSlotId, selectedDate]);

  // Auto-seed exceptions + defaultStatus from existing records once loaded
  useEffect(() => {
    if (!alreadyRecorded || correctionLoading || correctionRecordMap.size === 0)
      return;
    const counts: Record<AttendanceStatus, number> = {
      Present: 0,
      Absent: 0,
      Late: 0,
    };
    correctionRecordMap.forEach((r) => {
      counts[r.status]++;
    });
    const mostCommon = Object.entries(counts).sort(
      (a, b) => b[1] - a[1],
    )[0]![0] as AttendanceStatus;
    setDefaultStatus(mostCommon);
    const seed = new Map<string, AttendanceStatus>();
    correctionRecordMap.forEach((r, studentId) => {
      if (r.status !== mostCommon) seed.set(studentId, r.status);
    });
    setExceptions(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadyRecorded, correctionLoading]);

  // ── Exception handlers ────────────────────────────────────────────────────
  const handleStatusChange = useCallback(
    (studentId: string, status: AttendanceStatus | undefined) => {
      setExceptions((prev) => {
        const next = new Map(prev);
        if (status === undefined) next.delete(studentId);
        else next.set(studentId, status);
        return next;
      });
    },
    [],
  );

  // Reset all state when slot changes
  function handleSlotChange(slotId: string) {
    setSelectedSlotId(slotId);
    setExceptions(new Map());
    setSubmitError(null);
    setSuccessMsg(null);
    setAlreadyRecorded(false);
    setAtRiskOpen(false);
  }

  function handleDefaultStatusChange(status: AttendanceStatus) {
    setDefaultStatus(status);
    setExceptions(new Map()); // clear overrides — new default applies to all
  }

  // ── Bulk correction mutation — fires parallel PUTs for all staged changes ──
  const updateMut = useMutation({
    mutationFn: () => {
      const calls = classStudents.flatMap((student) => {
        const original = correctionRecordMap.get(student.id);
        if (!original) return [];
        const desired = exceptions.get(student.id) ?? defaultStatus;
        if (desired === original.status) return [];
        return [attendanceApi.correctRecord(original.id, { status: desired })];
      });
      if (calls.length === 0) return Promise.resolve([]);
      return Promise.all(calls);
    },
    onSuccess: async (results) => {
      const updated = Array.isArray(results) ? results.length : 0;
      setSubmitError(null);
      setSuccessMsg(
        updated === 0
          ? "No changes to save."
          : `Attendance updated for ${updated} student${
              updated !== 1 ? "s" : ""
            }.`,
      );
      setAlreadyRecorded(false);
      await queryClient.invalidateQueries({ queryKey: ["student-attendance"] });
      await queryClient.invalidateQueries({ queryKey: ["attendance-summary"] });
    },
    onError: (err) => {
      setSubmitError(parseApiError(err).message);
    },
  });

  // ── Submit mutation ───────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: () =>
      attendanceApi.recordClass({
        timeSlotId: selectedSlotId,
        date: selectedDate,
        defaultStatus,
        exceptions: Array.from(exceptions.entries()).map(
          ([studentId, status]) => ({
            studentId,
            status,
          }),
        ),
      }),
    onSuccess: async (data) => {
      setSubmitError(null);
      setSuccessMsg(
        `${data.recorded} records saved. ${data.present} present, ${data.absent} absent, ${data.late} late.`,
      );
      setExceptions(new Map());
      await queryClient.invalidateQueries({ queryKey: ["student-attendance"] });
      await queryClient.invalidateQueries({ queryKey: ["attendance-summary"] });
    },
    onError: (err) => {
      const { code, message } = parseApiError(err);
      if (code === "FUTURE_DATE" || code === "INVALID_DATE") {
        setSubmitError("Attendance cannot be recorded for a future date.");
      } else if (
        code === "DUPLICATE" ||
        code === "ATTENDANCE_ALREADY_RECORDED"
      ) {
        setAlreadyRecorded(true);
        setSubmitError(null); // UI switches to update mode automatically
      } else if (code === "FORBIDDEN" || code === "NOT_ASSIGNED") {
        setSubmitError("You are not assigned to this class.");
      } else {
        setSubmitError(message);
      }
    },
  });

  // Feature disabled check
  const apiErr = slotsQ.isError ? parseApiError(slotsQ.error) : null;
  if (apiErr?.code === "FEATURE_DISABLED") {
    return (
      <div className="p-6">
        <FeatureDisabledState />
      </div>
    );
  }

  const canSubmit =
    !!selectedSlotId &&
    !!selectedDate &&
    !mutation.isPending &&
    !updateMut.isPending;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Record Attendance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isAdmin ? "All class slots" : "Your assigned slots"}
        </p>
      </div>

      {/* Step 1 — Select slot + date */}
      <div className="rounded-lg border bg-card p-4 mb-4 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          1. Select Class
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Slot selector */}
          <div>
            <label
              htmlFor="slotSelect"
              className="block text-sm font-medium mb-1.5"
            >
              Class Period
            </label>
            <select
              id="slotSelect"
              value={selectedSlotId}
              onChange={(e) => handleSlotChange(e.target.value)}
              disabled={slotsQ.isLoading}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <option value="">
                {slotsQ.isLoading
                  ? "Loading slots…"
                  : slots.length === 0
                    ? "No slots for today"
                    : "Select a slot…"}
              </option>
              {slots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  P{slot.periodNumber} · {slot.className} · {slot.subjectName}
                  {slot.startTime ? ` (${slot.startTime})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label
              htmlFor="attendanceDate"
              className="block text-sm font-medium mb-1.5"
            >
              Date
            </label>
            <input
              id="attendanceDate"
              type="date"
              value={selectedDate}
              max={todayISO()}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSubmitError(null);
                setAlreadyRecorded(false);
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* At-Risk Students panel (CR-FE-016d) — shown when slot selected + at-risk exist */}
      {selectedSlotId && !streaksQ.isLoading && atRiskStudents.length > 0 && (
        <section
          className="rounded-lg border border-amber-200 bg-amber-50 mb-4 overflow-hidden"
          aria-label="At-risk students"
        >
          <button
            type="button"
            onClick={() => setAtRiskOpen((v) => !v)}
            aria-expanded={atRiskOpen}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
              At-Risk Students —
              <span className="inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900">
                {atRiskStudents.length}
              </span>
              <span className="text-xs font-normal text-amber-700">
                ({AT_RISK_THRESHOLD}+ consecutive absences)
              </span>
            </span>
            <svg
              className={`h-4 w-4 text-amber-600 transition-transform ${atRiskOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {atRiskOpen && (
            <ul
              className="px-4 pb-3 space-y-1.5 border-t border-amber-200"
              aria-label="At-risk student list"
            >
              {atRiskStudents.map((s) => (
                <li
                  key={s.studentId}
                  className="flex items-center justify-between pt-2 text-sm"
                >
                  <span className="text-amber-900 font-medium truncate">
                    {allStudents.find((st) => st.id === s.studentId)?.name ??
                      s.studentId}
                  </span>
                  <span className="shrink-0 ml-2 inline-flex items-center rounded-full bg-amber-600 px-2 py-0.5 text-xs font-bold text-white">
                    {s.consecutiveAbsentCount} absent
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Step 2 — Default status */}
      {selectedSlotId && (
        <div className="rounded-lg border bg-card p-4 mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            2. Default Status
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            Applied to all students. Override individually below.
          </p>
          <div
            role="radiogroup"
            aria-label="Default attendance status"
            className="flex gap-2 flex-wrap"
          >
            {STATUS_OPTIONS.map((status) => (
              <label
                key={status}
                className={cn(
                  "flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium cursor-pointer transition-colors min-h-[44px] min-w-[80px]",
                  defaultStatus === status
                    ? STATUS_COLORS[status]
                    : "text-muted-foreground border-input hover:bg-muted",
                )}
              >
                <input
                  type="radio"
                  name="defaultStatus"
                  value={status}
                  checked={defaultStatus === status}
                  onChange={() => handleDefaultStatusChange(status)}
                  className="sr-only"
                />
                {status}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Step 3 — Student list */}
      {selectedSlotId && (
        <div className="rounded-lg border bg-card mb-4">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              3. Students
            </h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {classStudents.length > 0 && (
                <>
                  <span>{classStudents.length} students</span>
                  {exceptions.size > 0 && (
                    <span className="text-primary">
                      {exceptions.size} override{exceptions.size > 1 ? "s" : ""}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Loading */}
          {(studentsQ.isLoading || correctionLoading) && (
            <div aria-busy="true" aria-label="Loading students">
              {Array.from({ length: 5 }).map((_, i) => (
                <StudentRowSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Empty */}
          {!studentsQ.isLoading &&
            !correctionLoading &&
            classStudents.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No students found in this class.
              </div>
            )}

          {/* Student rows */}
          {!studentsQ.isLoading &&
            !correctionLoading &&
            classStudents.length > 0 && (
              <div role="list" aria-label="Student attendance">
                {classStudents.map((student) => (
                  <div key={student.id} role="listitem">
                    <StudentRow
                      student={student}
                      defaultStatus={defaultStatus}
                      exception={exceptions.get(student.id)}
                      onStatusChange={handleStatusChange}
                    />
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* Errors / success */}
      {submitError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4"
        >
          {submitError}
        </div>
      )}
      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 mb-4"
        >
          ✓ {successMsg}
        </div>
      )}

      {/* Single action button — label/handler switches based on alreadyRecorded */}
      {selectedSlotId && classStudents.length > 0 && (
        <button
          onClick={() => {
            setSubmitError(null);
            setSuccessMsg(null);
            if (alreadyRecorded) {
              updateMut.mutate();
            } else {
              mutation.mutate();
            }
          }}
          disabled={!canSubmit || correctionLoading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 min-h-[48px]"
        >
          {correctionLoading && !alreadyRecorded ? (
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
              Checking…
            </>
          ) : mutation.isPending || updateMut.isPending ? (
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
              {alreadyRecorded ? "Updating…" : "Saving…"}
            </>
          ) : alreadyRecorded ? (
            `Update Attendance for ${classStudents.length} Student${
              classStudents.length > 1 ? "s" : ""
            }`
          ) : (
            `Save Attendance for ${classStudents.length} Student${
              classStudents.length > 1 ? "s" : ""
            }`
          )}
        </button>
      )}
    </div>
  );
}
