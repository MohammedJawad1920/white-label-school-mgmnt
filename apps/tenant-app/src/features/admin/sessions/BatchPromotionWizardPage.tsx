/**
 * BatchPromotionWizardPage — v5.0 M-013
 *
 * Route: /admin/sessions/:id/promote (Admin only)
 *
 * Two-step wizard:
 * Step 1: Select target session → POST /academic-sessions/:id/transition/preview
 *         Shows a preview of which students will be promoted/graduated/unassigned
 * Step 2: Review per-student selections (checkboxes) + Confirm →
 *         POST /academic-sessions/:id/transition/commit
 *
 * C-06fe: commit body now includes promotionPreviewId + per-batch student arrays.
 *         Unchecked students move to skippedStudentIds; all students default to promoted.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate, useBlocker } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { academicSessionsApi } from "@/api/academicSessions";
import { parseApiError } from "@/utils/errors";
import { QUERY_KEYS } from "@/utils/queryKeys";
import { useAppToast } from "@/hooks/useAppToast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type {
  AcademicSession,
  PromotionPreview,
  PromotionBatchPreview,
} from "@/types/api";

// Per-batch selection state: promoted vs skipped student IDs
type BatchSelections = Record<
  string,
  { promotedStudentIds: string[]; skippedStudentIds: string[] }
>;

function actionBadgeCls(
  action: PromotionBatchPreview["students"][number]["action"],
): string {
  switch (action) {
    case "promote":
      return "bg-blue-100 text-blue-700";
    case "graduate":
      return "bg-green-100 text-green-700";
    case "unassigned":
      return "bg-amber-100 text-amber-700";
  }
}

export default function BatchPromotionWizardPage() {
  const { id: sourceSessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const appToast = useAppToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [targetSessionId, setTargetSessionId] = useState("");
  const [preview, setPreview] = useState<PromotionPreview | null>(null);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [batchSelections, setBatchSelections] = useState<BatchSelections>({});
  // CR Finding 6: countdown in seconds
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(0);

  // Countdown timer — resets whenever preview changes
  useEffect(() => {
    if (!preview) return;
    const computeRemaining = () =>
      Math.max(
        0,
        Math.floor(
          (new Date(preview.expiresAt).getTime() - Date.now()) / 1000,
        ),
      );
    setTimeRemainingSeconds(computeRemaining());
    const interval = setInterval(() => {
      setTimeRemainingSeconds(computeRemaining());
    }, 1000);
    return () => clearInterval(interval);
  }, [preview]);

  // Auto-reset at 0 — fires before user can click Confirm (CR Finding 6)
  useEffect(() => {
    if (timeRemainingSeconds <= 0 && step === 2 && preview !== null) {
      setStep(1);
      setPreview(null);
      setBatchSelections({});
    }
  }, [timeRemainingSeconds, step, preview]);

  // Navigation guard — beforeunload (CR-FE-039)
  useEffect(() => {
    if (step !== 2) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [step]);

  // Navigation guard — useBlocker (CR-FE-039)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      step === 2 &&
      preview !== null &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: QUERY_KEYS.sessionsList(),
    queryFn: () => academicSessionsApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const sessions: AcademicSession[] = sessionsData?.sessions ?? [];
  // Only UPCOMING sessions can be targets
  const targetOptions = sessions.filter(
    (s) => s.status === "UPCOMING" && s.id !== sourceSessionId,
  );

  // C-06fe: toggle a single student between promoted and skipped
  function toggleStudent(
    batchId: string,
    studentId: string,
    checked: boolean,
  ) {
    setBatchSelections((prev) => {
      const current = prev[batchId] ?? {
        promotedStudentIds: [],
        skippedStudentIds: [],
      };
      if (checked) {
        return {
          ...prev,
          [batchId]: {
            promotedStudentIds: [...current.promotedStudentIds, studentId],
            skippedStudentIds: current.skippedStudentIds.filter(
              (id) => id !== studentId,
            ),
          },
        };
      } else {
        return {
          ...prev,
          [batchId]: {
            promotedStudentIds: current.promotedStudentIds.filter(
              (id) => id !== studentId,
            ),
            skippedStudentIds: [...current.skippedStudentIds, studentId],
          },
        };
      }
    });
  }

  const previewMutation = useMutation({
    mutationFn: () =>
      academicSessionsApi.transitionPreview(sourceSessionId!, {
        // C-04fe: field name is toSessionId (not targetSessionId)
        toSessionId: targetSessionId,
      }),
    onSuccess: (data) => {
      // C-06fe: initialise selections — all students default to promoted
      const initialSelections: BatchSelections = {};
      data.batches.forEach((batch) => {
        initialSelections[batch.batchId] = {
          promotedStudentIds: batch.students.map((s) => s.studentId),
          skippedStudentIds: [],
        };
      });
      setBatchSelections(initialSelections);
      setPreview(data);
      setStep(2);
    },
    onError: (err) => appToast.mutationError(parseApiError(err).message),
  });

  const commitMutation = useMutation({
    mutationFn: () =>
      academicSessionsApi.transitionCommit(sourceSessionId!, {
        // C-06fe: use promotionPreviewId (not previewId); include per-batch arrays
        promotionPreviewId: preview!.promotionPreviewId,
        batches: Object.entries(batchSelections).map(([batchId, sel]) => ({
          batchId,
          promotedStudentIds: sel.promotedStudentIds,
          skippedStudentIds: sel.skippedStudentIds,
        })),
      }),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.sessions() });
      appToast.success(
        `Promoted ${data.promoted} students, graduated ${data.graduated}`,
      );
      navigate(`/admin/sessions/${sourceSessionId}`);
    },
    onError: (err) => {
      const { code, message } = parseApiError(err);
      if (code === "PREVIEW_EXPIRED") {
        appToast.mutationError(
          "Preview expired (10 min limit). Please generate a new preview.",
        );
        setStep(1);
        setPreview(null);
        setBatchSelections({});
      } else {
        appToast.mutationError(message);
      }
    },
  });

  const sourceSession = sessions.find((s) => s.id === sourceSessionId);

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      {/* Back nav */}
      <button
        onClick={() => navigate(`/admin/sessions/${sourceSessionId}`)}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to session
      </button>

      <div>
        <h1 className="text-xl font-semibold">Promote Students</h1>
        {sourceSession && (
          <p className="text-sm text-muted-foreground mt-0.5">
            From:{" "}
            <span className="font-medium text-foreground">
              {sourceSession.name}
            </span>
          </p>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span
          className={`font-medium ${step === 1 ? "text-primary" : "text-muted-foreground"}`}
        >
          1. Select target
        </span>
        <span className="text-muted-foreground">→</span>
        <span
          className={`font-medium ${step === 2 ? "text-primary" : "text-muted-foreground"}`}
        >
          2. Review & confirm
        </span>
      </div>

      {/* Step 1: Select target session */}
      {step === 1 && (
        <div className="border rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold">Select target session</h2>
          {sessionsLoading && (
            <p className="text-sm text-muted-foreground">Loading sessions…</p>
          )}
          {!sessionsLoading && targetOptions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No upcoming sessions available as targets. Create a new session
              first.
            </p>
          )}
          {!sessionsLoading && targetOptions.length > 0 && (
            <div className="space-y-2">
              {targetOptions.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    targetSessionId === s.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="targetSession"
                    value={s.id}
                    checked={targetSessionId === s.id}
                    onChange={() => setTargetSessionId(s.id)}
                    className="accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.startDate} – {s.endDate}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <button
              onClick={() => previewMutation.mutate()}
              disabled={!targetSessionId || previewMutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {previewMutation.isPending ? "Loading preview…" : "Preview"}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Review preview with per-student checkboxes */}
      {step === 2 && preview && (
        <div className="space-y-4">
          {/* CR Finding 6: urgency banner at 2 minutes */}
          {timeRemainingSeconds > 0 && timeRemainingSeconds <= 120 && (
            <div
              role="alert"
              className="rounded-lg border border-red-400 bg-red-50 px-4 py-3 text-sm text-red-800 font-medium"
            >
              Preview expires in {Math.ceil(timeRemainingSeconds / 60)} minute
              {Math.ceil(timeRemainingSeconds / 60) !== 1 ? "s" : ""} — confirm
              now or your selections will be lost.
            </div>
          )}

          {/* Countdown timer */}
          <div
            className="rounded-lg border p-4 bg-amber-50 border-amber-200 text-sm text-amber-800"
            aria-live={timeRemainingSeconds <= 300 ? "assertive" : "polite"}
            aria-atomic="true"
          >
            {timeRemainingSeconds > 0 ? (
              <>
                Preview expires at{" "}
                {new Date(preview.expiresAt).toLocaleTimeString()} —{" "}
                {Math.floor(timeRemainingSeconds / 60)}:
                {String(timeRemainingSeconds % 60).padStart(2, "0")} remaining.
              </>
            ) : (
              "Preview expired — redirecting…"
            )}
          </div>

          {preview.batches.map((batch) => {
            const sel = batchSelections[batch.batchId] ?? {
              promotedStudentIds: [],
              skippedStudentIds: [],
            };
            return (
              <div
                key={batch.batchId}
                className="border rounded-lg overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                  onClick={() =>
                    setExpandedBatch(
                      expandedBatch === batch.batchId ? null : batch.batchId,
                    )
                  }
                >
                  <span className="font-medium text-sm">{batch.batchName}</span>
                  <span className="text-xs text-muted-foreground">
                    {sel.promotedStudentIds.length}/{batch.students.length}{" "}
                    promoted {expandedBatch === batch.batchId ? "▲" : "▼"}
                  </span>
                </button>
                {expandedBatch === batch.batchId && (
                  <div className="border-t divide-y">
                    {batch.students.map((student) => {
                      const isPromoted = sel.promotedStudentIds.includes(
                        student.studentId,
                      );
                      return (
                        <label
                          key={student.studentId}
                          className="flex items-center gap-3 px-4 py-2 text-sm cursor-pointer hover:bg-muted/20"
                        >
                          {/* C-06fe: checkbox to include/exclude student from promotion */}
                          <input
                            type="checkbox"
                            checked={isPromoted}
                            onChange={(e) =>
                              toggleStudent(
                                batch.batchId,
                                student.studentId,
                                e.target.checked,
                              )
                            }
                            className="accent-primary h-4 w-4 shrink-0"
                          />
                          <div className="flex-1">
                            <p className="font-medium">{student.studentName}</p>
                            <p className="text-xs text-muted-foreground">
                              {student.currentClassName ?? "—"} →{" "}
                              {student.targetClassName ?? "—"}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${actionBadgeCls(student.action)}`}
                          >
                            {student.action}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => {
                setStep(1);
                setPreview(null);
                setBatchSelections({});
              }}
              className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => commitMutation.mutate()}
              disabled={commitMutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {commitMutation.isPending ? "Committing…" : "Confirm & Promote"}
            </button>
          </div>
        </div>
      )}

      {/* CR-FE-039: navigation blocker dialog */}
      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="Leave promotion wizard?"
        description="Your batch selections will be lost."
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </div>
  );
}
