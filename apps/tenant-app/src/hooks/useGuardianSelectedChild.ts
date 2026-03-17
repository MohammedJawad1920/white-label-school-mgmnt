import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGuardianStore } from "../stores/guardian.store";
import { guardianPortalApi } from "../api/guardian-portal.api";
import { QUERY_KEYS } from "../utils/queryKeys";
import type { GuardianChild } from "../types/api";

export function useGuardianSelectedChild(): {
  selectedChildId: string | null;
  selectedChild: GuardianChild | null;
  children: GuardianChild[];
  setSelectedChild: (id: string) => void;
} {
  const { selectedChildId, setSelectedChild } = useGuardianStore();

  const { data } = useQuery({
    queryKey: QUERY_KEYS.guardianPortal.children(),
    queryFn: () => guardianPortalApi.listChildren(),
    staleTime: 5 * 60 * 1000,
  });

  const children = data?.children ?? [];

  // Auto-select first child if none selected
  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      setSelectedChild(children[0]!.studentId);
    }
  }, [selectedChildId, children, setSelectedChild]);

  const selectedChild =
    children.find((c: GuardianChild) => c.studentId === selectedChildId) ??
    null;

  return { selectedChildId, selectedChild, children, setSelectedChild };
}
