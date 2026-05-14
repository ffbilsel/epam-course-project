/**
 * Phase 4 — Shared client/server type re-exports.
 */

export type { Draft, DraftSummary } from "@/server/draft-service";
export type {
  RatingDimension,
  RatingRow,
  RatingsForIdea,
} from "@/server/rating-service";
export type { CommentNode } from "@/server/comment-service";
export type {
  InsightsBucket,
  InsightsPreset,
  InsightsRangeInput,
} from "@/lib/validation/insights";
export type {
  SubmissionTrendPoint,
  ApprovalRateSummary,
  CategoryDistributionEntry,
} from "@/server/insights-service";
