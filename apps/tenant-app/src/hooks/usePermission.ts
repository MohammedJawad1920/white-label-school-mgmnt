/**
 * usePermission — checks whether the user's active role matches a required role.
 *
 * Freeze §5.6 HK inventory: prevents inline `activeRole === 'Admin'` checks.
 */
import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@/config/nav";

export function usePermission(requiredRole: Role): boolean {
  const { activeRole } = useAuth();
  return activeRole === requiredRole;
}
