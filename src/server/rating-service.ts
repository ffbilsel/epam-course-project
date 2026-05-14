import { AppError } from "@/lib/errors/AppError";
import { SystemClock, type Clock } from "@/server/infra/clock";
import { SystemIdGenerator, type IdGenerator } from "@/server/infra/id-generator";
import { listDimensionsForCategory, listDimensionsByIds } from "@/db/repositories/dimension-repo";
import {
  upsertRating,
  listRatingsForIdea,
  listRatingsByEvaluator,
  lockRatingsForDeciding,
} from "@/db/repositories/rating-repo";
import { findIdeaById } from "@/db/repositories/idea-repo";
import { findCategoryById } from "@/db/repositories/category-repo";
import { logSecurityEvent } from "@/server/infra/logger";
import { RatingPutSchema } from "@/lib/validation/rating";
import type { Role } from "@/db/schema";

/** A single rating dimension surfaced to the UI. */
export interface RatingDimension {
  id: string;
  label: string;
  description: string | null;
  position: number;
  required: boolean;
}

/** One evaluator's score on one dimension. */
export interface RatingRow {
  evaluatorId: string;
  dimensionId: string;
  score: number | null;
  lockedAt: number | null;
}

/** Ratings projection returned to the UI for one idea. */
export interface RatingsForIdea {
  dimensions: RatingDimension[];
  rows: RatingRow[];
}

interface Deps {
  clock?: Clock;
  ids?: IdGenerator;
}

/**
 * Read every rating row + dimension list for one idea. Caller is
 * expected to enforce role / scope (only the assigned reviewers,
 * the author, or an Admin should reach this).
 */
export async function getRatings(ideaId: string): Promise<RatingsForIdea> {
  const idea = await findIdeaById(ideaId);
  if (!idea) throw AppError.notFound("IDEA_NOT_FOUND");
  const dims = await listDimensionsForCategory(idea.categoryId);
  const rows = await listRatingsForIdea(ideaId);
  return {
    dimensions: dims.map((d) => ({
      id: d.id,
      label: d.label,
      description: d.description,
      position: d.position,
      required: d.required === 1,
    })),
    rows: rows.map((r) => ({
      evaluatorId: r.evaluatorId,
      dimensionId: r.dimensionId,
      score: r.score,
      lockedAt: r.lockedAt,
    })),
  };
}

/**
 * Upsert one evaluator's scores. Rejects unknown dimension ids and
 * any change to a locked row (`RATING_LOCKED`). Scores outside the
 * 1–5 range are rejected by {@link RatingPutSchema} before this
 * code runs.
 */
export async function putRatings(
  ideaId: string,
  evaluator: { id: string; role: Role },
  input: unknown,
  deps: Deps = {},
): Promise<RatingsForIdea> {
  const parsed = RatingPutSchema.parse(input);
  const idea = await findIdeaById(ideaId);
  if (!idea) throw AppError.notFound("IDEA_NOT_FOUND");

  // Validate dimension ids
  const dimIds = parsed.scores.map((s) => s.dimensionId);
  const knownDims = await listDimensionsByIds(dimIds);
  const knownIds = new Set(knownDims.map((d) => d.id));
  for (const id of dimIds) {
    if (!knownIds.has(id)) throw new AppError("RATING_INVALID_SCORE");
  }

  // Refuse writes if any of this evaluator's rows are locked
  const existing = await listRatingsByEvaluator(ideaId, evaluator.id);
  if (existing.some((r) => r.lockedAt !== null)) {
    throw new AppError("RATING_LOCKED");
  }

  const ids = deps.ids ?? SystemIdGenerator;
  const clock = deps.clock ?? SystemClock;
  const now = clock.now().getTime();

  for (const s of parsed.scores) {
    await upsertRating({
      id: ids.next(),
      ideaId,
      evaluatorId: evaluator.id,
      dimensionId: s.dimensionId,
      score: s.score ?? null,
      now,
    });
  }
  void evaluator.role;
  return getRatings(ideaId);
}

/**
 * Throws `RATING_REQUIRED_MISSING` when any required dimension for
 * the idea's category has no score from this evaluator.
 */
export async function requireRequiredDimensions(
  ideaId: string,
  evaluatorId: string,
): Promise<void> {
  const idea = await findIdeaById(ideaId);
  if (!idea) throw AppError.notFound("IDEA_NOT_FOUND");
  const cat = await findCategoryById(idea.categoryId);
  if (!cat) throw AppError.notFound("CATEGORY_NOT_FOUND");
  const dims = await listDimensionsForCategory(idea.categoryId);
  const required = dims.filter((d) => d.required === 1);
  if (required.length === 0) return;
  const rows = await listRatingsByEvaluator(ideaId, evaluatorId);
  const scoreById = new Map(rows.map((r) => [r.dimensionId, r.score] as const));
  const missing = required.filter((d) => {
    const s = scoreById.get(d.id);
    return s === undefined || s === null;
  });
  if (missing.length > 0) {
    throw new AppError("RATING_REQUIRED_MISSING", { missing: missing.map((d) => d.label) });
  }
}

/**
 * Stamp `lockedAt` on every rating row written by this evaluator.
 * Idempotent — repeated calls on already-locked rows are no-ops.
 */
export async function lockOnDecision(
  ideaId: string,
  evaluator: { id: string; role: Role },
  deps: Deps = {},
): Promise<void> {
  const clock = deps.clock ?? SystemClock;
  const now = clock.now().getTime();
  await lockRatingsForDeciding(ideaId, evaluator.id, now);
  logSecurityEvent({
    event: "rating_locked",
    userId: evaluator.id,
    actorRole: evaluator.role,
    ip: null,
    requestId: null,
    details: { ideaId },
  });
}
