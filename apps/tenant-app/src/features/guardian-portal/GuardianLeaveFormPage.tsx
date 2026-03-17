import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useGuardianSelectedChild } from "../../hooks/useGuardianSelectedChild";
import { leaveApi } from "../../api/leave.api";
import { useAppToast } from "../../hooks/useAppToast";
import { parseApiError } from "../../utils/errors";
import { QUERY_KEYS } from "../../utils/queryKeys";

const leaveSchema = z
  .object({
    leaveType: z.enum(["SICK", "CASUAL", "EMERGENCY", "OTHER"] as const, {
      required_error: "Leave type is required",
    }),
    durationType: z.enum(["FULL_DAY", "HALF_DAY"] as const, {
      required_error: "Duration type is required",
    }),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    reason: z
      .string()
      .min(5, "Please provide a reason (at least 5 characters)"),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

type LeaveFormValues = z.infer<typeof leaveSchema>;

export default function GuardianLeaveFormPage() {
  const navigate = useNavigate();
  const toast = useAppToast();
  const qc = useQueryClient();

  const { selectedChild, children, selectedChildId, setSelectedChild } =
    useGuardianSelectedChild();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      leaveType: "SICK",
      durationType: "FULL_DAY",
      startDate: "",
      endDate: "",
      reason: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: (values: LeaveFormValues) =>
      leaveApi.submit({
        studentId: selectedChild!.studentId,
        leaveType: values.leaveType,
        durationType: values.durationType,
        startDate: values.startDate,
        endDate: values.endDate,
        reason: values.reason,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: QUERY_KEYS.guardianPortal.leave(
          selectedChild?.studentId ?? "",
        ),
      });
      toast.success("Leave request submitted successfully.");
      navigate("/guardian/leave");
    },
    onError: (err) => {
      toast.mutationError(parseApiError(err).message);
    },
  });

  const onSubmit = (values: LeaveFormValues) => {
    submitMutation.mutate(values);
  };

  // Child switcher rendered in all states
  const childSwitcher =
    children.length > 1 ? (
      <div className="mb-4">
        <label className="text-sm font-medium text-gray-700">Viewing: </label>
        <select
          value={selectedChildId ?? ""}
          onChange={(e) => setSelectedChild(e.target.value)}
          className="ml-2 rounded border border-gray-300 px-2 py-1 text-sm"
        >
          {children.map((c) => (
            <option key={c.studentId} value={c.studentId}>
              {c.studentName}
            </option>
          ))}
        </select>
      </div>
    ) : null;

  if (!selectedChild) {
    return (
      <div className="p-4 md:p-6 max-w-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Request Leave</h1>
        </div>
        {childSwitcher}
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading children...</p>
        </div>
      </div>
    );
  }

  // canSubmitLeave === false: show structured message only
  if (!selectedChild.canSubmitLeave) {
    return (
      <div className="p-4 md:p-6 max-w-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Request Leave</h1>
        </div>
        {childSwitcher}
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center"
          role="status"
        >
          <p className="text-sm font-medium text-amber-900">
            Online leave submission is not enabled for this student.
          </p>
          <p className="mt-2 text-sm text-amber-800">
            Your school has not enabled online leave submission. Please contact
            the school administration directly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Request Leave</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          For {selectedChild.studentName} · {selectedChild.className}
        </p>
      </div>

      {childSwitcher}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="space-y-5 rounded-lg border bg-card p-5"
      >
        {/* Leave type */}
        <div>
          <label
            htmlFor="leaveType"
            className="block text-sm font-medium mb-1.5"
          >
            Leave Type{" "}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </label>
          <select
            id="leaveType"
            {...register("leaveType")}
            aria-describedby={errors.leaveType ? "leaveType-error" : undefined}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="SICK">Sick</option>
            <option value="CASUAL">Casual</option>
            <option value="EMERGENCY">Emergency</option>
            <option value="OTHER">Other</option>
          </select>
          {errors.leaveType && (
            <p
              id="leaveType-error"
              role="alert"
              className="mt-1 text-xs text-destructive"
            >
              {errors.leaveType.message}
            </p>
          )}
        </div>

        {/* Duration type */}
        <div>
          <label
            htmlFor="durationType"
            className="block text-sm font-medium mb-1.5"
          >
            Duration{" "}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </label>
          <select
            id="durationType"
            {...register("durationType")}
            aria-describedby={
              errors.durationType ? "durationType-error" : undefined
            }
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="FULL_DAY">Full Day</option>
            <option value="HALF_DAY">Half Day</option>
          </select>
          {errors.durationType && (
            <p
              id="durationType-error"
              role="alert"
              className="mt-1 text-xs text-destructive"
            >
              {errors.durationType.message}
            </p>
          )}
        </div>

        {/* Start date */}
        <div>
          <label
            htmlFor="startDate"
            className="block text-sm font-medium mb-1.5"
          >
            Start Date{" "}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </label>
          <input
            id="startDate"
            type="date"
            {...register("startDate")}
            aria-describedby={errors.startDate ? "startDate-error" : undefined}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {errors.startDate && (
            <p
              id="startDate-error"
              role="alert"
              className="mt-1 text-xs text-destructive"
            >
              {errors.startDate.message}
            </p>
          )}
        </div>

        {/* End date */}
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium mb-1.5">
            End Date{" "}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </label>
          <input
            id="endDate"
            type="date"
            {...register("endDate")}
            aria-describedby={errors.endDate ? "endDate-error" : undefined}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {errors.endDate && (
            <p
              id="endDate-error"
              role="alert"
              className="mt-1 text-xs text-destructive"
            >
              {errors.endDate.message}
            </p>
          )}
        </div>

        {/* Reason */}
        <div>
          <label htmlFor="reason" className="block text-sm font-medium mb-1.5">
            Reason{" "}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </label>
          <textarea
            id="reason"
            rows={3}
            placeholder="Briefly describe the reason for leave…"
            {...register("reason")}
            aria-describedby={errors.reason ? "reason-error" : undefined}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {errors.reason && (
            <p
              id="reason-error"
              role="alert"
              className="mt-1 text-xs text-destructive"
            >
              {errors.reason.message}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate("/guardian/leave")}
            disabled={isSubmitting || submitMutation.isPending}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || submitMutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {submitMutation.isPending ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      </form>
    </div>
  );
}
