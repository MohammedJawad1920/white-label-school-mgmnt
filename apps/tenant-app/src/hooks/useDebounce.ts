/**
 * useDebounce — debounces a value by the given delay in milliseconds.
 *
 * Freeze §5.6 HK inventory: used in User Management and Student Management
 * search fields to prevent per-keystroke API requests.
 */
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
