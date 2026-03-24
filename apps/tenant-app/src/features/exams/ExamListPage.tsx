/**
 * ExamListPage — List exams with filters (sessionId, classId, status).
 * Create Exam button opens an inline form.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { examsApi } from "@/api/exams.api";
import { classesApi } from "@/api/classes";
import { academicSessionsApi } from "@/api/academicSessions";
import { parseApiError } from "@/utils/errors";
import { useAppToast } from "@/hooks/useAppToast";
import type { Exam, ExamStatus } from "@/types/api";
import { QUERY_KEYS } from "@/utils/queryKeys";

const EXAM_STATUSES: ExamStatus[] = ["DRAFT", "PUBLISHED", "UNPUBLISHED"];

const STATUS_STYLES: Record<ExamStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PUBLISHED: "bg-green-100 text-green-800",
  UNPUBLISHED: "bg-amber-100 text-amber-700",
};

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  classId: z.string().min(1, "Class is required"),
  sessionId: z.string().min(1, "Session is required"),
});
type CreateFormValues = z.infer<typeof createSchema>;

const inputCls = (err: boolean) =>
  `w-full rounded-md border ${err ? "border-destructive" : "border-input"} bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`;

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

function CreateExamForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useAppToast();
  const [rootError, setRootError] = useState<string | null>(null);

  const { data: classesData } = useQuery({
    queryKey: QUERY_KEYS.classes(),
    queryFn: () => classesApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: sessionsData } = useQuery({
    queryKey: QUERY_KEYS.custom("academic-sessions"),
    queryFn: () => academicSessionsApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateFormValues>({ resolver: zodResolver(createSchema) });

  const mutation = useMutation({
    mutationFn: (v: CreateFormValues) => examsApi.create(v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.exams.all() });
      toast.success("Exam created.");
      onClose();
    },
    onError: (err) => {
      setRootError(parseApiError(err).message);
      toast.mutationError("Failed to create exam.");
    },
  });

  return (
    <form
      onSubmit={handleSubmit((v) => {
        setRootError(null);
        mutation.mutate(v);
      })}
      noValidate
      className="rounded-lg border bg-card p-4 mb-5 space-y-4"
    >
      <h2 className="text-sm font-semibold">New Exam</h2>
      {rootError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive"
        >
          {rootError}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="ex-name" className="block text-sm font-medium mb-1">
            Exam Name *
          </label>
          <input
            id="ex-name"
            type="text"
            className={inputCls(!!errors.name)}
            {...register("name")}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="ex-type" className="block text-sm font-medium mb-1">
            Type *
          </label>
          <input
            id="ex-type"
            type="text"
            placeholder="e.g. Mid-Term"
            className={inputCls(!!errors.type)}
            {...register("type")}
          />
          {errors.type && (
            <p className="mt-1 text-xs text-destructive">
              {errors.type.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="ex-class" className="block text-sm font-medium mb-1">
            Class *
          </label>
          <select
            id="ex-class"
            className={inputCls(!!errors.classId)}
            {...register("classId")}
          >
            <option value="">Select class…</option>
            {(classesData?.classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.classId && (
            <p className="mt-1 text-xs text-destructive">
              {errors.classId.message}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="ex-session"
            className="block text-sm font-medium mb-1"
          >
            Session *
          </label>
          <select
            id="ex-session"
            className={inputCls(!!errors.sessionId)}
            {...register("sessionId")}
          >
            <option value="">Select session…</option>
            {(sessionsData?.sessions ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {errors.sessionId && (
            <p className="mt-1 text-xs text-destructive">
              {errors.sessionId.message}
            </p>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? "Creating…" : "Create Exam"}
        </button>
      </div>
    </form>
  );
}

export default function ExamListPage() {
  const navigate = useNavigate();
  const [sessionFilter, setSessionFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExamStatus | "">("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: classesData } = useQuery({
    queryKey: QUERY_KEYS.classes(),
    queryFn: () => classesApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: sessionsData } = useQuery({
    queryKey: QUERY_KEYS.custom("academic-sessions"),
    queryFn: () => academicSessionsApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const examsQuery = useQuery({
    queryKey: QUERY_KEYS.custom("exams", {
      sessionId: sessionFilter,
      classId: classFilter,
      status: statusFilter,
    }),
    queryFn: () =>
      examsApi.list({
        sessionId: sessionFilter || undefined,
        classId: classFilter || undefined,
        status: statusFilter || undefined,
      }),
    staleTime: 2 * 60 * 1000,
  });

  const exams = examsQuery.data?.exams ?? [];

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Exams</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage exams and results.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {showCreate ? "Cancel" : "+ Create Exam"}
        </button>
      </div>

      {showCreate && <CreateExamForm onClose={() => setShowCreate(false)} />}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
          aria-label="Filter by session"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Sessions</option>
          {(sessionsData?.sessions ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          aria-label="Filter by class"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Classes</option>
          {(classesData?.classes ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ExamStatus | "")}
          aria-label="Filter by status"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Statuses</option>
          {EXAM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {examsQuery.isError && (
        <div
          role="alert"
          className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive"
        >
          {parseApiError(examsQuery.error).message}
        </div>
      )}

      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Exam list</caption>
          <thead className="bg-muted/50 border-b">
            <tr>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Name
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Class
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-left font-medium text-muted-foreground"
              >
                Session
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
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {examsQuery.isLoading && (
              <tr>
                <td colSpan={5} className="p-0">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex gap-4 px-4 py-3 border-b animate-pulse"
                    >
                      <Skeleton className="h-4 w-40 flex-1" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </td>
              </tr>
            )}
            {!examsQuery.isLoading && exams.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No exams found.
                </td>
              </tr>
            )}
            {exams.map((exam: Exam) => (
              <tr
                key={exam.id}
                className="border-b last:border-b-0 hover:bg-muted/20"
              >
                <td className="px-4 py-2.5 font-medium">{exam.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {exam.className}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {exam.sessionName}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[exam.status]}`}
                  >
                    {exam.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/exams/${exam.id}`)}
                    className="rounded px-2.5 py-1 text-xs font-medium border border-input hover:bg-muted transition-colors"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
