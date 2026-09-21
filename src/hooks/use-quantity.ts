'use client';

import { useState, useCallback } from 'react';

export function useQuantity(initialValue: number, min = 1, max = 99) {
  const [quantity, setQuantity] = useState(
    Math.min(Math.max(initialValue, min), max)
  );

  const increment = useCallback(
    () => setQuantity((q) => Math.min(q + 1, max)),
    [max]
  );

  const decrement = useCallback(
    () => setQuantity((q) => Math.max(q - 1, min)),
    [min]
  );

  return { quantity, increment, decrement };
}
