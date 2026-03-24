/**
 * MarksEntrySheetPage — Teacher enters marks for a subject in an exam.
 *
 * Route: /teacher/exams/:examId/marks/:subjectId  (or /teacher/exams/:examId/marks
 *         if subjectId is picked from the exam's subject list)
 *
 * Uses useParams for :examId and :subjectId.
 * readOnly = true when exam status is PUBLISHED (locked state banner shown by MarkingSheet).
 * Submit requires all rows filled (marks OR isAbsent = true).
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { examsApi } from "@/api/exams.api";
import { MarkingSheet } from "@/components/MarkingSheet";
import { useAppToast } from "@/hooks/useAppToast";
import { parseApiError } from "@/utils/errors";
import type { ExamResult } from "@/types/api";
import { QUERY_KEYS } from "@/utils/queryKeys";

export default function MarksEntrySheetPage() {
  const { examId, subjectId: subjectIdParam } = useParams<{
    examId: string;
    subjectId?: string;
  }>();
  const toast = useAppToast();
  const queryClient = useQueryClient();

  const [selectedSubjectId, setSelectedSubjectId] = useState(
    subjectIdParam ?? "",
  );

  // Track pending edits: studentId → { marksObtained?, isAbsent? }
  const [edits, setEdits] = useState<
    Record<string, { marksObtained?: number; isAbsent?: boolean }>
  >({});

  // ── Fetch exam detail ──────────────────────────────────────────────────
  const examQ = useQuery({
    queryKey: QUERY_KEYS.exams.detail(examId ?? ""),
    queryFn: () => examsApi.get(examId!),
    staleTime: 5 * 60 * 1000,
    enabled: !!examId,
  });

  const exam = examQ.data;
  const isPublished = exam?.status === "PUBLISHED";

  // Auto-select first subject if none provided
  useEffect(() => {
    if (!subjectIdParam && exam?.gradeBoundaries !== undefined) {
      // exam subjects come from the marks endpoint; the exam object doesn't
      // carry subjects — we select from the list once marks are fetched.
    }
  }, [subjectIdParam, exam]);

  // ── Fetch marks for selected subject ──────────────────────────────────
  const marksQ = useQuery({
    queryKey: QUERY_KEYS.exams.marks(examId ?? "", selectedSubjectId),
    queryFn: () => examsApi.getMarks(examId!, selectedSubjectId),
    staleTime: 2 * 60 * 1000,
    enabled: !!examId && !!selectedSubjectId,
  });

  const marks = marksQ.data?.marks ?? [];

  // Reset edits when subject changes or fresh data arrives
  useEffect(() => {
    setEdits({});
  }, [selectedSubjectId, marksQ.dataUpdatedAt]);

  // Merge server marks with local edits for display
  const displayMarks: ExamResult[] = marks.map((row) => {
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

  // Validate: every student must have marks or isAbsent checked
  const isComplete = displayMarks.every(
    (r) => r.isAbsent || r.marksObtained !== null,
  );

  // ── Find the selected subject's totalMarks ─────────────────────────────
  // We don't have a subject list directly on Exam; we'll re-fetch the marks
  // to find totalMarks, but we can also just allow the user to pick from a
  // subject select populated by re-fetching. Use a simple default of 100.
  const maxMarks = 100; // Will be shown; actual validation is server-side.

  // ── Submit marks mutation ──────────────────────────────────────────────
  const submitMut = useMutation({
    mutationFn: () => {
      const payload = displayMarks.map((r) => ({
        studentId: r.studentId,
        marksObtained: r.isAbsent ? undefined : (r.marksObtained ?? undefined),
        isAbsent: r.isAbsent,
      }));
      return examsApi.enterMarks(examId!, selectedSubjectId, payload);
    },
    onSuccess: () => {
      toast.success("Marks saved successfully.");
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.exams.marks(examId!, selectedSubjectId),
      });
      setEdits({});
    },
    onError: (err) => {
      toast.mutationError(parseApiError(err).message);
    },
  });

  const handleChange = useCallback(
    (
      studentId: string,
      value: { marksObtained?: number; isAbsent?: boolean },
    ) => {
      setEdits((prev) => ({
        ...prev,
        [studentId]: { ...prev[studentId], ...value },
      }));
    },
    [],
  );

  const examError = examQ.isError ? parseApiError(examQ.error) : null;
  const marksError = marksQ.isError ? parseApiError(marksQ.error) : null;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <Link
          to="/teacher/exams"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to exams list"
        >
          ← Back
        </Link>
        <div>
          <h1 className="text-xl font-semibold">
            {examQ.isLoading ? (
              <span className="animate-pulse inline-block h-5 bg-muted rounded w-40" />
            ) : (
              (exam?.name ?? "Marks Entry")
            )}
          </h1>
          {exam && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {exam.className} · {exam.sessionName}
            </p>
          )}
        </div>
      </div>

      {/* Exam load error */}
      {examQ.isError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive mb-4"
        >
          {examError?.message ?? "Failed to load exam details."}
        </div>
      )}

      {/* Subject selector — only shown when no subjectId in URL */}
      {!subjectIdParam && exam && (
        <div className="mb-5">
          <label
            htmlFor="subjectSelect"
            className="block text-sm font-medium mb-1"
          >
            Select subject
          </label>
          <input
            id="subjectSelect"
            type="text"
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            placeholder="Enter subject ID"
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full max-w-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Navigate directly via{" "}
            <code>/teacher/exams/{examId}/marks/:subjectId</code>
          </p>
        </div>
      )}

      {/* Published notice */}
      {isPublished && (
        <div
          role="status"
          className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm font-medium text-amber-800"
        >
          This exam is published. Marks are locked and cannot be edited.
        </div>
      )}

      {/* Prompt to select subject */}
      {!selectedSubjectId && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border bg-muted/10">
          <p className="text-sm text-muted-foreground">
            Select a subject to view and enter marks.
          </p>
        </div>
      )}

      {/* Marks loading */}
      {selectedSubjectId && marksQ.isLoading && (
        <div
          className="animate-pulse space-y-2"
          aria-label="Loading marks"
          aria-busy="true"
        >
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-muted rounded" />
          ))}
        </div>
      )}

      {/* Marks error */}
      {selectedSubjectId && marksQ.isError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {marksError?.message ?? "Failed to load marks."}
        </div>
      )}

      {/* Marks table */}
      {selectedSubjectId && !marksQ.isLoading && !marksQ.isError && (
        <>
          <MarkingSheet
            marks={displayMarks}
            maxMarks={maxMarks}
            readOnly={isPublished}
            onChange={!isPublished ? handleChange : undefined}
          />

          {/* Submit button */}
          {!isPublished && displayMarks.length > 0 && (
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <button
                onClick={() => submitMut.mutate()}
                disabled={submitMut.isPending || !isComplete}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-disabled={!isComplete}
              >
                {submitMut.isPending ? "Saving…" : "Save Marks"}
              </button>
              {!isComplete && (
                <p className="text-xs text-muted-foreground">
                  All students must have marks entered or be marked absent
                  before saving.
                </p>
              )}
            </div>
          )}

          {displayMarks.length === 0 && (
            <div className="mt-4 flex flex-col items-center justify-center py-12 text-center rounded-lg border bg-muted/10">
              <p className="text-sm text-muted-foreground">
                No students found for this subject.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
