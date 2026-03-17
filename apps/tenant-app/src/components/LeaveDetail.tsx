import React from "react";
import type { LeaveRequest } from "../types/api";
import { LeaveStatusBadge } from "./LeaveStatusBadge";

interface LeaveDetailProps {
  leave: LeaveRequest;
  actions?: React.ReactNode;
}

export function LeaveDetail({ leave, actions }: LeaveDetailProps) {
  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-lg font-semibold">{leave.studentName}</p>
          <p className="text-sm text-gray-500">{leave.className}</p>
        </div>
        <LeaveStatusBadge status={leave.status} />
      </div>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="font-medium text-gray-500">Type</dt>
          <dd>
            {leave.leaveType} · {leave.durationType.replace("_", " ")}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Duration</dt>
          <dd>
            {leave.startDate} — {leave.endDate} ({leave.totalDays} day
            {leave.totalDays !== 1 ? "s" : ""})
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="font-medium text-gray-500">Reason</dt>
          <dd className="mt-1">{leave.reason}</dd>
        </div>
        {leave.reviewedByName && (
          <div className="col-span-2">
            <dt className="font-medium text-gray-500">Reviewed by</dt>
            <dd>
              {leave.reviewedByName} on{" "}
              {leave.reviewedAt
                ? new Date(leave.reviewedAt).toLocaleDateString()
                : "—"}
            </dd>
          </div>
        )}
        {leave.rejectionReason && (
          <div className="col-span-2">
            <dt className="font-medium text-gray-500">Rejection Reason</dt>
            <dd className="text-red-600">{leave.rejectionReason}</dd>
          </div>
        )}
      </dl>
      {actions && <div className="mt-6 flex gap-3">{actions}</div>}
    </div>
  );
}
