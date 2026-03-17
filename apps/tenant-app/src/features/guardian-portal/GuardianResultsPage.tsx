import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useGuardianSelectedChild } from "../../hooks/useGuardianSelectedChild";
import { guardianPortalApi } from "../../api/guardian-portal.api";
import { ResultSummary } from "../../components/ResultSummary";
import { QUERY_KEYS } from "../../utils/queryKeys";
import { getErrorMessage } from "../../utils/errors";
import type { ExamStudentSummary } from "../../types/api";

export default function GuardianResultsPage() {
  const { selectedChildId, selectedChild, children, setSelectedChild } =
    useGuardianSelectedChild();

  const resultsQuery = useQuery({
    queryKey: QUERY_KEYS.guardianPortal.results(selectedChildId ?? ""),
    queryFn: () => guardianPortalApi.childResults(selectedChildId!),
    enabled: !!selectedChildId,
    staleTime: 5 * 60 * 1000,
  });

  const results: ExamStudentSummary[] = resultsQuery.data?.results ?? [];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Exam Results</h1>
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
          {resultsQuery.isLoading && (
            <div
              className="animate-pulse space-y-4"
              aria-busy="true"
              aria-label="Loading results"
            >
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-lg border bg-card p-5">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded w-32" />
                      <div className="h-3 bg-muted rounded w-20" />
                    </div>
                    <div className="h-8 w-16 bg-muted rounded" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="h-14 bg-muted rounded" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {resultsQuery.isError && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {getErrorMessage(resultsQuery.error)}
            </div>
          )}

          {/* Empty */}
          {!resultsQuery.isLoading &&
            !resultsQuery.isError &&
            results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-muted-foreground">
                  No published exam results for {selectedChild.studentName}.
                </p>
              </div>
            )}

          {/* Results list */}
          {!resultsQuery.isLoading &&
            !resultsQuery.isError &&
            results.length > 0 && (
              <div className="space-y-4">
                {results.map((result) => (
                  <ResultSummary key={result.examId} summary={result} />
                ))}
              </div>
            )}
        </>
      )}
    </div>
  );
}
