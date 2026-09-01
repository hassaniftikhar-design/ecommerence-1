import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce any value by a specified delay in milliseconds.
 * Useful for debouncing search inputs so API/filter requests only trigger
 * after the user stops typing.
 */
export function useDebounce<T>(value: T, delay: number = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
