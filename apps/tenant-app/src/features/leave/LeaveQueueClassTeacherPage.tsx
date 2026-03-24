/**
 * LeaveQueueClassTeacherPage — Class Teacher only
 *
 * Shows leave requests for the teacher's assigned class.
 * Supported actions: approve, reject, depart (→ ACTIVE), return (→ COMPLETED).
 *
 * Guard: If user is not class teacher (classTeacherOf === null), redirect to
 *   /teacher/dashboard.
 */
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leaveApi } from "@/api/leave.api";
import { LeaveStatusBadge } from "@/components/LeaveStatusBadge";
import { useIsClassTeacher } from "@/hooks/useIsClassTeacher";
import { useAuth } from "@/hooks/useAuth";
import { useAppToast } from "@/hooks/useAppToast";
import { parseApiError } from "@/utils/errors";
import type { LeaveRequest } from "@/types/api";
import { QUERY_KEYS } from "@/utils/queryKeys";

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "ACTIVE", label: "Active (on leave)" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
] as const;

// ── Reject dialog ──────────────────────────────────────────────────────────
interface RejectDialogProps {
  open: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isPending: boolean;
}

function RejectDialog({
  open,
  onConfirm,
  onCancel,
  isPending,
}: RejectDialogProps) {
  const [reason, setReason] = useState("");
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-background rounded-lg shadow-lg w-full max-w-sm p-5 space-y-4">
        <h2 id="reject-dialog-title" className="text-base font-semibold">
          Reject Leave Request
        </h2>
        <div>
          <label
            htmlFor="reject-reason"
            className="block text-sm font-medium mb-1"
          >
            Rejection reason <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Provide a reason..."
            required
            aria-required="true"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={isPending || !reason.trim()}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Leave row ──────────────────────────────────────────────────────────────
interface LeaveRowProps {
  leave: LeaveRequest;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDepart: (id: string) => void;
  onReturn: (id: string) => void;
  isPending: boolean;
}

function LeaveRow({
  leave,
  onApprove,
  onReject,
  onDepart,
  onReturn,
  isPending,
}: LeaveRowProps) {
  return (
    <article className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-medium text-sm">{leave.studentName}</p>
          <p className="text-xs text-muted-foreground">{leave.className}</p>
        </div>
        <LeaveStatusBadge status={leave.status} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
        <div>
          <span className="block font-medium text-foreground">Type</span>
          {leave.leaveType}
        </div>
        <div>
          <span className="block font-medium text-foreground">Duration</span>
          {leave.durationType}
        </div>
        <div>
          <span className="block font-medium text-foreground">Dates</span>
          {leave.startDate} – {leave.endDate}
        </div>
        <div>
          <span className="block font-medium text-foreground">Days</span>
          {leave.totalDays}
        </div>
      </div>

      {leave.reason && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Reason: </span>
          {leave.reason}
        </p>
      )}

      {leave.rejectionReason && (
        <p className="text-xs text-destructive">
          <span className="font-medium">Rejected: </span>
          {leave.rejectionReason}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        {leave.status === "PENDING" && (
          <>
            <button
              onClick={() => onApprove(leave.id)}
              disabled={isPending}
              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Approve
            </button>
            <button
              onClick={() => onReject(leave.id)}
              disabled={isPending}
              className="rounded-md border border-destructive px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Reject
            </button>
          </>
        )}
        {leave.status === "APPROVED" && (
          <button
            onClick={() => onDepart(leave.id)}
            disabled={isPending}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Mark Departed
          </button>
        )}
        {leave.status === "ACTIVE" && (
          <button
            onClick={() => onReturn(leave.id)}
            disabled={isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Mark Returned
          </button>
        )}
      </div>
    </article>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function LeaveQueueClassTeacherPage() {
  const isClassTeacher = useIsClassTeacher();
  const { user } = useAuth();
  const toast = useAppToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  // Guard: non-class-teachers redirected away
  if (!isClassTeacher) {
    return <Navigate to="/teacher/dashboard" replace />;
  }

  const classId = user?.classTeacherOf ?? undefined;

  const leavesQ = useQuery({
    queryKey: QUERY_KEYS.leave.list({
      classId,
      status: statusFilter || undefined,
    }),
    queryFn: () =>
      leaveApi.list({ classId, status: statusFilter || undefined }),
    staleTime: 2 * 60 * 1000,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leave.all() });

  const approveMut = useMutation({
    mutationFn: (id: string) => leaveApi.approve(id),
    onSuccess: () => {
      toast.success("Leave request approved.");
      void invalidate();
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      leaveApi.reject(id, reason),
    onSuccess: () => {
      toast.success("Leave request rejected.");
      setRejectTarget(null);
      void invalidate();
    },
    onError: (err) => {
      toast.mutationError(parseApiError(err).message);
      setRejectTarget(null);
    },
  });

  const departMut = useMutation({
    mutationFn: (id: string) => leaveApi.depart(id),
    onSuccess: () => {
      toast.success("Student marked as departed.");
      void invalidate();
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  const returnMut = useMutation({
    mutationFn: (id: string) => leaveApi.return(id),
    onSuccess: () => {
      toast.success("Student marked as returned.");
      void invalidate();
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  const isMutating =
    approveMut.isPending ||
    rejectMut.isPending ||
    departMut.isPending ||
    returnMut.isPending;

  const leaves = leavesQ.data?.leaves ?? [];
  const apiError = leavesQ.isError ? parseApiError(leavesQ.error) : null;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Leave Queue</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Leave requests for your class
        </p>
      </div>

      {/* Status filter */}
      <div className="mb-5">
        <label htmlFor="leaveStatusFilter" className="sr-only">
          Filter by status
        </label>
        <select
          id="leaveStatusFilter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Filter leave requests by status"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {leavesQ.isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border bg-card p-4 space-y-2"
            >
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {leavesQ.isError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {apiError?.message ?? "Failed to load leave requests."}
        </div>
      )}

      {/* Empty */}
      {!leavesQ.isLoading && !leavesQ.isError && leaves.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border bg-muted/10">
          <p className="text-sm text-muted-foreground">
            No leave requests
            {statusFilter ? ` with status "${statusFilter}"` : ""}.
          </p>
        </div>
      )}

      {/* Leave cards */}
      {!leavesQ.isLoading && leaves.length > 0 && (
        <ul className="space-y-3">
          {leaves.map((leave) => (
            <li key={leave.id}>
              <LeaveRow
                leave={leave}
                onApprove={(id) => approveMut.mutate(id)}
                onReject={(id) => setRejectTarget(id)}
                onDepart={(id) => departMut.mutate(id)}
                onReturn={(id) => returnMut.mutate(id)}
                isPending={isMutating}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Reject dialog */}
      <RejectDialog
        open={rejectTarget !== null}
        onConfirm={(reason) => {
          if (rejectTarget) rejectMut.mutate({ id: rejectTarget, reason });
        }}
        onCancel={() => setRejectTarget(null)}
        isPending={rejectMut.isPending}
      />
    </div>
  );
}
