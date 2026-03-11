/**
 * SchoolPeriodsPage — Freeze §Screen: School Periods
 * TQ key: ['school-periods']  stale: 5 min
 *
 * KEY RULES from Freeze:
 *  - periodNumber is IMMUTABLE after creation — read-only in edit form
 *    (aria-disabled="true" + title tooltip per §6 Accessibility)
 *  - endTime must be strictly after startTime (client-side + server 400)
 *  - Any mutation invalidates BOTH ['school-periods'] AND ['timetable']
 *    (timetable grid derives times from periods)
 *  - DELETE 409 HAS_REFERENCES → inline error on the row
 *  - FEATURE_DISABLED → full-page state
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { schoolPeriodsApi } from "@/api/schoolPeriods";
import { parseApiError } from "@/utils/errors";
import {
  TableSkeleton,
  Drawer,
  FormField,
  SubmitFooter,
  PageHeader,
  ActionBtn,
  RootError,
  inputCls,
} from "@/components/manage/shared";
import type { SchoolPeriod } from "@/types/api";

const timePattern = /^\d{2}:\d{2}$/;

const schema = z
  .object({
    periodNumber: z.coerce.number().int().min(1, "Must be ≥ 1"),
    label: z.string().max(100).optional().or(z.literal("")),
    startTime: z.string().regex(timePattern, "Format: HH:MM"),
    endTime: z.string().regex(timePattern, "Format: HH:MM"),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "Start time must be before end time.",
    path: ["endTime"],
  });
type FormValues = z.infer<typeof schema>;

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
          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636"
        />
      </svg>
      <p className="text-base font-medium">
        Timetable feature not enabled for your school.
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        Enable the Timetable feature to configure school periods.
      </p>
    </div>
  );
}

// ── Period form ───────────────────────────────────────────────────────────────
function PeriodForm({
  defaultValues,
  isEdit,
  onSubmit,
  onCancel,
  isPending,
  rootError,
}: {
  defaultValues?: Partial<FormValues>;
  isEdit: boolean;
  onSubmit: (v: FormValues) => void;
  onCancel: () => void;
  isPending: boolean;
  rootError?: string | null;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="contents">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {rootError && <RootError message={rootError} />}

        {/* Period number — immutable in edit (Freeze §Screen) */}
        <FormField
          id="period-num"
          label="Period Number"
          error={errors.periodNumber?.message}
          required
          hint={isEdit ? undefined : "Cannot be changed after creation"}
        >
          <div className="relative">
            <input
              id="period-num"
              type="number"
              min={1}
              aria-invalid={!!errors.periodNumber}
              aria-disabled={isEdit ? "true" : undefined}
              readOnly={isEdit}
              title={
                isEdit
                  ? "Period number cannot be changed after creation."
                  : undefined
              }
              className={`${inputCls(!!errors.periodNumber)} ${isEdit ? "bg-muted cursor-not-allowed select-none" : ""}`}
              {...register("periodNumber")}
            />
            {isEdit && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                locked
              </div>
            )}
          </div>
          {isEdit && (
            <p className="mt-1 text-xs text-muted-foreground italic">
              Period number cannot be changed after creation.
            </p>
          )}
        </FormField>

        {/* Label */}
        <FormField
          id="period-label"
          label="Label"
          hint="Optional display name. e.g. Morning Break"
        >
          <input
            id="period-label"
            type="text"
            placeholder="e.g. Period 1"
            className={inputCls(false)}
            {...register("label")}
          />
        </FormField>

        {/* Start / end time */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            id="period-start"
            label="Start Time"
            error={errors.startTime?.message}
            required
          >
            <input
              id="period-start"
              type="time"
              aria-label="Start time"
              aria-invalid={!!errors.startTime}
              className={inputCls(!!errors.startTime)}
              {...register("startTime")}
            />
          </FormField>
          <FormField
            id="period-end"
            label="End Time"
            error={errors.endTime?.message}
            required
          >
            <input
              id="period-end"
              type="time"
              aria-label="End time"
              aria-invalid={!!errors.endTime}
              className={inputCls(!!errors.endTime)}
              {...register("endTime")}
            />
          </FormField>
        </div>
      </div>
      <div className="border-t p-4 shrink-0">
        <SubmitFooter
          onCancel={onCancel}
          isLoading={isPending}
          submitLabel={isEdit ? "Update Period" : "Add Period"}
        />
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SchoolPeriodsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPeriod, setEditPeriod] = useState<SchoolPeriod | null>(null);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["school-periods"],
    queryFn: () => schoolPeriodsApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const apiErr = isError ? parseApiError(error) : null;
  if (apiErr?.code === "FEATURE_DISABLED")
    return (
      <div className="p-6">
        <FeatureDisabledState />
      </div>
    );

  const periods = [...(data?.periods ?? [])].sort(
    (a, b) => a.periodNumber - b.periodNumber,
  );

  // WHY invalidate both ['school-periods'] AND ['timetable']:
  // Freeze §Screen: "On any mutation: invalidate ['school-periods'] AND ['timetable']
  // (timetable grid derives times from periods)."
  const invalidateBoth = async () => {
    await qc.invalidateQueries({ queryKey: ["school-periods"] });
    await qc.invalidateQueries({ queryKey: ["timetable"] });
  };

  const createMut = useMutation({
    mutationFn: (v: FormValues) => schoolPeriodsApi.create(v),
    onSuccess: async () => {
      await invalidateBoth();
      toast.success("School period created successfully.");
      setCreateOpen(false);
      setDrawerError(null);
    },
    onError: (e) => {
      const { code, message } = parseApiError(e);
      if (code === "CONFLICT" || code === "DUPLICATE") {
        setDrawerError(`Period number already exists.`);
      } else if (code === "PERIOD_TIME_INVALID") {
        setDrawerError("Start time must be before end time.");
      } else {
        setDrawerError(message);
        toast.error("Something went wrong. Please try again.");
      }
    },
  });

  const updateMut = useMutation({
    mutationFn: (v: FormValues) => schoolPeriodsApi.update(editPeriod!.id, v),
    onSuccess: async () => {
      await invalidateBoth();
      toast.success("School period updated successfully.");
      setEditPeriod(null);
      setDrawerError(null);
    },
    onError: (e) => {
      const { code, message } = parseApiError(e);
      if (code === "PERIOD_TIME_INVALID")
        setDrawerError("Start time must be before end time.");
      else if (code === "NOT_FOUND") setDrawerError("Period not found.");
      else {
        setDrawerError(message);
        toast.error("Something went wrong. Please try again.");
      }
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => schoolPeriodsApi.delete(id),
    onSuccess: async () => {
      await invalidateBoth();
      toast.success("School period deleted successfully.");
    },
    onError: (e, id) => {
      const { code } = parseApiError(e);
      if (code === "HAS_REFERENCES" || code === "CONFLICT") {
        setDeleteErrors((prev) => ({
          ...prev,
          [id]: "Cannot delete — active timetable slots use this period.",
        }));
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    },
  });

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <PageHeader
        title="School Periods"
        subtitle={`${periods.length} period${periods.length !== 1 ? "s" : ""} configured`}
        onAdd={() => {
          setDrawerError(null);
          setCreateOpen(true);
        }}
        addLabel="Add Period"
      />

      {/* Loading */}
      {isLoading && (
        <div className="rounded-lg border overflow-hidden">
          <TableSkeleton rows={8} cols={4} />
        </div>
      )}

      {/* Empty */}
      {!isLoading && periods.length === 0 && (
        <div className="rounded-lg border px-4 py-12 text-center text-sm text-muted-foreground">
          No periods configured. Add your first period.
        </div>
      )}

      {/* Period list */}
      {!isLoading && periods.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-16"
                >
                  #
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  Label
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  Time
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <>
                  <tr
                    key={period.id}
                    className="border-b last:border-b-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-2.5 font-semibold text-muted-foreground">
                      {period.periodNumber}
                    </td>
                    <td className="px-4 py-2.5 font-medium">
                      {period.label ?? `Period ${period.periodNumber}`}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {period.startTime} – {period.endTime}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <ActionBtn
                          onClick={() => {
                            setDrawerError(null);
                            setEditPeriod(period);
                          }}
                          label="Edit"
                          ariaLabel={`Edit Period ${period.periodNumber}`}
                        />
                        <ActionBtn
                          onClick={() => {
                            setDeleteErrors((prev) => {
                              const n = { ...prev };
                              delete n[period.id];
                              return n;
                            });
                            deleteMut.mutate(period.id);
                          }}
                          label="Delete"
                          ariaLabel={`Delete Period ${period.periodNumber}`}
                          variant="destructive"
                          disabled={deleteMut.isPending}
                        />
                      </div>
                    </td>
                  </tr>
                  {/* Inline delete error on the row — Freeze §Screen */}
                  {deleteErrors[period.id] && (
                    <tr key={`${period.id}-err`}>
                      <td colSpan={4} className="px-4 py-1.5 bg-destructive/5">
                        <p role="alert" className="text-xs text-destructive">
                          {deleteErrors[period.id]}
                        </p>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create drawer */}
      <Drawer
        open={createOpen}
        title="Add Period"
        onClose={() => setCreateOpen(false)}
        footer={null}
      >
        <PeriodForm
          isEdit={false}
          onSubmit={(v) => createMut.mutate(v)}
          onCancel={() => setCreateOpen(false)}
          isPending={createMut.isPending}
          rootError={drawerError}
        />
      </Drawer>

      {/* Edit drawer */}
      <Drawer
        open={!!editPeriod}
        title="Edit Period"
        onClose={() => setEditPeriod(null)}
        footer={null}
      >
        {editPeriod && (
          <PeriodForm
            isEdit
            defaultValues={{
              periodNumber: editPeriod.periodNumber,
              label: editPeriod.label ?? "",
              startTime: editPeriod.startTime,
              endTime: editPeriod.endTime,
            }}
            onSubmit={(v) => updateMut.mutate(v)}
            onCancel={() => setEditPeriod(null)}
            isPending={updateMut.isPending}
            rootError={drawerError}
          />
        )}
      </Drawer>
    </div>
  );
}
