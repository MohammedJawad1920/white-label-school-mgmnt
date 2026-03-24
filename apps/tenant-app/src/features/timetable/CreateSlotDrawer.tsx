/**
 * CreateSlotDrawer — Freeze §Screen: Timetable, Admin create slot.
 *
 * POST /timetable — v3.3: NO startTime/endTime in body (derived via JOIN)
 * On 201: invalidate ['timetable'] + ['school-periods'], close drawer, toast
 * On 400 PERIOD_NOT_CONFIGURED: inline error "Period {n} is not configured..."
 * On 409: inline error "This slot is already occupied..."
 * On 403 FEATURE_DISABLED: toast error
 *
 * WHY also invalidate ['school-periods'] on POST timetable:
 * Freeze §3 caching table: "POST /timetable invalidates ['timetable'] AND
 * ['school-periods']" — creating a slot confirms periods are configured,
 * so we refresh period data too.
 *
 * WHY a Drawer (slide-in) not a Dialog:
 * Freeze §5: "Sheet (Drawer): Create/edit forms slide-in panel".
 * Drawers preserve context — user can still see the timetable grid behind it.
 */
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { timetableApi } from "@/api/timetable";
import { usersApi } from "@/api/users";
import { classesApi } from "@/api/classes";
import { subjectsApi } from "@/api/subjects";
import { parseApiError } from "@/utils/errors";
import { cn } from "@/utils/cn";
import { toast } from "sonner";
import { QUERY_KEYS } from "@/utils/queryKeys";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

// ── Zod schema — Freeze §Screen: Timetable validation rules ──────────────────
const schema = z.object({
  classId: z.string().min(1, "Class is required"),
  subjectId: z.string().min(1, "Subject is required"),
  teacherId: z.string().min(1, "Teacher is required"),
  dayOfWeek: z.enum(DAYS, { errorMap: () => ({ message: "Day is required" }) }),
  periodNumber: z.coerce.number().int().min(1, "Period must be ≥ 1"),
});

type FormValues = z.infer<typeof schema>;

interface CreateSlotDrawerProps {
  open: boolean;
  onClose: () => void;
  /**
   * When set, the drawer was opened by clicking an empty cell.
   * dayOfWeek and periodNumber are pre-filled and shown read-only.
   * Freeze §Screen: Timetable — CR-11: "dayOfWeek + periodNumber pre-filled read-only".
   */
  activeCell?: {
    dayOfWeek: (typeof DAYS)[number];
    periodNumber: number;
  } | null;
  /**
   * Active filter values from TimetablePage used as editable defaults.
   * activeCell.dayOfWeek always wins over filterDefaults.dayOfWeek.
   */
  filterDefaults?: {
    dayOfWeek?: (typeof DAYS)[number];
    classId?: string;
    teacherId?: string;
  };
}

