"use client";

import { useCallback, useMemo, useState } from "react";

// Lifts "which rows are checked" out of CartTable into a hook so the
// select-all checkbox and each row's checkbox can share one source of
// truth without prop-drilling setState callbacks through JSX by hand.
// No bulk action exists yet (Phase 1 is UI-only), but the selection
// state itself is real, not mocked -- it's what a future "delete
// selected" button would read.
export function useCartSelection(itemIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const allSelected =
    itemIds.length > 0 && itemIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    setSelectedIds(allSelected ? new Set() : new Set(itemIds));
  }, [allSelected, itemIds]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  return useMemo(
    () => ({ allSelected, someSelected, toggleAll, toggleOne, isSelected }),
    [allSelected, someSelected, toggleAll, toggleOne, isSelected],
  );
}
