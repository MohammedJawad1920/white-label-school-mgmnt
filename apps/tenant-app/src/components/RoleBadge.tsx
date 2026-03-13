import type { UserRole } from "@/types/api";
import { cn } from "@/utils/cn";

interface RoleBadgeProps {
  role: UserRole | "SuperAdmin";
}

const roleStyle: Record<UserRole | "SuperAdmin", string> = {
  Teacher: "bg-blue-100 text-blue-800",
  Admin: "bg-purple-100 text-purple-800",
  Student: "bg-green-100 text-green-800",
  Guardian: "bg-teal-100 text-teal-800", // v5.0
  SuperAdmin: "bg-red-100 text-red-800",
};

/**
 * SP8 — RoleBadge
 * Badge with role → color mapping from Freeze §5 Role Badge Color Mapping.
 * Freeze §5.5 SP8.
 */
export function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        roleStyle[role],
      )}
    >
      {role}
    </span>
  );
}
