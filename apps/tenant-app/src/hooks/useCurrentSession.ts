import { useQuery } from "@tanstack/react-query";
import { useSessionStore } from "../stores/sessionStore";
import { academicSessionsApi } from "../api/academicSessions";
import { QUERY_KEYS } from "../utils/queryKeys";
import type { AcademicSession } from "../types/api";

export function useCurrentSession(): AcademicSession | null {
  const currentSession = useSessionStore((s) => s.currentSession);

  const { data } = useQuery({
    queryKey: QUERY_KEYS.sessionCurrent(),
    queryFn: () => academicSessionsApi.getCurrent(),
    enabled: currentSession === null,
    staleTime: 5 * 60 * 1000,
  });

  return currentSession ?? data ?? null;
}
