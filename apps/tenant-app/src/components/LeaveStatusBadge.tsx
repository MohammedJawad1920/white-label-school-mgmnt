import React from "react";
import type { LeaveStatus } from "../types/api";

interface LeaveStatusBadgeProps {
  status: LeaveStatus;
}

const STATUS_STYLES: Record<LeaveStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-800",
  ACTIVE: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-gray-100 text-gray-600",
  OVERDUE: "bg-orange-100 text-orange-800",
};

export function LeaveStatusBadge({ status }: LeaveStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
