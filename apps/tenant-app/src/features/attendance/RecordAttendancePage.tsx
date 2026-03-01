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
 *   Teacher → GET /timetable?teacherId=currentUser.id&date=today (own slots only)
 *   Admin   → GET /timetable?date=today (all slots)
 *
 * Error codes:
 *   400 future date      → inline "Attendance cannot be recorded for a future date."
 *   409 already recorded → inline "Attendance already recorded for this class, date, and period."
 *   403 FEATURE_DISABLED → full-page feature-not-enabled state
 *   403 not assigned     → toast "You are not assigned to this class."
 */
import { useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { timetableApi } from "@/api/timetable";
import { studentsApi } from "@/api/students";
import { attendanceApi } from "@/api/attendance";
import { todayISO } from "@/utils/dates";
import { parseApiError } from "@/utils/errors";
import { cn } from "@/utils/cn";
import type { TimeSlot, Student } from "@/types/api";

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
      <span className="flex-1 text-sm font-medium truncate min-w-0">
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
                "flex items-center justify-center rounded border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors select-none min-h-[36px] min-w-[60px]",
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
              {status}
            </label>
          );
        })}

        {/* Reset to default button — only shown when overridden */}
        {exception !== undefined && (
          <button
            onClick={() => onStatusChange(student.id, undefined)}
            aria-label={`Reset ${student.name} to default`}
            className="rounded border px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ↺
          </button>
        )}
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

  // ── Slot list query ───────────────────────────────────────────────────────
  const slotsQ = useQuery({
    queryKey: ["timetable", "myToday", todayISO(), user?.activeRole, user?.id],
    queryFn: () =>
      timetableApi.list({
        date: todayISO(),
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

  // Reset exceptions when slot or defaultStatus changes
  function handleSlotChange(slotId: string) {
    setSelectedSlotId(slotId);
    setExceptions(new Map());
    setSubmitError(null);
    setSuccessMsg(null);
  }

  function handleDefaultStatusChange(status: AttendanceStatus) {
    setDefaultStatus(status);
    setExceptions(new Map()); // clear overrides — new default applies to all
  }

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
      } else if (code === "DUPLICATE" || code === "ALREADY_RECORDED") {
        setSubmitError(
          "Attendance already recorded for this class, date, and period.",
        );
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

  const canSubmit = !!selectedSlotId && !!selectedDate && !mutation.isPending;

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
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      </div>

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
          {studentsQ.isLoading && (
            <div aria-busy="true" aria-label="Loading students">
              {Array.from({ length: 5 }).map((_, i) => (
                <StudentRowSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Empty */}
          {!studentsQ.isLoading && classStudents.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No students found in this class.
            </div>
          )}

          {/* Student rows */}
          {!studentsQ.isLoading && classStudents.length > 0 && (
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

      {/* Submit */}
      {selectedSlotId && classStudents.length > 0 && (
        <button
          onClick={() => {
            setSubmitError(null);
            setSuccessMsg(null);
            mutation.mutate();
          }}
          disabled={!canSubmit}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 min-h-[48px]"
        >
          {mutation.isPending ? (
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
            `Save Attendance for ${classStudents.length} Student${classStudents.length > 1 ? "s" : ""}`
          )}
        </button>
      )}
    </div>
  );
}
