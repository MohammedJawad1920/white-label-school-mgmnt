import { useAuth } from "./useAuth";

export function useIsClassTeacher(): boolean {
  const { user } = useAuth();
  return user?.activeRole === "Teacher" && user?.classTeacherOf !== null;
}
