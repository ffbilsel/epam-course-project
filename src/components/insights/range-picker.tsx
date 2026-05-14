"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  INSIGHTS_BUCKETS,
  INSIGHTS_PRESETS,
  type InsightsBucket,
  type InsightsPreset,
} from "@/lib/validation/insights";

interface RangePickerState {
  preset: InsightsPreset;
  bucket: InsightsBucket;
  from: string;
  to: string;
}

const PRESET_LABELS: Record<InsightsPreset, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  quarter: "This quarter",
  year: "This year",
  custom: "Custom range",
};

/**
 * URL-bound range + bucket picker for the Insights page. Pushes
 * changes through the Next router so RSCs can re-fetch in parallel.
 */
export function RangePicker(): JSX.Element {
  const router = useRouter();
  const sp = useSearchParams();
  const [state, setState] = useState<RangePickerState>(() => fromParams(sp));

  useEffect(() => {
    setState(fromParams(sp));
  }, [sp]);

  const submit = useCallback(
    (next: RangePickerState) => {
      const params = new URLSearchParams();
      params.set("preset", next.preset);
      params.set("bucket", next.bucket);
      if (next.preset === "custom") {
        if (next.from) params.set("from", next.from);
        if (next.to) params.set("to", next.to);
      }
      router.push(`?${params.toString()}`);
    },
    [router],
  );

  return (
    <div
      className="mb-6 flex flex-wrap items-end gap-3 rounded-md border bg-card p-4 shadow-sm"
      role="group"
      aria-label="Insights range"
    >
      <div className="space-y-1">
        <Label htmlFor="ins-preset">Range</Label>
        <select
          id="ins-preset"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={state.preset}
          onChange={(e) => {
            const next: RangePickerState = {
              ...state,
              preset: e.target.value as InsightsPreset,
            };
            setState(next);
            submit(next);
          }}
        >
          {INSIGHTS_PRESETS.map((p) => (
            <option key={p} value={p}>
              {PRESET_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="ins-bucket">Bucket</Label>
        <select
          id="ins-bucket"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={state.bucket}
          onChange={(e) => {
            const next: RangePickerState = {
              ...state,
              bucket: e.target.value as InsightsBucket,
            };
            setState(next);
            submit(next);
          }}
        >
          {INSIGHTS_BUCKETS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      {state.preset === "custom" && (
        <>
          <div className="space-y-1">
            <Label htmlFor="ins-from">From</Label>
            <Input
              id="ins-from"
              type="date"
              value={state.from}
              onChange={(e) => setState({ ...state, from: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ins-to">To</Label>
            <Input
              id="ins-to"
              type="date"
              value={state.to}
              onChange={(e) => setState({ ...state, to: e.target.value })}
            />
          </div>
          <Button size="sm" type="button" onClick={() => submit(state)}>
            Apply
          </Button>
        </>
      )}
    </div>
  );
}

function fromParams(sp: ReturnType<typeof useSearchParams>): RangePickerState {
  const preset = (sp?.get("preset") ?? "30d") as InsightsPreset;
  const bucket = (sp?.get("bucket") ?? "day") as InsightsBucket;
  const from = sp?.get("from") ?? "";
  const to = sp?.get("to") ?? "";
  const safePreset: InsightsPreset = (INSIGHTS_PRESETS as readonly string[]).includes(preset)
    ? preset
    : "30d";
  const safeBucket: InsightsBucket = (INSIGHTS_BUCKETS as readonly string[]).includes(bucket)
    ? bucket
    : "day";
  return { preset: safePreset, bucket: safeBucket, from, to };
}
