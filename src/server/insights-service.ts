import { AppError } from "@/lib/errors/AppError";
import {
  querySubmissionsByDay,
  queryStatusCounts,
  queryCategoryDistribution,
  type DailyCountRow,
} from "@/db/repositories/insights-repo";
import type { InsightsBucket, InsightsRangeInput } from "@/lib/validation/insights";
import type { Role } from "@/db/schema";
import { logSecurityEvent } from "@/server/infra/logger";

/* eslint-disable jsdoc/require-jsdoc */

/**
 * Resolved date range in UTC. `fromMs` is inclusive, `toMs` exclusive.
 */
export interface ResolvedRange {
  fromMs: number;
  toMs: number;
  fromIso: string;
  toIso: string;
  bucket: InsightsBucket;
}

/** One point in the submission-trend series. */
export interface SubmissionTrendPoint {
  bucket: string;
  count: number;
}

/** Approval-rate KPI plus the trend series for the chart. */
export interface ApprovalRateSummary {
  approved: number;
  rejected: number;
  pending: number;
  rate: number;
  series: SubmissionTrendPoint[];
}

/** One category entry in the distribution chart. */
export interface CategoryDistributionEntry {
  categoryId: string;
  categoryName: string;
  count: number;
  share: number;
}

/** Envelope returned by every insights endpoint. */
export interface InsightsEnvelope<T> {
  data: T;
  range: { from: string; to: string; bucket: InsightsBucket };
  generatedAt: string;
}

const DAY_MS = 86_400_000;

/**
 * Resolves the presets / custom range into a concrete UTC window.
 * Both ends are clamped to UTC midnight.
 */
export function resolveRange(input: InsightsRangeInput, now: Date = new Date()): ResolvedRange {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let from: Date;
  let to: Date = new Date(today.getTime() + DAY_MS); // exclusive end of today
  let bucket: InsightsBucket = input.bucket;

  switch (input.preset) {
    case "7d":
      from = new Date(today.getTime() - 6 * DAY_MS);
      bucket = input.bucket === "day" ? "day" : input.bucket;
      break;
    case "30d":
      from = new Date(today.getTime() - 29 * DAY_MS);
      break;
    case "quarter": {
      const q = Math.floor(today.getUTCMonth() / 3);
      from = new Date(Date.UTC(today.getUTCFullYear(), q * 3, 1));
      break;
    }
    case "year":
      from = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
      break;
    case "custom": {
      if (!input.from || !input.to) {
        throw new AppError("INSIGHTS_RANGE_INVALID");
      }
      from = new Date(`${input.from}T00:00:00.000Z`);
      to = new Date(new Date(`${input.to}T00:00:00.000Z`).getTime() + DAY_MS);
      break;
    }
    default:
      from = new Date(today.getTime() - 29 * DAY_MS);
  }
  if (from.getTime() >= to.getTime()) {
    throw new AppError("INSIGHTS_RANGE_INVALID");
  }
  return {
    fromMs: from.getTime(),
    toMs: to.getTime(),
    fromIso: from.toISOString().slice(0, 10),
    toIso: new Date(to.getTime() - DAY_MS).toISOString().slice(0, 10),
    bucket,
  };
}

/**
 * Rolls a per-day series into the requested bucket (day/week/month).
 * Week buckets use ISO Monday-anchored weeks. Month buckets use
 * `YYYY-MM`. Buckets with no data are NOT inserted (chart shows
 * a clean line). For pure determinism the function never reads `Date.now`.
 */
export function rollUpBuckets(
  daily: DailyCountRow[],
  bucket: InsightsBucket,
): SubmissionTrendPoint[] {
  if (bucket === "day") return daily.map((d) => ({ bucket: d.bucket, count: d.count }));
  const acc = new Map<string, number>();
  for (const row of daily) {
    const key = bucket === "week" ? isoWeekKey(row.bucket) : row.bucket.slice(0, 7);
    acc.set(key, (acc.get(key) ?? 0) + row.count);
  }
  return Array.from(acc.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([b, count]) => ({ bucket: b, count }));
}

