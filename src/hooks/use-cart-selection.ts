"use client";

import { useCallback, useMemo } from "react";

export function useCartSelection(
  itemIds: string[],
  selectedIds: string[],
  onSelectionChange?: (selectedIds: string[]) => void
) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const allSelected =
    itemIds.length > 0 && itemIds.every((id) => selectedSet.has(id));
  const someSelected = selectedSet.size > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      onSelectionChange?.([]);
    } else {
      onSelectionChange?.([...itemIds]);
    }
  }, [allSelected, itemIds, onSelectionChange]);

  const toggleOne = useCallback(
    (id: string) => {
      if (selectedSet.has(id)) {
        onSelectionChange?.(selectedIds.filter((i) => i !== id));
      } else {
        onSelectionChange?.([...selectedIds, id]);
      }
    },
    [selectedSet, selectedIds, onSelectionChange]
  );

  const isSelected = useCallback(
    (id: string) => selectedSet.has(id),
    [selectedSet]
  );

  return useMemo(
    () => ({
      allSelected,
      someSelected,
      toggleAll,
      toggleOne,
      isSelected,
    }),
    [allSelected, someSelected, toggleAll, toggleOne, isSelected]
  );
}
