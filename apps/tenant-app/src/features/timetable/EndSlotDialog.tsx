/**
 * DeleteSlotDialog — CR-31 replacement for EndSlotDialog.
 *
 * DELETE /timetable/:id
 * On 204: invalidate ['timetable'] + close
 * On 404: show inline error "Slot not found."
 * On 403: show inline error "Not authorized."
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { timetableApi } from "@/api/timetable";
import { parseApiError } from "@/utils/errors";
import type { TimeSlot } from "@/types/api";

interface DeleteSlotDialogProps {
  slot: TimeSlot | null;
  onClose: () => void;
}

export function DeleteSlotDialog({ slot, onClose }: DeleteSlotDialogProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => timetableApi.deleteSlot(slot!.id),
    onSuccess: async () => {
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-slot-title"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-background rounded-lg shadow-xl w-full max-w-sm border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="delete-slot-title" className="text-base font-semibold">
            Delete Slot
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
          <div className="rounded-md bg-muted px-3 py-2.5 text-sm">
            <p className="font-medium">
              {slot.className} · {slot.subjectName}
            </p>
            <p className="text-muted-foreground text-xs mt-0.5">
              {slot.dayOfWeek} · Period {slot.periodNumber}
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            This slot will be permanently removed from the timetable. This
            action cannot be undone.
          </p>

          {error && (
            <p role="alert" className="text-xs text-destructive">
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
            disabled={mutation.isPending}
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
                Deleting…
              </>
            ) : (
              "Delete Slot"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
