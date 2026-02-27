import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

interface RoleGateProps {
  roles: Array<"Teacher" | "Admin">;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * WHY inline "Not authorized" (not redirect):
 * Freeze §2: role-unauthorized users see an inline message.
 * Redirecting would break browser history for multi-role users.
 *
 * WHY check roles[] array (not activeRole):
 * activeRole is a UI hint only. A Teacher/Admin with activeRole=Teacher
 * can still access Admin routes — backend enforces real access control.
 */
export function RoleGate({ roles, children, fallback }: RoleGateProps) {
  const { user } = useAuth();
  const authorized = user !== null && roles.some((r) => user.roles.includes(r));

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
                Not authorized
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                You don't have permission to access this page.
              </p>
            </div>
          </div>
        )}
      </>
    );
  }
  return <>{children}</>;
}
