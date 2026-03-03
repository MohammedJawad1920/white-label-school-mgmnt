import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types/api";

interface RoleGateProps {
  roles: Array<UserRole>;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * WHY check activeRole (not roles[] array) — FE-006:
 * Sidebar visibility and page access should gate on the role the user is
 * currently acting as, not merely whether they hold the role at all.
 * Backend enforces real access control; we gate UI by active context.
 */
export function RoleGate({ roles, children, fallback }: RoleGateProps) {
  const { user } = useAuth();
  const authorized = user !== null && roles.some((r) => user.activeRole === r);

  if (!authorized) {
    return (
      <>
        {fallback ?? (
          <div
            className="flex items-center justify-center h-full p-8 text-center"
            role="alert"
          >
            <div>
              <p className="text-lg font-semibold text-muted-foreground">
                Not authorized for current role
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Switch to Admin to access this page.
              </p>
            </div>
          </div>
        )}
      </>
    );
  }
  return <>{children}</>;
}
