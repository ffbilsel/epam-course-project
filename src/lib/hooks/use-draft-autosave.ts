"use client";

import { useEffect, useRef, useState } from "react";

interface AutosaveOptions<T> {
  draftId: string | null;
  values: T;
  debounceMs?: number;
  enabled?: boolean;
}

type Status = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave hook (FR-002). Calls
 * `PUT /api/drafts/:id` (or `POST /api/drafts` on first save) when
 * `values` changes, after a `debounceMs` quiet window. Last-write-
 * wins; tracks a tiny `status` string for the "Saved · just now"
 * affordance.
 */
export function useDraftAutosave<T extends object>(opts: AutosaveOptions<T>): {
  status: Status;
  lastSavedAt: number | null;
  draftId: string | null;
} {
  const { values, debounceMs = 300, enabled = true } = opts;
  const [draftId, setDraftId] = useState<string | null>(opts.draftId);
  const [status, setStatus] = useState<Status>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void (async () => {
        if (inFlightRef.current) inFlightRef.current.abort();
        const ac = new AbortController();
        inFlightRef.current = ac;
        setStatus("saving");
        try {
          const url = draftId ? `/api/drafts/${draftId}` : "/api/drafts";
          const method = draftId ? "PUT" : "POST";
          const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(values),
            signal: ac.signal,
          });
          if (!res.ok) throw new Error(`${res.status}`);
          const json = (await res.json()) as { id: string };
          if (!draftId) setDraftId(json.id);
          setStatus("saved");
          setLastSavedAt(Date.now());
        } catch (err) {
          if ((err as { name?: string })?.name === "AbortError") return;
          setStatus("error");
        }
      })();
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values), draftId, enabled, debounceMs]);

  return { status, lastSavedAt, draftId };
}
