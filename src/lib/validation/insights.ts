import { z } from "zod";

/** Allowed bucket granularities for insights aggregations. */
export const INSIGHTS_BUCKETS = ["day", "week", "month"] as const;
export type InsightsBucket = (typeof INSIGHTS_BUCKETS)[number];

/** Allowed range presets for the Insights page. */
export const INSIGHTS_PRESETS = ["7d", "30d", "quarter", "year", "custom"] as const;
export type InsightsPreset = (typeof INSIGHTS_PRESETS)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
}

/**
 * `GET /api/insights/*` query schema. Either a preset OR a custom
 * `from`/`to` pair plus a bucket selection.
 */
export const InsightsRangeSchema = z
  .object({
    preset: z.enum(INSIGHTS_PRESETS).default("30d"),
    from: z.string().refine(isValidIsoDate, { message: "INSIGHTS_RANGE_INVALID" }).optional(),
    to: z.string().refine(isValidIsoDate, { message: "INSIGHTS_RANGE_INVALID" }).optional(),
    bucket: z.enum(INSIGHTS_BUCKETS).default("day"),
  })
  .superRefine((v, ctx) => {
    if (v.from && v.to && v.from > v.to) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "INSIGHTS_RANGE_INVALID",
      });
    }
  });
/** Inferred TypeScript type for {@link InsightsRangeSchema}. */
export type InsightsRangeInput = z.infer<typeof InsightsRangeSchema>;
