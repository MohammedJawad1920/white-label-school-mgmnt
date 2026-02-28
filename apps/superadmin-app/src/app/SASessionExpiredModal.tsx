import { useNavigate } from "react-router-dom";
import { useSAAuth } from "@/features/auth/SAAuthContext";

export function SASessionExpiredModal() {
  const { isExpired, dismissExpired } = useSAAuth();
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
      aria-labelledby="sa-session-expired-title"
    >
      <div className="bg-background rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 border">
        <h2
          id="sa-session-expired-title"
          className="text-lg font-semibold mb-2"
        >
          Session Expired
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Your admin session has expired. Please log in again.
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
