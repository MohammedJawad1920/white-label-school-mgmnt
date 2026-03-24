/**
 * AssignmentListTeacherPage — Teacher's assignments view
 *
 * Lists teacher's own class+subject assignments.
 * On "Mark" click, expands an inline submission list with MarkingSheet.
 *
 * API:
 *   GET /assignments?classId=<classTeacherOf>
 *   GET /assignments/:id/submissions   (lazy, on expand)
 *   PUT /assignments/:id/submissions   (bulk mark)
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assignmentsApi } from "@/api/assignments.api";
import { MarkingSheet } from "@/components/MarkingSheet";
import { useAuth } from "@/hooks/useAuth";
import { useAppToast } from "@/hooks/useAppToast";
import { parseApiError } from "@/utils/errors";
import type { Assignment, AssignmentSubmission, ExamResult } from "@/types/api";
import { QUERY_KEYS } from "@/utils/queryKeys";

// ── Convert submissions to ExamResult shape for MarkingSheet ───────────────
function submissionsToMarkSheet(
  submissions: AssignmentSubmission[],
  maxMarks: number,
): ExamResult[] {
  return submissions.map((s) => ({
    studentId: s.studentId,
    studentName: s.studentName,
    admissionNumber: s.admissionNumber,
    marksObtained: s.marksObtained,
    isAbsent: s.status === "NOT_SUBMITTED",
    grade: null,
    isPass: null,
    marksStatus: "PENDING" as const,
  }));
}

// ── Submission panel (lazy-loaded per assignment) ──────────────────────────
interface SubmissionPanelProps {
  assignment: Assignment;
  onClose: () => void;
}

function SubmissionPanel({ assignment, onClose }: SubmissionPanelProps) {
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const maxMarks = assignment.maxMarks ?? 100;

  // Track edits: submissionId → { status, marksObtained?, remark? }
  const [edits, setEdits] = useState<
    Record<string, { marksObtained?: number; isAbsent?: boolean }>
  >({});

  const submissionsQ = useQuery({
    queryKey: QUERY_KEYS.assignments.submissions(assignment.id),
    queryFn: () => assignmentsApi.getSubmissions(assignment.id),
    staleTime: 2 * 60 * 1000,
  });

  const submissions = submissionsQ.data?.submissions ?? [];

  // Merge server data with local edits
  const displayMarks: ExamResult[] = submissionsToMarkSheet(
    submissions,
    maxMarks,
  ).map((row) => {
    const edit = edits[row.studentId];
    if (!edit) return row;
    return {
      ...row,
      marksObtained:
        edit.marksObtained !== undefined
          ? edit.marksObtained
          : row.marksObtained,
      isAbsent: edit.isAbsent !== undefined ? edit.isAbsent : row.isAbsent,
    };
  });

  const bulkMarkMut = useMutation({
    mutationFn: () => {
      const payload = submissions.map((s) => {
        const edit = edits[s.studentId];
        const isAbsent = edit?.isAbsent ?? s.status === "NOT_SUBMITTED";
        const marks = edit?.marksObtained ?? s.marksObtained ?? undefined;
        return {
          submissionId: s.id,
          status: isAbsent
            ? ("NOT_SUBMITTED" as const)
            : marks !== undefined
              ? ("COMPLETED" as const)
              : ("INCOMPLETE" as const),
          marksObtained: marks,
        };
      });
      return assignmentsApi.bulkMark(assignment.id, { submissions: payload });
    },
    onSuccess: () => {
      toast.success("Marks saved successfully.");
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.assignments.submissions(assignment.id),
      });
      setEdits({});
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  const subError = submissionsQ.isError
    ? parseApiError(submissionsQ.error)
    : null;

  return (
    <div className="mt-3 border rounded-lg bg-muted/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium">
          Marking: {assignment.title}
          {assignment.maxMarks !== null && (
            <span className="ml-1 text-muted-foreground text-xs">
              (max {assignment.maxMarks})
            </span>
          )}
        </p>
        <button
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground"
          aria-label="Close marking sheet"
        >
          Close
        </button>
      </div>

      {submissionsQ.isLoading && (
        <div
          className="animate-pulse space-y-2"
          aria-busy="true"
          aria-label="Loading submissions"
        >
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-muted rounded" />
          ))}
        </div>
      )}

      {submissionsQ.isError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {subError?.message ?? "Failed to load submissions."}
        </div>
      )}

      {!submissionsQ.isLoading && !submissionsQ.isError && (
        <>
          <MarkingSheet
            marks={displayMarks}
            maxMarks={maxMarks}
            readOnly={assignment.status === "CLOSED"}
            onChange={
              assignment.status !== "CLOSED"
                ? (studentId, value) =>
                    setEdits((prev) => ({
                      ...prev,
                      [studentId]: { ...prev[studentId], ...value },
                    }))
                : undefined
            }
          />
          {assignment.status !== "CLOSED" && submissions.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => bulkMarkMut.mutate()}
                disabled={bulkMarkMut.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {bulkMarkMut.isPending ? "Saving…" : "Save Marks"}
              </button>
            </div>
          )}
          {submissions.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No submissions yet.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function AssignmentListTeacherPage() {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const classId = user?.classTeacherOf ?? undefined;

  const assignmentsQ = useQuery({
    queryKey: QUERY_KEYS.assignments.list(classId ? { classId } : {}),
    queryFn: () => assignmentsApi.list(classId ? { classId } : {}),
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.id,
  });

  const assignments = assignmentsQ.data?.assignments ?? [];
  const apiError = assignmentsQ.isError
    ? parseApiError(assignmentsQ.error)
    : null;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Assignments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your class assignments — click "Mark" to enter grades
        </p>
      </div>

      {/* Loading */}
      {assignmentsQ.isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border bg-card p-4 space-y-2"
            >
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {assignmentsQ.isError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {apiError?.message ?? "Failed to load assignments."}
        </div>
      )}

      {/* Empty */}
      {!assignmentsQ.isLoading &&
        !assignmentsQ.isError &&
        assignments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border bg-muted/10">
            <p className="text-sm text-muted-foreground">
              No assignments found for your class.
            </p>
          </div>
        )}

      {/* Assignment list */}
      {!assignmentsQ.isLoading && assignments.length > 0 && (
        <ul className="space-y-3">
          {assignments.map((assignment) => (
            <li key={assignment.id}>
              <article className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {assignment.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {assignment.subjectName} · {assignment.className}
                      {assignment.dueDate && (
                        <span className="ml-2">Due: {assignment.dueDate}</span>
                      )}
                    </p>
                    {assignment.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {assignment.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        assignment.status === "OPEN"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {assignment.status}
                    </span>
                    <button
                      onClick={() =>
                        setExpandedId(
                          expandedId === assignment.id ? null : assignment.id,
                        )
                      }
                      aria-expanded={expandedId === assignment.id}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {expandedId === assignment.id ? "Close" : "Mark"}
                    </button>
                  </div>
                </div>

                {/* Inline submission panel */}
                {expandedId === assignment.id && (
                  <SubmissionPanel
                    assignment={assignment}
                    onClose={() => setExpandedId(null)}
                  />
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
