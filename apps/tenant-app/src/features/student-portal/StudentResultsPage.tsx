/**
 * StudentResultsPage — PUBLISHED exam results for the logged-in student.
 *
 * Shows ResultSummary cards for each published exam in the current session.
 * Report card download button per exam (PDF link via examsApi.reportCardUrl).
 *
 * Path: /student/results
 */
import { useQuery } from "@tanstack/react-query";
import { examsApi } from "../../api/exams.api";
import { ResultSummary } from "../../components/ResultSummary";
import { useAuth } from "../../hooks/useAuth";
import { useCurrentSession } from "../../hooks/useCurrentSession";
import { parseApiError } from "../../utils/errors";
import { QUERY_KEYS } from "../../utils/queryKeys";

export default function StudentResultsPage() {
  const { user } = useAuth();
  const studentId = user?.studentId ?? null;
  const currentSession = useCurrentSession();

  // Fetch published exams in the current session
  const examsQ = useQuery({
    queryKey: QUERY_KEYS.exams.list({
      sessionId: currentSession?.id,
      status: "PUBLISHED",
    }),
    queryFn: () =>
      examsApi.list({ sessionId: currentSession?.id, status: "PUBLISHED" }),
    staleTime: 5 * 60 * 1000,
    enabled: !!studentId && !!currentSession?.id,
  });

  const publishedExams = examsQ.data?.exams ?? [];
  const apiError = examsQ.isError ? parseApiError(examsQ.error) : null;

  if (!studentId) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold mb-4">My Results</h1>
        <div
          role="alert"
          className="rounded-lg border bg-muted/20 px-4 py-8 text-center"
        >
          <p className="text-sm text-muted-foreground">
            Your student profile is not linked. Contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold">My Results</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Published exam results
          {currentSession ? ` — ${currentSession.name}` : ""}
        </p>
      </div>

      {/* Loading */}
      {examsQ.isLoading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border bg-card p-5 space-y-3"
            >
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="flex gap-3">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-14 flex-1 bg-muted rounded-md" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {examsQ.isError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {apiError?.message ?? "Failed to load results."}
        </div>
      )}

      {/* Empty */}
      {!examsQ.isLoading && !examsQ.isError && publishedExams.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border bg-muted/10">
          <p className="text-sm text-muted-foreground">
            No published results yet
            {currentSession ? ` for ${currentSession.name}` : ""}.
          </p>
        </div>
      )}

      {/* Results */}
      {!examsQ.isLoading && publishedExams.length > 0 && (
        <div className="space-y-6">
          {publishedExams.map((exam) => (
            <ExamResultCard
              key={exam.id}
              examId={exam.id}
              examName={exam.name}
              studentId={studentId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Per-exam result card (lazy fetch) ─────────────────────────────────────
interface ExamResultCardProps {
  examId: string;
  examName: string;
  studentId: string;
}

function ExamResultCard({ examId, examName, studentId }: ExamResultCardProps) {
  const resultQ = useQuery({
    queryKey: QUERY_KEYS.exams.reportCard(examId, studentId),
    queryFn: () => examsApi.getStudentResult(examId, studentId),
    staleTime: 10 * 60 * 1000,
  });

  const reportCardUrl = examsApi.reportCardUrl(examId, studentId);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string;
  const downloadUrl = `${apiBaseUrl}${reportCardUrl}`;

  if (resultQ.isLoading) {
    return (
      <div className="animate-pulse rounded-lg border bg-card p-5 space-y-3">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="flex gap-3">
          {[1, 2, 3].map((j) => (
            <div key={j} className="h-14 flex-1 bg-muted rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (resultQ.isError) {
    const err = parseApiError(resultQ.error);
    return (
      <div className="rounded-lg border bg-destructive/10 p-4">
        <p className="font-medium text-sm mb-1">{examName}</p>
        <p className="text-xs text-destructive">{err.message}</p>
      </div>
    );
  }

  if (!resultQ.data) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{examName}</h2>
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Download report card for ${examName}`}
        >
          Download Report Card
        </a>
      </div>
      <ResultSummary summary={resultQ.data} />
    </div>
  );
}
