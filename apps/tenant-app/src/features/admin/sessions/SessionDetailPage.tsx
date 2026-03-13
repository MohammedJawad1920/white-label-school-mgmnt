/**
 * SessionDetailPage — v5.0 M-013
 *
 * Route: /admin/sessions/:id (Admin only)
 * Shows session details, allows activate/close, copy timetable, start promotion.
 *
 * H-04fe: Fetches session via GET /academic-sessions/:id (not list + client-side filter).
 *         Also loads GET /classes?sessionId=:id to display enrolled classes.
 */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { academicSessionsApi } from "@/api/academicSessions";
import { classesApi } from "@/api/classes";
import { parseApiError } from "@/utils/errors";
import { QUERY_KEYS } from "@/utils/queryKeys";
import type { AcademicSessionStatus } from "@/types/api";

function statusBadgeCls(status: AcademicSessionStatus): string {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-700";
    case "UPCOMING":
      return "bg-blue-100 text-blue-700";
    case "COMPLETED":
      return "bg-gray-100 text-gray-600";
  }
}

const copyTimetableSchema = z.object({
  sourceSessionId: z
    .string()
    .min(1, "Source session is required")
    .uuid("Must be a valid session ID"),
});
type CopyTimetableFormValues = z.infer<typeof copyTimetableSchema>;

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCopyTimetable, setShowCopyTimetable] = useState(false);

  // H-04fe: fetch session directly by ID instead of filtering the full list
  const { data: sessionData, isLoading: sessionLoading } = useQuery({
    queryKey: QUERY_KEYS.sessionDetail(id!),
    queryFn: () => academicSessionsApi.getById(id!),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });

  const session = sessionData?.session;

  // H-04fe: load classes for this session
  const { data: classesData } = useQuery({
    // QUERY_KEYS.classes() doesn't support sessionId filtering — using inline key
    queryKey: ["classes", { sessionId: id }],
    queryFn: () => classesApi.listBySession(id!),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });

  const sessionClasses = classesData?.classes ?? [];

  const activateMutation = useMutation({
    mutationFn: () => academicSessionsApi.activate(id!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.sessions() });
      toast.success("Session activated");
    },
    onError: (err) => toast.error(parseApiError(err).message),
  });

  const closeMutation = useMutation({
    mutationFn: () => academicSessionsApi.close(id!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.sessions() });
      toast.success("Session closed");
    },
    onError: (err) => toast.error(parseApiError(err).message),
  });

  const copyMutation = useMutation({
    mutationFn: (sourceSessionId: string) =>
      academicSessionsApi.copyTimetable(id!, { sourceSessionId }),
    onSuccess: (data) => {
      toast.success(`Copied ${data.copiedCount} timeslots`);
      setShowCopyTimetable(false);
      resetCopyForm();
    },
    onError: (err) => toast.error(parseApiError(err).message),
  });

  const {
    register: registerCopy,
    handleSubmit: handleCopySubmit,
    reset: resetCopyForm,
    formState: { errors: copyErrors, isSubmitting: isCopySubmitting },
  } = useForm<CopyTimetableFormValues>({
    resolver: zodResolver(copyTimetableSchema),
    mode: "onBlur",
  });

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-muted-foreground">Session not found.</p>
        <button
          onClick={() => navigate("/admin/sessions")}
          className="mt-3 text-sm text-primary hover:underline"
        >
          ← Back to sessions
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      {/* Back nav */}
      <button
        onClick={() => navigate("/admin/sessions")}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Academic Sessions
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{session.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {session.startDate} – {session.endDate}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeCls(session.status)}`}
        >
          {session.status}
        </span>
      </div>

      {/* Actions */}
      <div className="border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          {session.status === "UPCOMING" && (
            <button
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
              className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {activateMutation.isPending ? "Activating…" : "Activate Session"}
            </button>
          )}
          {session.status === "ACTIVE" && (
            <>
              <button
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
                className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
              >
                {closeMutation.isPending ? "Closing…" : "Close Session"}
              </button>
              <button
                onClick={() =>
                  navigate(`/admin/sessions/${session.id}/promote`)
                }
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Promote Students
              </button>
            </>
          )}
          {session.status === "UPCOMING" && (
            <button
              onClick={() => setShowCopyTimetable(true)}
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              Copy Timetable
            </button>
          )}
        </div>
      </div>

      {/* Session info */}
      <div className="border rounded-lg divide-y">
        {[
          { label: "Session ID", value: session.id },
          { label: "Status", value: session.status },
          { label: "Start date", value: session.startDate },
          { label: "End date", value: session.endDate },
          {
            label: "Created",
            value: new Date(session.createdAt).toLocaleDateString(),
          },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium font-mono text-xs">{value}</span>
          </div>
        ))}
      </div>

      {/* H-04fe: Classes in this session */}
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h2 className="text-sm font-medium">
            Classes ({sessionClasses.length})
          </h2>
        </div>
        {sessionClasses.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            No classes found for this session.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/20 border-b">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  Class name
                </th>
                <th
                  scope="col"
                  className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  Batch
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sessionClasses.map((cls) => (
                <tr key={cls.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-medium">{cls.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {cls.batchName ?? cls.batchId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Copy Timetable modal */}
      {showCopyTimetable && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCopyTimetable(false);
          }}
        >
          <div className="w-full max-w-sm bg-background rounded-xl shadow-xl p-6 mx-4">
            <h2 className="text-base font-semibold mb-2">Copy Timetable</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Copy timeslots from another session's classes into this session's
              matching classes.
            </p>
            <form
              onSubmit={handleCopySubmit((v) =>
                copyMutation.mutate(v.sourceSessionId),
              )}
              noValidate
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="sourceSessionId"
                  className="block text-sm font-medium mb-1.5"
                >
                  Source session ID
                </label>
                <input
                  id="sourceSessionId"
                  type="text"
                  placeholder="UUID of source session"
                  aria-invalid={copyErrors.sourceSessionId ? true : undefined}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
                  {...registerCopy("sourceSessionId")}
                />
                {copyErrors.sourceSessionId && (
                  <p role="alert" className="mt-1.5 text-xs text-destructive">
                    {copyErrors.sourceSessionId.message}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCopyTimetable(false)}
                  className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCopySubmitting || copyMutation.isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Copy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
