"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { RatingDimension, RatingRow } from "@/server/rating-service";

interface Props {
  ideaId: string;
  evaluatorId: string;
  dimensions: RatingDimension[];
  myScores: Map<string, number | null>;
  locked: boolean;
}

/**
 * Per-dimension 1–5 rating panel for the caller (Reviewer/Admin).
 * Explicit "unrated" state ("—") for required dimensions surfaces
 * `RATING_REQUIRED_MISSING` from the server when a decision is
 * attempted with a blank required score.
 */
export function RatingPanel({ ideaId, dimensions, myScores, locked }: Props): JSX.Element {
  const router = useRouter();
  const [scores, setScores] = useState<Map<string, number | null>>(myScores);
  const [pending, startTransition] = useTransition();

  function setScore(dimId: string, value: number | null): void {
    const next = new Map(scores);
    next.set(dimId, value);
    setScores(next);
  }

  function save(): void {
    const body = {
      scores: Array.from(scores.entries()).map(([dimensionId, score]) => ({ dimensionId, score })),
    };
    startTransition(async () => {
      const res = await fetch(`/api/ideas/${ideaId}/ratings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        toast.error(j.error?.message ?? "Could not save ratings");
        return;
      }
      toast.success("Ratings saved");
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card/60 p-4">
      <h3 className="mb-3 text-base font-semibold">Rating</h3>
      <div className="space-y-4">
        {dimensions.map((d) => {
          const current = scores.get(d.id) ?? null;
          return (
            <div key={d.id} className="space-y-1">
              <Label className="flex items-center gap-2">
                {d.label}
                {d.required ? <span className="text-xs text-destructive">(required)</span> : null}
              </Label>
              {d.description ? (
                <p className="text-xs text-muted-foreground">{d.description}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={current === null ? "default" : "outline"}
                  disabled={locked}
                  onClick={() => setScore(d.id, null)}
                >
                  —
                </Button>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="sm"
                    variant={current === n ? "default" : "outline"}
                    disabled={locked}
                    onClick={() => setScore(d.id, n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="button" onClick={save} disabled={locked || pending}>
          {pending ? "Saving…" : "Save scores"}
        </Button>
        {locked ? (
          <span className="text-xs text-muted-foreground">Locked after decision.</span>
        ) : null}
      </div>
    </div>
  );
}

/** Aggregate, read-only summary used post-decision. */
export function RatingSummary({
  dimensions,
  rows,
}: {
  dimensions: RatingDimension[];
  rows: RatingRow[];
}): JSX.Element {
  const avg = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    if (r.score === null) continue;
    const cur = avg.get(r.dimensionId) ?? { sum: 0, count: 0 };
    cur.sum += r.score;
    cur.count += 1;
    avg.set(r.dimensionId, cur);
  }
  return (
    <div className="rounded-lg border border-border bg-card/40 p-4">
      <h3 className="mb-3 text-base font-semibold">Rating summary</h3>
      <ul className="space-y-1 text-sm">
        {dimensions.map((d) => {
          const a = avg.get(d.id);
          const display = a && a.count ? (a.sum / a.count).toFixed(2) : "—";
          return (
            <li key={d.id} className="flex justify-between">
              <span>{d.label}</span>
              <span className="font-mono">
                {display}{" "}
                <span className="text-xs text-muted-foreground">({a?.count ?? 0} reviewers)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
