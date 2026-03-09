import { toast } from "sonner";

/**
 * SP7 — useAppToast
 * Wraps Sonner toast. Exposes ONLY success(message) and mutationError(message).
 *
 * Toast rules (Freeze §5.5 SP7):
 *   - Toasts for mutation feedback ONLY (create/update/delete success, mutation errors).
 *   - NEVER for fetch/GET errors — use InlineError (SP4) or screen error state instead.
 *   - Raw toast() calls outside useAppToast are a freeze violation.
 */
export function useAppToast() {
  return {
    success: (message: string) => {
      toast.success(message);
    },
    mutationError: (message: string) => {
      toast.error(message);
    },
  };
}
