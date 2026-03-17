import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useGuardianSelectedChild } from "../../hooks/useGuardianSelectedChild";
import { guardianPortalApi } from "../../api/guardian-portal.api";
import { CalendarGrid } from "../../components/CalendarGrid";
import { QUERY_KEYS } from "../../utils/queryKeys";
import { getErrorMessage } from "../../utils/errors";
import { formatMonth } from "../../utils/dates";

const CURRENT_MONTH = format(new Date(), "yyyy-MM");

export default function GuardianAttendancePage() {
  const { selectedChildId, selectedChild, children, setSelectedChild } =
    useGuardianSelectedChild();

  const [month, setMonth] = useState<string>(CURRENT_MONTH);

  const attendanceQuery = useQuery({
    queryKey: QUERY_KEYS.guardianPortal.attendance(
      selectedChildId ?? "",
      month,
    ),
    queryFn: () => guardianPortalApi.childAttendance(selectedChildId!, month),
    enabled: !!selectedChildId,
    staleTime: 5 * 60 * 1000,
  });

  const summary = attendanceQuery.data?.summary;
  const records = attendanceQuery.data?.records ?? [];

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Attendance</h1>
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
        <div className="space-y-5">
          {/* Month picker */}
          <div className="flex items-center gap-3">
            <label
              htmlFor="month-picker"
              className="text-sm font-medium text-gray-700"
            >
              Month
            </label>
            <input
              id="month-picker"
              type="month"
              value={month}
              max={CURRENT_MONTH}
              onChange={(e) => setMonth(e.target.value)}
              aria-label="Select month"
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="text-sm text-muted-foreground">
              {formatMonth(month)}
            </span>
          </div>

          {/* Loading */}
          {attendanceQuery.isLoading && (
            <div
              className="rounded-lg border bg-card p-6 animate-pulse"
              aria-busy="true"
              aria-label="Loading attendance"
            >
              <div className="grid grid-cols-7 gap-2 mb-3">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="h-3 bg-muted rounded" />
                ))}
              </div>
              {[...Array(4)].map((_, row) => (
                <div key={row} className="grid grid-cols-7 gap-2 mb-2">
                  {[...Array(7)].map((_, col) => (
                    <div key={col} className="h-8 bg-muted rounded" />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {attendanceQuery.isError && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {getErrorMessage(attendanceQuery.error)}
            </div>
          )}

          {/* Calendar */}
          {!attendanceQuery.isLoading && !attendanceQuery.isError && (
            <div className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold mb-4">
                {selectedChild.studentName} — {formatMonth(month)}
              </h2>
              <CalendarGrid month={month} days={records} />
            </div>
          )}

          {/* Summary stats */}
          {!attendanceQuery.isLoading &&
            !attendanceQuery.isError &&
            summary && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-sm">
                {[
                  {
                    label: "Present",
                    value: summary.present,
                    color: "text-green-700",
                  },
                  {
                    label: "Absent",
                    value: summary.absent,
                    color: "text-red-700",
                  },
                  {
                    label: "Late",
                    value: summary.late,
                    color: "text-amber-700",
                  },
                  {
                    label: "Excused",
                    value: summary.excused,
                    color: "text-blue-700",
                  },
                  {
                    label: "Total",
                    value: summary.total,
                    color: "text-gray-900",
                  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-md border bg-card p-3">
                    <div className={`text-xl font-bold ${color}`}>{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            )}

          {!attendanceQuery.isLoading &&
            !attendanceQuery.isError &&
            summary &&
            summary.total > 0 && (
              <p className="text-sm font-medium">
                Attendance rate:{" "}
                <span className="text-green-700">
                  {((summary.present / summary.total) * 100).toFixed(1)}%
                </span>
              </p>
            )}
        </div>
      )}
    </div>
  );
}
