/**
 * useAppToast — toast entry point for superadmin-app (CR-FE-030)
 *
 * Direct `import { toast } from 'sonner'` in src/features/** or
 * src/components/** is FORBIDDEN. Use this hook exclusively so
 * the project can swap or wrap the toast library in one place.
 */
import { toast } from "sonner";

export function useAppToast() {
  return {
    success: (message: string) => {
      toast.success(message);
    },
    error: (message: string) => {
      toast.error(message);
    },
  };
}
