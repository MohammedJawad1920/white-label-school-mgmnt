/**
 * RoleSwitcher — Freeze §User Story 9: switch active role in-session.
 *
 * Freeze rules:
 * - Only shown when user.roles.length > 1
 * - Calls POST /auth/switch-role → receives new JWT
 * - AuthContext.switchRole() atomically replaces token + user in state + localStorage
 * - NO page reload — role-gated components re-render immediately
 *
 * WHY this is a component (not inline in Layout):
 * It needs access to useAuth + its own loading state. Keeping it isolated
 * means Layout doesn't grow complex — just renders <RoleSwitcher />.
 */
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { isMultiRole } from "@/utils/roles";
import { getErrorMessage } from "@/utils/errors";

interface RoleSwitcherProps {
  /** compact = icon+text in sidebar; full = dropdown style in header */
  variant?: "compact" | "full";
}

export function RoleSwitcher({ variant = "compact" }: RoleSwitcherProps) {
  const { user, switchRole } = useAuth();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only render if the user has multiple roles
  if (!user || !isMultiRole(user)) return null;

  const nextRole = user.activeRole === "Admin" ? "Teacher" : "Admin";

  async function handleSwitch() {
    setSwitching(true);
    setError(null);
    try {
      await switchRole({ role: nextRole });
      // No navigation needed — AuthContext re-renders everything
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSwitching(false);
    }
  }

  if (variant === "full") {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted text-sm">
          <span className="text-muted-foreground">Active role:</span>
          <span className="font-medium">{user.activeRole}</span>
        </div>
        <button
          onClick={handleSwitch}
          disabled={switching}
          aria-label={`Switch to ${nextRole} role`}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          {switching ? (
            <svg
              className="h-4 w-4 animate-spin"
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
          ) : (
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
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          )}
          Switch to {nextRole}
        </button>
        {error && (
          <p role="alert" className="text-xs text-destructive px-3">
            {error}
          </p>
        )}
      </div>
    );
  }

  // compact variant — single icon button for sidebar
  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleSwitch}
        disabled={switching}
        aria-label={`Switch to ${nextRole} role`}
        title={`Switch to ${nextRole}`}
        className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
      >
        {switching ? (
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
        ) : (
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
        )}
        {user.activeRole} → {nextRole}
      </button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
