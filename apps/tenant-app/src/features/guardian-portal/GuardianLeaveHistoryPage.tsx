import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useGuardianSelectedChild } from "../../hooks/useGuardianSelectedChild";
import { guardianPortalApi } from "../../api/guardian-portal.api";
import { leaveApi } from "../../api/leave.api";
import { LeaveStatusBadge } from "../../components/LeaveStatusBadge";
import { QUERY_KEYS } from "../../utils/queryKeys";
import { getErrorMessage, parseApiError } from "../../utils/errors";
import { formatDisplayDate } from "../../utils/dates";
import { useAppToast } from "../../hooks/useAppToast";
import type { LeaveRequest } from "../../types/api";

export default function GuardianLeaveHistoryPage() {
  const navigate = useNavigate();
  const toast = useAppToast();
  const qc = useQueryClient();

  const { selectedChildId, selectedChild, children, setSelectedChild } =
    useGuardianSelectedChild();

  const leavesQuery = useQuery({
    queryKey: QUERY_KEYS.guardianPortal.leave(selectedChildId ?? ""),
    queryFn: () => guardianPortalApi.childLeave(selectedChildId!),
    enabled: !!selectedChildId,
    staleTime: 2 * 60 * 1000,
  });

  const cancelMutation = useMutation({
    mutationFn: (leaveId: string) => leaveApi.cancel(leaveId),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: QUERY_KEYS.guardianPortal.leave(
          selectedChild?.studentId ?? "",
        ),
      });
      toast.success("Leave request cancelled.");
    },
    onError: (err) => {
      toast.mutationError(parseApiError(err).message);
    },
  });

  const leaves: LeaveRequest[] = leavesQuery.data?.leaves ?? [];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-semibold">Leave History</h1>
        {selectedChild?.canSubmitLeave && (
          <button
            type="button"
            onClick={() => navigate("/guardian/leave/new")}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Request Leave
          </button>
        )}
      </div>

      {/* Child switcher */}
      {children.length > 1 && (
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
      )}

      {!selectedChild ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading children...</p>
        </div>
      ) : (
        <>
          {/* Loading */}
          {leavesQuery.isLoading && (
            <div
              className="animate-pulse space-y-3"
              aria-busy="true"
              aria-label="Loading leave history"
            >
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border bg-card p-4 flex justify-between"
                >
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                  <div className="h-6 w-20 bg-muted rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {leavesQuery.isError && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {getErrorMessage(leavesQuery.error)}
            </div>
          )}

          {/* Empty */}
          {!leavesQuery.isLoading &&
            !leavesQuery.isError &&
            leaves.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-muted-foreground">
                  No leave requests found for {selectedChild.studentName}.
                </p>
                {selectedChild.canSubmitLeave && (
                  <button
                    type="button"
                    onClick={() => navigate("/guardian/leave/new")}
                    className="mt-4 rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Submit first leave request
                  </button>
                )}
              </div>
            )}

          {/* Leave list */}
          {!leavesQuery.isLoading &&
            !leavesQuery.isError &&
            leaves.length > 0 && (
              <ul className="space-y-3" aria-label="Leave requests">
                {leaves.map((leave) => (
                  <li key={leave.id} className="rounded-lg border bg-card p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {leave.leaveType}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({leave.durationType.replace("_", " ")})
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDisplayDate(leave.startDate)}
                          {leave.startDate !== leave.endDate
                            ? ` – ${formatDisplayDate(leave.endDate)}`
                            : ""}
                          {" · "}
                          {leave.totalDays} day
                          {leave.totalDays !== 1 ? "s" : ""}
                        </p>
                        {leave.reason && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs">
                            {leave.reason}
                          </p>
                        )}
                        {leave.reviewedByName && (
                          <p className="text-xs text-muted-foreground">
                            Reviewed by {leave.reviewedByName}
                          </p>
                        )}
                        {leave.rejectionReason && (
                          <p className="text-xs text-destructive">
                            Reason: {leave.rejectionReason}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <LeaveStatusBadge status={leave.status} />
                        {leave.status === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => cancelMutation.mutate(leave.id)}
                            disabled={cancelMutation.isPending}
                            aria-label={`Cancel leave request from ${formatDisplayDate(leave.startDate)}`}
                            className="rounded-md border px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                          >
                            {cancelMutation.isPending
                              ? "Cancelling…"
                              : "Cancel"}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </>
      )}
    </div>
  );
}
