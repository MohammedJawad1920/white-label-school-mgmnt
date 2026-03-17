/**
 * ConsolidatedResultsPage — Shows consolidated results table.
 * Download All Report Cards button with elapsed time counter + 60s timeout guard.
 */
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { examsApi } from "@/api/exams.api";
import { parseApiError } from "@/utils/errors";
import { useAppToast } from "@/hooks/useAppToast";
import { GradeBadge } from "@/components/GradeBadge";
import { apiClient } from "@/api/client";

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

export default function ConsolidatedResultsPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const toast = useAppToast();

  const [isDownloading, setIsDownloading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const examQuery = useQuery({
    queryKey: ["exams", examId],
    queryFn: () => examsApi.get(examId!),
    staleTime: 2 * 60 * 1000,
    enabled: !!examId,
  });

  const resultsQuery = useQuery({
    queryKey: ["exams", examId, "results"],
    queryFn: () => examsApi.getResults(examId!),
    staleTime: 2 * 60 * 1000,
    enabled: !!examId,
  });

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function startDownload() {
    setIsDownloading(true);
    setElapsed(0);
    setTimedOut(false);

    // Start elapsed counter
    intervalRef.current = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);

    // 60-second timeout guard
    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsDownloading(false);
      setTimedOut(true);
      toast.mutationError(
        "Download timed out after 60 seconds. Please try again.",
      );
    }, 60_000);

    // Trigger download via apiClient (returns blob)
    apiClient
      .get(`/exams/${examId}/report-cards`, { responseType: "blob" })
      .then((response) => {
        const url = window.URL.createObjectURL(
          new Blob([response.data as BlobPart]),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = `exam-${examId}-report-cards.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success("Report cards downloaded.");
      })
      .catch((err: unknown) => {
        toast.mutationError(parseApiError(err).message);
      })
      .finally(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsDownloading(false);
      });
  }

  const exam = examQuery.data ?? null;
  const results = resultsQuery.data?.students ?? [];

  if (examQuery.isLoading || resultsQuery.isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-7 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const queryError = examQuery.isError
    ? parseApiError(examQuery.error).message
    : resultsQuery.isError
      ? parseApiError(resultsQuery.error).message
      : null;

  if (queryError) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div
          role="alert"
          className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
        >
          {queryError}
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            {exam?.name ?? "Consolidated Results"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {exam?.className} · {exam?.sessionName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
          >
            Back
          </button>
        </div>
      </div>

      {/* Download section */}
      <div className="mb-5 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold mb-3">Report Cards</h2>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={startDownload}
            disabled={isDownloading || results.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isDownloading ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Downloading… {elapsed}s
              </>
            ) : (
              "Download All Report Cards"
            )}
          </button>
          {isDownloading && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Preparing ZIP file… {elapsed}s elapsed (60s timeout)
            </p>
          )}
          {timedOut && (
            <p role="alert" className="text-xs text-destructive">
              Download timed out. Please try again.
            </p>
          )}
        </div>
      </div>

      {/* Results table */}
      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Consolidated results</caption>
          <thead className="bg-muted/50 border-b">
            <tr>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Rank
              </th>
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
                Admission No.
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-right font-medium text-muted-foreground"
              >
                Marks
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-center font-medium text-muted-foreground"
              >
                %
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-center font-medium text-muted-foreground"
              >
                Grade
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-center font-medium text-muted-foreground"
              >
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No results available.
                </td>
              </tr>
            ) : (
              results.map((r) => (
                <tr
                  key={r.studentId}
                  className="border-b last:border-b-0 hover:bg-muted/20"
                >
                  <td className="px-4 py-2.5 font-medium text-muted-foreground">
                    {r.classRank !== null ? `#${r.classRank}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-medium">{r.studentName}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {r.admissionNumber}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {r.totalMarksObtained}/{r.totalMarksPossible}
                  </td>
                  <td className="px-4 py-2.5 text-center font-medium">
                    {r.aggregatePercentage.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <GradeBadge grade={r.overallGrade} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.overallResult === "Pass"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {r.overallResult}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
