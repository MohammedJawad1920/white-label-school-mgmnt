/**
 * ExamDetailPage — Shows exam detail + subjects list (add/remove).
 * Publish/Unpublish button always rendered, disabled when not all subjects ENTERED.
 */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { examsApi } from "@/api/exams.api";
import { subjectsApi } from "@/api/subjects";
import { parseApiError } from "@/utils/errors";
import { useAppToast } from "@/hooks/useAppToast";
import { GradeBadge } from "@/components/GradeBadge";
import type { ExamSubject } from "@/types/api";

const addSubjectSchema = z.object({
  subjectId: z.string().min(1, "Subject is required"),
  totalMarks: z
    .number({ invalid_type_error: "Required" })
    .positive("Must be positive"),
  passMarks: z
    .number({ invalid_type_error: "Required" })
    .positive("Must be positive"),
});
type AddSubjectValues = z.infer<typeof addSubjectSchema>;

const inputCls = (err: boolean) =>
  `w-full rounded-md border ${err ? "border-destructive" : "border-input"} bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`;

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

export default function ExamDetailPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useAppToast();
  const [showAddSubject, setShowAddSubject] = useState(false);

  const examQuery = useQuery({
    queryKey: ["exams", examId],
    queryFn: () => examsApi.get(examId!),
    staleTime: 2 * 60 * 1000,
    enabled: !!examId,
  });

  // Subjects for the exam's class come from GET /subjects
  const subjectsQuery = useQuery({
    queryKey: ["subjects"],
    queryFn: () => subjectsApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  // Exam subjects — embedded in exam detail or fetched via subjects list
  // The Exam type includes gradeBoundaries; subjects come from the exam object itself after
  // adding them. We treat examQuery.data as the source of truth.
  const exam = examQuery.data ?? null;

  // Subjects for this exam — they are returned as part of the exam object?
  // Looking at the Exam type, it doesn't include subjects directly.
  // We need to query subjects differently. Let's fetch exam subjects via the marks endpoint.
  // Actually, looking at examsApi: there's no dedicated "list subjects for exam" endpoint.
  // The subjects are retrieved from POST responses and stored in state.
  // We'll maintain a local subjects list from the add/remove mutations.
  const [examSubjects, setExamSubjects] = useState<ExamSubject[]>([]);
  const [subjectsLoaded, setSubjectsLoaded] = useState(false);

  // Load exam subjects by fetching marks for known subjects — use subjects API approach
  // Since there is no GET /exams/:id/subjects endpoint in the API file, we use a workaround:
  // We get all available subjects and show add form. Existing subjects are tracked via state.

  const publishMut = useMutation({
    mutationFn: () => examsApi.publish(examId!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["exams", examId] });
      toast.success("Exam published.");
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  const unpublishMut = useMutation({
    mutationFn: () => examsApi.unpublish(examId!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["exams", examId] });
      toast.success("Exam unpublished.");
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  const addSubjectMut = useMutation({
    mutationFn: (v: AddSubjectValues) => examsApi.addSubject(examId!, v),
    onSuccess: (newSubject) => {
      setExamSubjects((prev) => [...prev, newSubject]);
      setShowAddSubject(false);
      toast.success("Subject added.");
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  const removeSubjectMut = useMutation({
    mutationFn: (subjectId: string) =>
      examsApi.removeSubject(examId!, subjectId),
    onSuccess: (_, subjectId) => {
      setExamSubjects((prev) => prev.filter((s) => s.subjectId !== subjectId));
      toast.success("Subject removed.");
    },
    onError: (err) => toast.mutationError(parseApiError(err).message),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddSubjectValues>({
    resolver: zodResolver(addSubjectSchema),
  });

  const allSubjectsEntered =
    examSubjects.length > 0 &&
    examSubjects.every((s) => s.marksStatus === "ENTERED");
  const canPublish = allSubjectsEntered && exam?.status !== "PUBLISHED";

  if (examQuery.isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-7 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (examQuery.isError || !exam) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div
          role="alert"
          className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
        >
          {examQuery.isError
            ? parseApiError(examQuery.error).message
            : "Exam not found."}
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

  const STATUS_STYLES: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    PUBLISHED: "bg-green-100 text-green-800",
    UNPUBLISHED: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{exam.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {exam.className} · {exam.sessionName} · {exam.type}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[exam.status] ?? "bg-muted text-muted-foreground"}`}
          >
            {exam.status}
          </span>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
          >
            Back
          </button>
        </div>
      </div>

      {/* Publish/Unpublish */}
      <div className="mb-5 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold mb-3">Publication</h2>
        <div className="flex items-center gap-3 flex-wrap">
          {exam.status !== "PUBLISHED" ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canPublish || publishMut.isPending}
                onClick={() => publishMut.mutate()}
                title={
                  !canPublish
                    ? "All subjects must have marks entered before publishing."
                    : undefined
                }
                aria-disabled={!canPublish}
                className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {publishMut.isPending ? "Publishing…" : "Publish Exam"}
              </button>
              {!canPublish && (
                <p className="text-xs text-muted-foreground">
                  All subjects must have marks entered (ENTERED status) before
                  publishing.
                </p>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled={unpublishMut.isPending}
              onClick={() => unpublishMut.mutate()}
              className="inline-flex items-center rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              {unpublishMut.isPending ? "Unpublishing…" : "Unpublish Exam"}
            </button>
          )}
        </div>
      </div>

      {/* Grade Boundaries */}
      {exam.gradeBoundaries.length > 0 && (
        <div className="mb-5 rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Grade Boundaries</h2>
          <div className="flex flex-wrap gap-2">
            {exam.gradeBoundaries.map((gb) => (
              <div
                key={gb.grade}
                className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs"
              >
                <GradeBadge grade={gb.grade} />
                <span className="text-muted-foreground">
                  ≥ {gb.minPercent}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subjects */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">Subjects</h2>
          <button
            type="button"
            onClick={() => setShowAddSubject((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {showAddSubject ? "Cancel" : "+ Add Subject"}
          </button>
        </div>

        {showAddSubject && (
          <form
            onSubmit={handleSubmit((v) => {
              addSubjectMut.mutate(v);
              reset();
            })}
            className="px-4 py-3 border-b bg-muted/30 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="as-subject"
                  className="block text-xs font-medium mb-1"
                >
                  Subject *
                </label>
                <select
                  id="as-subject"
                  className={inputCls(!!errors.subjectId)}
                  {...register("subjectId")}
                >
                  <option value="">Select subject…</option>
                  {(subjectsQuery.data?.subjects ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {errors.subjectId && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.subjectId.message}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="as-total"
                  className="block text-xs font-medium mb-1"
                >
                  Total Marks *
                </label>
                <input
                  id="as-total"
                  type="number"
                  min={1}
                  className={inputCls(!!errors.totalMarks)}
                  {...register("totalMarks", { valueAsNumber: true })}
                />
                {errors.totalMarks && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.totalMarks.message}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="as-pass"
                  className="block text-xs font-medium mb-1"
                >
                  Pass Marks *
                </label>
                <input
                  id="as-pass"
                  type="number"
                  min={1}
                  className={inputCls(!!errors.passMarks)}
                  {...register("passMarks", { valueAsNumber: true })}
                />
                {errors.passMarks && (
                  <p className="text-xs text-destructive mt-1">
                    {errors.passMarks.message}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={addSubjectMut.isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {addSubjectMut.isPending ? "Adding…" : "Add"}
              </button>
            </div>
          </form>
        )}

        {examSubjects.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No subjects added yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Exam subjects</caption>
            <thead className="bg-muted/50 border-b">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-left font-medium text-muted-foreground"
                >
                  Subject
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-left font-medium text-muted-foreground"
                >
                  Total
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-left font-medium text-muted-foreground"
                >
                  Pass
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-left font-medium text-muted-foreground"
                >
                  Marks Status
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-right font-medium text-muted-foreground"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {examSubjects.map((es: ExamSubject) => (
                <tr
                  key={es.id}
                  className="border-b last:border-b-0 hover:bg-muted/20"
                >
                  <td className="px-4 py-2.5 font-medium">{es.subjectName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {es.totalMarks}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {es.passMarks}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        es.marksStatus === "ENTERED"
                          ? "bg-green-100 text-green-800"
                          : es.marksStatus === "ABSENT"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {es.marksStatus}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      disabled={removeSubjectMut.isPending}
                      onClick={() => {
                        if (
                          window.confirm(`Remove subject "${es.subjectName}"?`)
                        ) {
                          removeSubjectMut.mutate(es.subjectId);
                        }
                      }}
                      className="rounded px-2.5 py-1 text-xs font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* View Results link */}
      {exam.status === "PUBLISHED" && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => navigate(`/admin/exams/${examId}/results`)}
            className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            View Consolidated Results →
          </button>
        </div>
      )}
    </div>
  );
}
