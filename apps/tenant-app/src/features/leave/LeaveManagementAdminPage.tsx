/**
 * LeaveManagementAdminPage — Admin leave management table.
 * GET /leave with filters (classId, status).
 * Approve/Reject actions for PENDING leaves.
 * Shows on-campus active leave count.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leaveApi } from "@/api/leave.api";
import { classesApi } from "@/api/classes";
import { parseApiError } from "@/utils/errors";
import { useAppToast } from "@/hooks/useAppToast";
import { LeaveStatusBadge } from "@/components/LeaveStatusBadge";
import type { LeaveRequest, LeaveStatus } from "@/types/api";
import { QUERY_KEYS } from "@/utils/queryKeys";

const LEAVE_STATUSES: LeaveStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "ACTIVE",
  "COMPLETED",
  "OVERDUE",
];

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

function RejectDialog({
  open,
  onConfirm,
  onCancel,
  isPending,
}: {
  open: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Reject leave"
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold mb-3">Reject Leave Request</h2>
        <label
          htmlFor="reject-reason"
          className="block text-sm font-medium mb-1.5"
        >
          Reason{" "}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        </label>
        <textarea
          id="reject-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter rejection reason…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm border border-input hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!reason.trim() || isPending}
            onClick={() => onConfirm(reason.trim())}
            className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {isPending ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LeaveManagementAdminPage() {
  const qc = useQueryClient();
  const toast = useAppToast();

  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | "">("");
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);

  const { data: classesData } = useQuery({
    queryKey: QUERY_KEYS.classes(),
    queryFn: () => classesApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const leavesQuery = useQuery({
    queryKey: QUERY_KEYS.custom("leave", {
      classId: classFilter || undefined,
      status: statusFilter || undefined,
    }),
    queryFn: () =>
      leaveApi.list({
        classId: classFilter || undefined,
        status: statusFilter || undefined,
      }),
    staleTime: 1 * 60 * 1000,
  });

  const onCampusQuery = useQuery({
    queryKey: QUERY_KEYS.leave.onCampus(),
    queryFn: () => leaveApi.onCampus(),
    staleTime: 1 * 60 * 1000,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => leaveApi.approve(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.leave.all() });
      toast.success("Leave request approved.");
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      leaveApi.reject(id, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.leave.all() });
      setRejectTarget(null);
      toast.success("Leave request rejected.");
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  const classes = classesData?.classes ?? [];
  const leaves = leavesQuery.data?.leaves ?? [];
  const onCampusCount = onCampusQuery.data?.leaves?.length ?? 0;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Leave Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review and manage student leave requests.
          </p>
        </div>
        {/* On-campus chip */}
        <div
          className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-800"
          aria-label={`${onCampusCount} students currently on active leave`}
        >
          <span
            className={`h-2 w-2 rounded-full ${onCampusCount > 0 ? "bg-blue-500" : "bg-blue-300"}`}
            aria-hidden="true"
          />
          {onCampusCount} On Campus Leave
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          aria-label="Filter by class"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LeaveStatus | "")}
          aria-label="Filter by status"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Statuses</option>
          {LEAVE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {leavesQuery.isError && (
        <div
          role="alert"
          className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
        >
          {parseApiError(leavesQuery.error).message}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <caption className="sr-only">Leave requests</caption>
          <thead className="bg-muted/50 border-b">
            <tr>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Student
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Class
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Dates
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Type
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-right font-medium text-muted-foreground"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {leavesQuery.isLoading && (
              <tr>
                <td colSpan={6} className="p-0">
                  <div className="space-y-0">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="flex gap-4 px-4 py-3 border-b animate-pulse"
                      >
                        <Skeleton className="h-4 w-32 flex-1" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            )}
            {!leavesQuery.isLoading && leaves.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No leave requests found.
                </td>
              </tr>
            )}
            {leaves.map((leave: LeaveRequest) => (
              <tr
                key={leave.id}
                className="border-b last:border-b-0 hover:bg-muted/20"
              >
                <td className="px-4 py-2.5 font-medium">{leave.studentName}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {leave.className}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                  {leave.startDate}
                  {leave.startDate !== leave.endDate && ` → ${leave.endDate}`}
                  <span className="ml-1 text-xs">({leave.totalDays}d)</span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {leave.leaveType}
                </td>
                <td className="px-4 py-2.5">
                  <LeaveStatusBadge status={leave.status} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  {leave.status === "PENDING" && (
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={approveMut.isPending}
                        onClick={() => approveMut.mutate(leave.id)}
                        className="rounded px-2.5 py-1 text-xs font-medium bg-green-100 text-green-800 hover:bg-green-200 transition-colors disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectTarget(leave)}
                        className="rounded px-2.5 py-1 text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reject dialog */}
      <RejectDialog
        open={rejectTarget !== null}
        onCancel={() => setRejectTarget(null)}
        isPending={rejectMut.isPending}
        onConfirm={(reason) => {
          if (rejectTarget) rejectMut.mutate({ id: rejectTarget.id, reason });
        }}
      />
    </div>
  );
}
