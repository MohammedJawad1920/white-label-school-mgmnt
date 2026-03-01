/**
 * EndSlotDialog — Freeze §Screen: Timetable, "End Assignment" action.
 *
 * PUT /timetable/:id/end  → body: { effectiveTo: 'YYYY-MM-DD' }
 * On 200: invalidate ['timetable'] + toast success
 * On 404: toast "Slot not found."
 * On 403: toast "Not authorized."
 *
 * WHY separate dialog (not inline): Ending a slot is destructive and
 * irreversible. A confirmation step with date input prevents accidents.
 *
 * WHY invalidate ['timetable'] (all filters):
 * Freeze §3 caching rules: PUT /timetable/:id/end invalidates ['timetable'].
 * Using queryClient.invalidateQueries({ queryKey: ['timetable'] }) removes
 * ALL timetable cache entries (across any filter combo) so the grid always
 * reflects the ended slot immediately.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { timetableApi } from "@/api/timetable";
import { parseApiError } from "@/utils/errors";
import { todayISO } from "@/utils/dates";
import type { TimeSlot } from "@/types/api";

interface EndSlotDialogProps {
  slot: TimeSlot | null;
  onClose: () => void;
}

export function EndSlotDialog({ slot, onClose }: EndSlotDialogProps) {
  const queryClient = useQueryClient();
  const [effectiveTo, setEffectiveTo] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => timetableApi.end(slot!.id, { effectiveTo }),
    onSuccess: async () => {
      // Freeze §3: invalidate ALL timetable queries
      await queryClient.invalidateQueries({ queryKey: ["timetable"] });
      onClose();
    },
    onError: (err) => {
      const { code, message } = parseApiError(err);
      if (code === "NOT_FOUND") setError("Slot not found.");
      else if (code === "FORBIDDEN") setError("Not authorized.");
      else setError(message);
    },
  });

  if (!slot) return null;

  function handleConfirm() {
    setError(null);
    mutation.mutate();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-slot-title"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-background rounded-lg shadow-xl w-full max-w-sm border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="end-slot-title" className="text-base font-semibold">
            End Assignment
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Slot info summary */}
          <div className="rounded-md bg-muted px-3 py-2.5 text-sm">
            <p className="font-medium">
              {slot.className} · {slot.subjectName}
            </p>
            <p className="text-muted-foreground text-xs mt-0.5">
              {slot.dayOfWeek} · Period {slot.periodNumber}
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            Choose the last date this assignment is active. The slot will no
            longer appear after this date.
          </p>

          {/* Effective-to date */}
          <div>
            <label
              htmlFor="effectiveTo"
              className="block text-sm font-medium mb-1.5"
            >
              Last active date
            </label>
            <input
              id="effectiveTo"
              type="date"
              value={effectiveTo}
              min={todayISO()}
              onChange={(e) => setEffectiveTo(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-describedby={error ? "end-slot-error" : undefined}
            />
          </div>

          {/* Error */}
          {error && (
            <p
              id="end-slot-error"
              role="alert"
              className="text-xs text-destructive"
            >
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={mutation.isPending || !effectiveTo}
            className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {mutation.isPending ? (
              <>
                <svg
                  className="h-3.5 w-3.5 animate-spin"
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
                Ending…
              </>
            ) : (
              "End Assignment"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