function isoWeekKey(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  // Monday-anchored week start
  const day = dt.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(dt.getTime() - diffToMonday * DAY_MS);
  return monday.toISOString().slice(0, 10);
}

function envelope<T>(data: T, range: ResolvedRange): InsightsEnvelope<T> {
  return {
    data,
    range: { from: range.fromIso, to: range.toIso, bucket: range.bucket },
    generatedAt: new Date().toISOString(),
  };
}

function assertViewer(role: Role): void {
  if (role === "EMPLOYEE") throw new AppError("INSIGHTS_FORBIDDEN");
}

/**
 * Submission-trend chart data. Returns `{ data: [], range, generatedAt }`
 * when the window is empty (FR-030).
 */
export function getSubmissionTrend(
  input: InsightsRangeInput,
  actor: { id: string; role: Role },
): InsightsEnvelope<SubmissionTrendPoint[]> {
  assertViewer(actor.role);
  const range = resolveRange(input);
  const daily = querySubmissionsByDay(range.fromMs, range.toMs);
  const data = rollUpBuckets(daily, range.bucket);
  logSecurityEvent({
    event: "insights_viewed",
    userId: actor.id,
    actorRole: actor.role,
    ip: null,
    requestId: null,
    details: { chart: "trend", from: range.fromIso, to: range.toIso, bucket: range.bucket },
  });
  return envelope(data, range);
}

/**
 * Approval-rate KPI + supporting series. Rate is decided / total
 * (excludes still-pending entries from the denominator).
 */
export function getApprovalRate(
  input: InsightsRangeInput,
  actor: { id: string; role: Role },
): InsightsEnvelope<ApprovalRateSummary> {
  assertViewer(actor.role);
  const range = resolveRange(input);
  const counts = queryStatusCounts(range.fromMs, range.toMs);
  const byStatus = new Map(counts.map((r) => [r.status, r.count]));
  const approved = byStatus.get("APPROVED") ?? 0;
  const rejected = byStatus.get("REJECTED") ?? 0;
  const implemented = byStatus.get("IMPLEMENTED") ?? 0;
  const pending = (byStatus.get("SUBMITTED") ?? 0) + (byStatus.get("UNDER_REVIEW") ?? 0);
  const positive = approved + implemented;
  const decided = positive + rejected;
  const rate = decided > 0 ? positive / decided : 0;
  const daily = querySubmissionsByDay(range.fromMs, range.toMs);
  const series = rollUpBuckets(daily, range.bucket);
  logSecurityEvent({
    event: "insights_viewed",
    userId: actor.id,
    actorRole: actor.role,
    ip: null,
    requestId: null,
    details: { chart: "approval-rate", from: range.fromIso, to: range.toIso },
  });
  return envelope(
    {
      approved: approved + implemented,
      rejected,
      pending,
      rate,
      series,
    },
    range,
  );
}

/**
 * Category-distribution chart data. Share is normalised over the
 * total inside the window; categories with zero ideas are still
 * returned so the chart can show empty slices.
 */
export function getCategoryDistribution(
  input: InsightsRangeInput,
  actor: { id: string; role: Role },
): InsightsEnvelope<CategoryDistributionEntry[]> {
  assertViewer(actor.role);
  const range = resolveRange(input);
  const rows = queryCategoryDistribution(range.fromMs, range.toMs);
  const total = rows.reduce((s, r) => s + r.count, 0);
  const data: CategoryDistributionEntry[] = rows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    count: r.count,
    share: total > 0 ? r.count / total : 0,
  }));
  logSecurityEvent({
    event: "insights_viewed",
    userId: actor.id,
    actorRole: actor.role,
    ip: null,
    requestId: null,
    details: { chart: "category-distribution", from: range.fromIso, to: range.toIso },
  });
  return envelope(data, range);
}
