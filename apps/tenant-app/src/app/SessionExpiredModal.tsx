import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * WHY a blocking overlay (not a toast):
 * Any click after 401 would 401 again. A modal prevents further interaction
 * until the user re-authenticates. autoFocus ensures keyboard users don't
 * need to tab to the button.
 */
export function SessionExpiredModal() {
  const { isExpired, dismissExpired } = useAuth();
  const navigate = useNavigate();

  if (!isExpired) return null;

  function handleLogin() {
    dismissExpired();
    navigate("/login", { replace: true });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
    >
      <div className="bg-background rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 border">
        <h2 id="session-expired-title" className="text-lg font-semibold mb-2">
          Session Expired
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Your session has expired. Please log in again to continue.
        </p>
        <button
          onClick={handleLogin}
          autoFocus
          className="w-full bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Log in
        </button>
      </div>
    </div>
  );
}
