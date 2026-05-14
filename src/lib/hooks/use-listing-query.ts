"use client";

import { useCallback, useMemo, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { ListingPageSize, ListingQuery } from "@/lib/validation/idea";

/** UI-side mirror of {@link ListingQuery} — strings only, no scope. */
export interface ListingQueryState {
  q: string;
  categoryId: string | null;
  status: string[];
  from: string | null;
  to: string | null;
  page: number;
  pageSize: ListingPageSize;
}

const DEFAULTS: ListingQueryState = {
  q: "",
  categoryId: null,
  status: [],
  from: null,
  to: null,
  page: 1,
  pageSize: 20,
};

function readState(params: URLSearchParams): ListingQueryState {
  const pageSizeRaw = Number(params.get("pageSize"));
  const allowed: readonly number[] = [20, 50, 100];
  const pageSize = (allowed.includes(pageSizeRaw) ? pageSizeRaw : 20) as ListingPageSize;
  return {
    q: params.get("q") ?? "",
    categoryId: params.get("categoryId"),
    status: params.getAll("status").filter(Boolean),
    from: params.get("from"),
    to: params.get("to"),
    page: Math.max(1, Number(params.get("page")) || 1),
    pageSize,
  };
}

function writeState(state: ListingQueryState): URLSearchParams {
  const sp = new URLSearchParams();
  if (state.q) sp.set("q", state.q);
  if (state.categoryId) sp.set("categoryId", state.categoryId);
  for (const s of state.status) sp.append("status", s);
  if (state.from) sp.set("from", state.from);
  if (state.to) sp.set("to", state.to);
  if (state.page > 1) sp.set("page", String(state.page));
  if (state.pageSize !== DEFAULTS.pageSize) sp.set("pageSize", String(state.pageSize));
  return sp;
}

/**
 * Client hook that mirrors the listing query into the URL. Any
 * change resets `page` to 1 unless the change *is* a page update.
 *
 * Uses {@link useTransition} so navigation feels instant while the
 * RSC re-renders.
 */
export function useListingQuery(): {
  state: ListingQueryState;
  isPending: boolean;
  update: (patch: Partial<ListingQueryState>) => void;
  reset: () => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const state = useMemo(() => readState(new URLSearchParams(params.toString())), [params]);

  const update = useCallback(
    (patch: Partial<ListingQueryState>) => {
      const isPaging = "page" in patch || "pageSize" in patch;
      const next: ListingQueryState = {
        ...state,
        ...patch,
        page: isPaging ? (patch.page ?? state.page) : 1,
      };
      const qs = writeState(next).toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, state],
  );

  const reset = useCallback(() => {
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }, [pathname, router]);

  return { state, isPending, update, reset };
}
