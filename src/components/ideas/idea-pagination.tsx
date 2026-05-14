"use client";

import { Button } from "@/components/ui/button";
import { useListingQuery } from "@/lib/hooks/use-listing-query";
import type { ListingPageSize } from "@/lib/validation/idea";

const PAGE_SIZE_CHOICES: readonly ListingPageSize[] = [20, 50, 100];

/**
 * Pagination + page-size picker for the unified listing pages. Reads
 * the current `page` / `pageSize` from the URL via
 * {@link useListingQuery} and writes any change straight back.
 */
export function IdeaPagination({
  page,
  pageSize,
  totalPages,
  total,
}: {
  page: number;
  pageSize: ListingPageSize;
  totalPages: number;
  total: number;
}): JSX.Element {
  const { update } = useListingQuery();
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {total === 0
          ? "No results"
          : `Showing ${start}–${end} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Per page
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={pageSize}
            onChange={(e) =>
              update({ pageSize: Number(e.target.value) as ListingPageSize, page: 1 })
            }
          >
            {PAGE_SIZE_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => update({ page: page - 1 })}
        >
          Previous
        </Button>
        <span className="text-xs tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => update({ page: page + 1 })}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
