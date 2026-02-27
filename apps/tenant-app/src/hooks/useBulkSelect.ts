import { useState, useCallback } from "react";

export function useBulkSelect<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === items.length ? new Set() : new Set(items.map((i) => i.id)),
    );
  }, [items]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  return {
    selectedIds,
    selectedIdsArray: Array.from(selectedIds),
    selectedCount: selectedIds.size,
    isAllSelected: items.length > 0 && selectedIds.size === items.length,
    isSomeSelected: selectedIds.size > 0 && selectedIds.size < items.length,
    toggleOne,
    toggleAll,
    clearSelection,
  };
}
