import { useQuery } from "@tanstack/react-query";
import { featuresApi } from "@/api/features";
import type { FeatureKey } from "@/types/api";
import { QUERY_KEYS } from "@/utils/queryKeys";

export function useFeatureFlag(key: FeatureKey): boolean | undefined {
  const { data } = useQuery({
    queryKey: QUERY_KEYS.features(),
    queryFn: () => featuresApi.list(),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
  return data?.features.find((f) => f.key === key)?.enabled;
}
