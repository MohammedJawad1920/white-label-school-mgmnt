/**
 * OutstandingFeesSummaryPage — Summary table by class.
 * Columns: class, totalCharged, totalPaid, totalBalance, studentCount.
 * Filter by sessionId.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { feesApi } from "@/api/fees.api";
import { academicSessionsApi } from "@/api/academicSessions";
import { parseApiError } from "@/utils/errors";
import type { FeeSummaryEntry } from "@/types/api";
import { QUERY_KEYS } from "@/utils/queryKeys";

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

function formatCurrency(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}

export default function OutstandingFeesSummaryPage() {
  const [sessionFilter, setSessionFilter] = useState("");

  const { data: sessionsData } = useQuery({
    queryKey: QUERY_KEYS.custom("academic-sessions"),
    queryFn: () => academicSessionsApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const summaryQuery = useQuery({
    queryKey: QUERY_KEYS.custom("fees", "summary", { sessionId: sessionFilter }),
    queryFn: () =>
      feesApi.summary({
        sessionId: sessionFilter || undefined,
      }),
    staleTime: 2 * 60 * 1000,
  });

  const summary = summaryQuery.data?.summary ?? [];
  const sessions = sessionsData?.sessions ?? [];

  const totals = summary.reduce(
    (acc, row) => ({
      totalCharged: acc.totalCharged + row.totalCharged,
      totalPaid: acc.totalPaid + row.totalPaid,
      totalBalance: acc.totalBalance + row.totalBalance,
      studentCount: acc.studentCount + row.studentCount,
    }),
    { totalCharged: 0, totalPaid: 0, totalBalance: 0, studentCount: 0 },
  );

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Outstanding Fees Summary</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Fee collection overview by class.
        </p>
      </div>

      {/* Filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
          aria-label="Filter by session"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Sessions</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {summaryQuery.isError && (
        <div
          role="alert"
          className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
        >
          {parseApiError(summaryQuery.error).message}
        </div>
      )}

      {/* Summary cards */}
      {!summaryQuery.isLoading && summary.length > 0 && (
        <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total Charged",
              value: formatCurrency(totals.totalCharged),
              color: "text-foreground",
            },
            {
              label: "Total Paid",
              value: formatCurrency(totals.totalPaid),
              color: "text-green-700",
            },
            {
              label: "Total Balance",
              value: formatCurrency(totals.totalBalance),
              color:
                totals.totalBalance > 0
                  ? "text-red-700"
                  : "text-muted-foreground",
            },
            {
              label: "Students",
              value: totals.studentCount.toString(),
              color: "text-foreground",
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {label}
              </p>
              <p className={`text-xl font-semibold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <caption className="sr-only">
            Outstanding fees summary by class
          </caption>
          <thead className="bg-muted/50 border-b">
            <tr>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Class
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-right font-medium text-muted-foreground"
              >
                Students
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-right font-medium text-muted-foreground"
              >
                Total Charged
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-right font-medium text-muted-foreground"
              >
                Total Paid
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-right font-medium text-muted-foreground"
              >
                Balance
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-right font-medium text-muted-foreground"
              >
                Collection %
              </th>
            </tr>
          </thead>
          <tbody>
            {summaryQuery.isLoading && (
              <tr>
                <td colSpan={6} className="p-0">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex gap-4 px-4 py-3 border-b animate-pulse"
                    >
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </td>
              </tr>
            )}
            {!summaryQuery.isLoading && summary.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No fee data found.
                </td>
              </tr>
            )}
            {summary.map((row: FeeSummaryEntry) => {
              const collectionPct =
                row.totalCharged > 0
                  ? ((row.totalPaid / row.totalCharged) * 100).toFixed(1)
                  : "—";
              return (
                <tr
                  key={row.classId}
                  className="border-b last:border-b-0 hover:bg-muted/20"
                >
                  <td className="px-4 py-2.5 font-medium">{row.className}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {row.studentCount}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">
                    {formatCurrency(row.totalCharged)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-green-700">
                    {formatCurrency(row.totalPaid)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs font-medium">
                    <span
                      className={
                        row.totalBalance > 0
                          ? "text-red-700"
                          : "text-muted-foreground"
                      }
                    >
                      {formatCurrency(row.totalBalance)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={`text-xs font-medium ${
                        collectionPct !== "—" && parseFloat(collectionPct) >= 80
                          ? "text-green-700"
                          : collectionPct !== "—" &&
                              parseFloat(collectionPct) >= 50
                            ? "text-amber-700"
                            : "text-red-700"
                      }`}
                    >
                      {collectionPct === "—" ? "—" : `${collectionPct}%`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
