/**
 * RoleSwitcher — FE-005: dropdown supporting all roles.
 *
 * Freeze rules (FE-005):
 * - Only shown when user.roles.length > 1
 * - Calls POST /auth/switch-role → receives new JWT
 * - AuthContext.switchRole() atomically replaces token + user in state + localStorage
 * - NO page reload — role-gated components re-render immediately
 * - Renders available roles as dropdown items; active role shows checkmark
 * - Loading state: dropdown items disabled, spinner on trigger button
 * - Error state: inline message "Failed to switch role. Please try again."
 *
 * WHY custom dropdown (no @radix-ui/react-dropdown-menu installed):
 * Implemented with useState + click-outside ref to stay dependency-free.
 */
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { isMultiRole } from "@/utils/roles";
import type { UserRole } from "@/types/api";

interface RoleSwitcherProps {
  /** compact = sidebar button; full = header dropdown */
  variant?: "compact" | "full";
}

export function RoleSwitcher({ variant = "compact" }: RoleSwitcherProps) {
  const { user, switchRole } = useAuth();
  const [switching, setSwitching] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  if (!user || !isMultiRole(user)) return null;

  const isLoading = switching !== null;

  async function handleSwitch(role: UserRole) {
    if (role === user!.activeRole || isLoading) return;
    setSwitching(role);
    setError(null);
    setOpen(false);
    try {
      await switchRole({ role });
    } catch {
      setError("Failed to switch role. Please try again.");
    } finally {
      setSwitching(null);
    }
  }

  // ── Dropdown items ─────────────────────────────────────────────────────────
  const dropdownItems = (
    <div
      role="listbox"
      aria-label="Switch role"
      className="absolute z-50 rounded-md border bg-background shadow-lg py-1 min-w-[8rem]"
    >
      {user.roles.map((role) => {
        const isActive = role === user.activeRole;
        return (
          <button
            key={role}
            role="option"
            aria-selected={isActive}
            disabled={isLoading}
            onClick={() => handleSwitch(role)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:bg-muted"
          >
            {isActive ? (
              <svg
                className="h-3.5 w-3.5 text-primary shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <span className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span className={isActive ? "font-medium" : ""}>{role}</span>
          </button>
        );
      })}
    </div>
  );

  const spinnerSvg = (
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
  );

  const chevronSvg = (
    <svg
      className="h-3 w-3 text-muted-foreground ml-auto"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );

  if (variant === "full") {
    return (
      <div ref={containerRef} className="relative">
        <button
          onClick={() => setOpen((p) => !p)}
          disabled={isLoading}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm border hover:bg-muted transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isLoading ? spinnerSvg : null}
          <span>{user.activeRole}</span>
          {chevronSvg}
        </button>
        {open && (
          <div className="absolute right-0 mt-1 w-44">{dropdownItems}</div>
        )}
        {error && (
          <p role="alert" className="text-xs text-destructive mt-1">
            {error}
          </p>
        )}
      </div>
    );
  }

  // compact variant — used in sidebar
  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <button
        onClick={() => setOpen((p) => !p)}
        disabled={isLoading}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch active role"
        title="Switch role"
        className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isLoading ? spinnerSvg : null}
        <span>{user.activeRole}</span>
        {chevronSvg}
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 w-full">
          {dropdownItems}
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
