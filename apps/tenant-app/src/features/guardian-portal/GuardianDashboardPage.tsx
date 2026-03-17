import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useGuardianSelectedChild } from "../../hooks/useGuardianSelectedChild";
import { guardianPortalApi } from "../../api/guardian-portal.api";
import { announcementsApi } from "../../api/announcements.api";
import { QUERY_KEYS } from "../../utils/queryKeys";
import { getErrorMessage } from "../../utils/errors";
import { formatMonth, formatDisplayDate } from "../../utils/dates";

const CURRENT_MONTH = format(new Date(), "yyyy-MM");

export default function GuardianDashboardPage() {
  const { selectedChildId, selectedChild, children, setSelectedChild } =
    useGuardianSelectedChild();

  const attendanceQuery = useQuery({
    queryKey: QUERY_KEYS.guardianPortal.attendance(
      selectedChildId ?? "",
      CURRENT_MONTH,
    ),
    queryFn: () =>
      guardianPortalApi.childAttendance(selectedChildId!, CURRENT_MONTH),
    enabled: !!selectedChildId,
    staleTime: 5 * 60 * 1000,
  });

  const resultsQuery = useQuery({
    queryKey: QUERY_KEYS.guardianPortal.results(selectedChildId ?? ""),
    queryFn: () => guardianPortalApi.childResults(selectedChildId!),
    enabled: !!selectedChildId,
    staleTime: 5 * 60 * 1000,
  });

  const announcementsQuery = useQuery({
    queryKey: QUERY_KEYS.announcements.list({ limit: 5 }),
    queryFn: () => announcementsApi.list({ limit: 5 }),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Guardian Dashboard</h1>
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
        <div className="space-y-6">
          {/* Child info card */}
          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-base font-semibold">
              {selectedChild.studentName}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {selectedChild.className}
              {selectedChild.batchName ? ` · ${selectedChild.batchName}` : ""}
              {" · "}
              <span className="capitalize">{selectedChild.relationship}</span>
            </p>
          </div>

          {/* Attendance summary */}
          <section
            className="rounded-lg border bg-card p-4"
            aria-label="Attendance summary"
          >
            <h2 className="text-sm font-semibold mb-3">
              Attendance — {formatMonth(CURRENT_MONTH)}
            </h2>

            {attendanceQuery.isLoading ? (
              <div className="animate-pulse space-y-2" aria-busy="true">
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-4 bg-muted rounded w-1/3" />
              </div>
            ) : attendanceQuery.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {getErrorMessage(attendanceQuery.error)}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
                  {[
                    {
                      label: "Present",
                      value: attendanceQuery.data?.summary.present ?? 0,
                      color: "text-green-700",
                    },
                    {
                      label: "Absent",
                      value: attendanceQuery.data?.summary.absent ?? 0,
                      color: "text-red-700",
                    },
                    {
                      label: "Late",
                      value: attendanceQuery.data?.summary.late ?? 0,
                      color: "text-amber-700",
                    },
                    {
                      label: "Total",
                      value: attendanceQuery.data?.summary.total ?? 0,
                      color: "text-gray-900",
                    },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-md bg-muted/40 p-3">
                      <div className={`text-xl font-bold ${color}`}>
                        {value}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
                {(() => {
                  const s = attendanceQuery.data?.summary;
                  if (!s || s.total === 0) return null;
                  const pct = ((s.present / s.total) * 100).toFixed(1);
                  return (
                    <p className="mt-3 text-sm font-medium">
                      Attendance rate:{" "}
                      <span className="text-green-700">{pct}%</span>
                    </p>
                  );
                })()}
              </>
            )}
          </section>

          {/* Recent announcements */}
          <section
            className="rounded-lg border bg-card p-4"
            aria-label="Recent announcements"
          >
            <h2 className="text-sm font-semibold mb-3">Recent Announcements</h2>
            {announcementsQuery.isLoading ? (
              <div className="animate-pulse space-y-2" aria-busy="true">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-4 bg-muted rounded w-full" />
                ))}
              </div>
            ) : announcementsQuery.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {getErrorMessage(announcementsQuery.error)}
              </p>
            ) : (announcementsQuery.data?.announcements ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No recent announcements.
              </p>
            ) : (
              <ul className="space-y-2">
                {(announcementsQuery.data?.announcements ?? []).map((ann) => (
                  <li
                    key={ann.id}
                    className="border-b last:border-b-0 pb-2 last:pb-0"
                  >
                    <p className="text-sm font-medium">{ann.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDisplayDate(ann.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent exam results */}
          <section
            className="rounded-lg border bg-card p-4"
            aria-label="Recent exam results"
          >
            <h2 className="text-sm font-semibold mb-3">Recent Results</h2>
            {resultsQuery.isLoading ? (
              <div className="animate-pulse space-y-2" aria-busy="true">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-5 bg-muted rounded w-3/4" />
                ))}
              </div>
            ) : resultsQuery.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {getErrorMessage(resultsQuery.error)}
              </p>
            ) : (resultsQuery.data?.results ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No exam results published yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {(resultsQuery.data?.results ?? []).slice(0, 3).map((r) => (
                  <li
                    key={r.examId}
                    className="flex items-center justify-between border-b last:border-b-0 pb-2 last:pb-0 text-sm"
                  >
                    <span className="truncate font-medium">
                      {r.studentName}
                    </span>
                    <span className="ml-2 shrink-0 font-semibold">
                      {r.aggregatePercentage.toFixed(1)}%{" · "}
                      <span
                        className={
                          r.overallResult === "PASS"
                            ? "text-green-700"
                            : "text-red-700"
                        }
                      >
                        {r.overallResult}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
