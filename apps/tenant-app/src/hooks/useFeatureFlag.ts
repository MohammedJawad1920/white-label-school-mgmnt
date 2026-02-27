import { useQuery } from "@tanstack/react-query";
import { featuresApi } from "@/api/features";
import type { FeatureKey } from "@/types/api";

export function useFeatureFlag(key: FeatureKey): boolean | undefined {
  const { data } = useQuery({
    queryKey: ["features"],
    queryFn: () => featuresApi.list(),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
  return data?.features.find((f) => f.key === key)?.enabled;
}