export function CreateSlotDrawer({
  open,
  onClose,
  activeCell,
  filterDefaults,
}: CreateSlotDrawerProps) {
  const queryClient = useQueryClient();
  // Reset form and pre-fill activeCell values whenever the drawer opens.
  // WHY split into two effects: the focus timer fires after state settles;
  // the reset must happen synchronously on `open` change to avoid a blank
  // frame where dayOfWeek/periodNumber are empty.
  useEffect(() => {
    if (open) {
      reset({
        // Pre-fill from active filters; activeCell overrides dayOfWeek
        classId: filterDefaults?.classId ?? "",
        subjectId: "",
        teacherId: filterDefaults?.teacherId ?? "",
        ...(activeCell
          ? {
              dayOfWeek: activeCell.dayOfWeek,
              periodNumber: activeCell.periodNumber,
            }
          : filterDefaults?.dayOfWeek
            ? { dayOfWeek: filterDefaults.dayOfWeek }
            : {}),
      });
      setTimeout(() => {
        (
          document.getElementById("classId") as HTMLSelectElement | null
        )?.focus();
      }, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeCell, filterDefaults]);

  // ── Data for dropdowns ────────────────────────────────────────────────────
  const { data: classesData } = useQuery({
    queryKey: QUERY_KEYS.classes(),
    queryFn: () => classesApi.list(),
    staleTime: 2 * 60 * 1000,
    enabled: open,
  });
  const { data: subjectsData } = useQuery({
    queryKey: QUERY_KEYS.subjects(),
    queryFn: () => subjectsApi.list(),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });
  // Teachers only — Freeze: "teacherId: required (must be a user with Teacher role)"
  const { data: teachersData } = useQuery({
    queryKey: QUERY_KEYS.custom("users", "Teacher", ""),
    queryFn: () => usersApi.list({ role: "Teacher" }),
    staleTime: 2 * 60 * 1000,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {},
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => timetableApi.create(values),
    onSuccess: async () => {
      // Freeze §3: POST /timetable invalidates both timetable AND school-periods
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.timetable() });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schoolPeriods() });
      toast.success("Slot created successfully.");
      reset();
      onClose();
    },
    onError: (err) => {
      const { code, message } = parseApiError(err);
      if (code === "PERIOD_NOT_CONFIGURED") {
        setError("periodNumber", {
          message: `Period is not configured. Set it up in School Periods first.`,
        });
      } else if (code === "CONFLICT" || code === "SLOT_CONFLICT") {
        setError("root", {
          message:
            "This slot is already occupied for this class, day, and period.",
        });
      } else {
        setError("root", { message });
        toast.error("Something went wrong. Please try again.");
      }
    },
  });

  function handleClose() {
    reset();
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") handleClose();
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-slot-title"
        onKeyDown={onKeyDown}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-background shadow-xl transition-transform duration-300 md:w-[420px] border-l",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b shrink-0">
          <h2 id="create-slot-title" className="text-base font-semibold">
            Create Timetable Slot
          </h2>
          <button
            onClick={handleClose}
            aria-label="Close drawer"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-1 flex-col overflow-y-auto"
          noValidate
        >
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Root error */}
            {errors.root && (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive"
              >
                {errors.root.message}
              </div>
            )}

            {/* Class */}
            <div>
              <label
                htmlFor="classId"
                className="block text-sm font-medium mb-1.5"
              >
                Class
              </label>
              {filterDefaults?.classId ? (
                <>
                  <input
                    id="classId"
                    type="text"
                    readOnly
                    aria-readonly="true"
                    aria-describedby="classId-hint"
                    className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                    value={
                      classesData?.classes.find(
                        (c) => c.id === filterDefaults.classId,
                      )?.name ?? "Loading…"
                    }
                  />
                  {/* Hidden input carries the UUID value for react-hook-form */}
                  <input type="hidden" {...register("classId")} />
                  <p
                    id="classId-hint"
                    className="mt-1 text-xs text-muted-foreground"
                  >
                    Pre-filled from active filter · cannot be changed
                  </p>
                </>
              ) : (
                <>
                  <select
                    id="classId"
                    aria-describedby={
                      errors.classId ? "classId-error" : undefined
                    }
                    aria-invalid={errors.classId ? true : undefined}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                    {...register("classId")}
                  >
                    <option value="">Select class…</option>
                    {classesData?.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {errors.classId && (
                    <p
                      id="classId-error"
                      role="alert"
                      className="mt-1 text-xs text-destructive"
                    >
                      {errors.classId.message}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Subject */}
            <div>
              <label
                htmlFor="subjectId"
                className="block text-sm font-medium mb-1.5"
              >
                Subject
              </label>
              <select
                id="subjectId"
                aria-describedby={
                  errors.subjectId ? "subjectId-error" : undefined
                }
                aria-invalid={errors.subjectId ? true : undefined}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                {...register("subjectId")}
              >
                <option value="">Select subject…</option>
                {subjectsData?.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.code ? ` (${s.code})` : ""}
                  </option>
                ))}
              </select>
              {errors.subjectId && (
                <p
                  id="subjectId-error"
                  role="alert"
                  className="mt-1 text-xs text-destructive"
                >
                  {errors.subjectId.message}
                </p>
              )}
            </div>

            {/* Teacher */}
            <div>
              <label
                htmlFor="teacherId"
                className="block text-sm font-medium mb-1.5"
              >
                Teacher
              </label>
              {filterDefaults?.teacherId ? (
                <>
                  <input
                    id="teacherId"
                    type="text"
                    readOnly
                    aria-readonly="true"
                    aria-describedby="teacherId-hint"
                    className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                    value={
                      teachersData?.users.find(
                        (u) => u.id === filterDefaults.teacherId,
                      )?.name ?? "Loading…"
                    }
                  />
                  {/* Hidden input carries the UUID value for react-hook-form */}
                  <input type="hidden" {...register("teacherId")} />
                  <p
                    id="teacherId-hint"
                    className="mt-1 text-xs text-muted-foreground"
                  >
                    Pre-filled from active filter · cannot be changed
                  </p>
                </>
              ) : (
                <>
                  <select
                    id="teacherId"
                    aria-describedby={
                      errors.teacherId ? "teacherId-error" : undefined
                    }
                    aria-invalid={errors.teacherId ? true : undefined}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                    {...register("teacherId")}
                  >
                    <option value="">Select teacher…</option>
                    {teachersData?.users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  {errors.teacherId && (
                    <p
                      id="teacherId-error"
                      role="alert"
                      className="mt-1 text-xs text-destructive"
                    >
                      {errors.teacherId.message}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Day of week */}
            <div>
              <label
                htmlFor="dayOfWeek"
                className="block text-sm font-medium mb-1.5"
              >
                Day of Week
              </label>
              {activeCell ? (
                <>
                  <input
                    id="dayOfWeek"
                    type="text"
                    readOnly
                    aria-readonly="true"
                    aria-describedby="dayOfWeek-hint"
                    className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                    {...register("dayOfWeek")}
                  />
                  <p
                    id="dayOfWeek-hint"
                    className="mt-1 text-xs text-muted-foreground"
                  >
                    Pre-filled from selected cell · cannot be changed
                  </p>
                </>
              ) : filterDefaults?.dayOfWeek ? (
                <>
                  <input
                    id="dayOfWeek"
                    type="text"
                    readOnly
                    aria-readonly="true"
                    aria-describedby="dayOfWeek-hint"
                    className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                    {...register("dayOfWeek")}
                  />
                  <p
                    id="dayOfWeek-hint"
                    className="mt-1 text-xs text-muted-foreground"
                  >
                    Pre-filled from active filter · cannot be changed
                  </p>
                </>
              ) : (
                <>
                  <select
                    id="dayOfWeek"
                    aria-describedby={
                      errors.dayOfWeek ? "dayOfWeek-error" : undefined
                    }
                    aria-invalid={errors.dayOfWeek ? true : undefined}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                    {...register("dayOfWeek")}
                  >
                    <option value="">Select day…</option>
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  {errors.dayOfWeek && (
                    <p
                      id="dayOfWeek-error"
                      role="alert"
                      className="mt-1 text-xs text-destructive"
                    >
                      {errors.dayOfWeek.message}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Period number */}
            <div>
              <label
                htmlFor="periodNumber"
                className="block text-sm font-medium mb-1.5"
              >
                Period Number
              </label>
              {activeCell ? (
                <>
                  <input
                    id="periodNumber"
                    type="text"
                    readOnly
                    aria-readonly="true"
                    aria-describedby="periodNumber-hint"
                    className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                    {...register("periodNumber")}
                  />
                  <p
                    id="periodNumber-hint"
                    className="mt-1 text-xs text-muted-foreground"
                  >
                    Pre-filled from selected cell · cannot be changed
                  </p>
                </>
              ) : (
                <>
                  <input
                    id="periodNumber"
                    type="number"
                    min={1}
                    aria-describedby={
                      errors.periodNumber
                        ? "periodNumber-error"
                        : "periodNumber-hint"
                    }
                    aria-invalid={errors.periodNumber ? true : undefined}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                    {...register("periodNumber")}
                  />
                  {errors.periodNumber ? (
                    <p
                      id="periodNumber-error"
                      role="alert"
                      className="mt-1 text-xs text-destructive"
                    >
                      {errors.periodNumber.message}
                    </p>
                  ) : (
                    <p
                      id="periodNumber-hint"
                      className="mt-1 text-xs text-muted-foreground"
                    >
                      Must match a configured school period
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 p-4 border-t shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting || mutation.isPending}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {mutation.isPending ? (
                <>
                  <svg
                    className="h-3.5 w-3.5 animate-spin"
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
                  Creating…
                </>
              ) : (
                "Create Slot"
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
