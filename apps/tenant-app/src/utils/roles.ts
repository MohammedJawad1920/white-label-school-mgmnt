import type { TenantUser, UserRole } from "@/types/api";

export const hasRole = (u: TenantUser | null, role: UserRole) =>
  u?.roles.includes(role) ?? false;
export const isAdmin = (u: TenantUser | null) => hasRole(u, "Admin");
export const isTeacher = (u: TenantUser | null) => hasRole(u, "Teacher");
export const isStudent = (u: TenantUser | null) => hasRole(u, "Student");
export const isMultiRole = (u: TenantUser | null) => (u?.roles.length ?? 0) > 1;
