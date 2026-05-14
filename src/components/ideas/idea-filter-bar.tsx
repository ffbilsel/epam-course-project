"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { IDEA_STATUS_VALUES, type IdeaStatusValue } from "@/lib/validation/idea";
import { useListingQuery } from "@/lib/hooks/use-listing-query";

interface CategoryOption {
  id: string;
  name: string;
}

/**
 * Listing filter bar — search box (debounced), category select,
 * status checkboxes, and a from/to date range. All edits write
 * straight into the URL via {@link useListingQuery}, which the
 * parent RSC re-renders from.
 *
 * `availableStatuses` lets a caller restrict the status pills to a
 * subset of {@link IDEA_STATUS_VALUES} (FR-038 — the Reviewer
 * queue only allows SUBMITTED + UNDER_REVIEW). An empty selection
 * always means "no status filter", never "no results".
 */
export function IdeaFilterBar({
  categories,
  showStatuses = true,
  availableStatuses = IDEA_STATUS_VALUES,
}: {
  categories: CategoryOption[];
  showStatuses?: boolean;
  availableStatuses?: ReadonlyArray<IdeaStatusValue>;
}): JSX.Element {
  const { state, update, reset } = useListingQuery();
  const [localQ, setLocalQ] = useState(state.q);

  // Debounce the free-text search to avoid a network round-trip on
  // every keystroke.
  useEffect(() => {
    if (localQ === state.q) return;
    const handle = setTimeout(() => {
      update({ q: localQ });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localQ]);

  useEffect(() => {
    // Keep local input in sync if state changes from elsewhere
    // (e.g. clicking Reset).
    setLocalQ(state.q);
  }, [state.q]);

  function toggleStatus(s: string): void {
    const has = state.status.includes(s);
    update({
      status: has ? state.status.filter((x) => x !== s) : [...state.status, s],
    });
  }

  return (
    <div className="mb-6 space-y-4 rounded-md border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="filter-q">Search</Label>
          <Input
            id="filter-q"
            type="search"
            placeholder="Title or description"
            value={localQ}
            maxLength={200}
            onChange={(e) => setLocalQ(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="filter-category">Category</Label>
          <select
            id="filter-category"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={state.categoryId ?? ""}
            onChange={(e) => update({ categoryId: e.target.value || null })}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="filter-from">From</Label>
          <Input
            id="filter-from"
            type="date"
            value={state.from ?? ""}
            onChange={(e) => update({ from: e.target.value || null })}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="filter-to">To</Label>
          <Input
            id="filter-to"
            type="date"
            value={state.to ?? ""}
            onChange={(e) => update({ to: e.target.value || null })}
          />
        </div>
      </div>

      {showStatuses && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Status</legend>
          <div className="flex flex-wrap gap-2">
            {availableStatuses.map((s) => {
              const active = state.status.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  aria-pressed={active}
                  className={
                    "rounded-full border px-3 py-1 text-xs " +
                    (active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background text-muted-foreground hover:bg-accent")
                  }
                >
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex items-center justify-end">
        <Button variant="ghost" size="sm" type="button" onClick={reset}>
          Clear all filters
        </Button>
      </div>
    </div>
  );
}
