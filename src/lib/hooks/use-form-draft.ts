"use client";
import { useEffect, useRef } from "react";

/**
 * Persists the given form values to `sessionStorage` under `key` and
 * restores them on mount (FR-026). Caller is responsible for calling
 * `clear` after a successful submit.
 */
export function useFormDraft<T extends Record<string, unknown>>(
  key: string,
  values: T,
  setValues: (next: T) => void,
): { clear: () => void } {
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        setValues(parsed);
      }
    } catch {
      // ignore corrupt drafts
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(values));
    } catch {
      // quota exceeded — ignore
    }
  }, [key, values]);

  return {
    clear: () => {
      if (typeof window === "undefined") return;
      window.sessionStorage.removeItem(key);
    },
  };
}
