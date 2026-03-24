/**
 * ImportHistoryPage — Table of past import jobs.
 * Columns: entity, status, totalRows, validRows, errorRows, created date.
 */
import { useQuery } from "@tanstack/react-query";
import { importApi } from "@/api/import.api";
import { parseApiError } from "@/utils/errors";
import type { ApiImportJob, ImportJobStatus } from "@/types/api";
import { QUERY_KEYS } from "@/utils/queryKeys";

const STATUS_STYLES: Record<ImportJobStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-700",
  EXPIRED: "bg-red-100 text-red-800",
};

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ImportHistoryPage() {
  const historyQuery = useQuery({
    queryKey: QUERY_KEYS.importJobs.history(),
    queryFn: () => importApi.history(),
    staleTime: 1 * 60 * 1000,
  });

  const jobs = historyQuery.data?.jobs ?? [];

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Import History</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Past CSV import jobs.
        </p>
      </div>

      {historyQuery.isError && (
        <div
          role="alert"
          className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
        >
          {parseApiError(historyQuery.error).message}
        </div>
      )}

      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Import job history</caption>
          <thead className="bg-muted/50 border-b">
            <tr>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Entity
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
                Total Rows
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-right font-medium text-muted-foreground"
              >
                Valid
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-right font-medium text-muted-foreground"
              >
                Errors
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Created
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Confirmed
              </th>
            </tr>
          </thead>
          <tbody>
            {historyQuery.isLoading && (
              <tr>
                <td colSpan={7} className="p-0">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex gap-4 px-4 py-3 border-b animate-pulse"
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                        <Skeleton key={j} className="h-4 w-24 flex-1" />
                      ))}
                    </div>
                  ))}
                </td>
              </tr>
            )}
            {!historyQuery.isLoading && jobs.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No import jobs found.
                </td>
              </tr>
            )}
            {jobs.map((job: ApiImportJob) => (
              <tr
                key={job.id}
                className="border-b last:border-b-0 hover:bg-muted/20"
              >
                <td className="px-4 py-2.5 font-medium capitalize">
                  {job.entity}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[job.status]}`}
                  >
                    {job.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">
                  {job.totalRows}
                </td>
                <td className="px-4 py-2.5 text-right text-green-700 font-medium">
                  {job.validRows}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {job.errorRows > 0 ? (
                    <span className="text-red-700 font-medium">
                      {job.errorRows}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                  {formatDate(job.createdAt)}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                  {job.confirmedAt ? formatDate(job.confirmedAt) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
