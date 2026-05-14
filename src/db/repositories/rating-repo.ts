import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { ratings } from "@/db/schema";

/**
 * Phase 4 — Repository for the `ratings` table. Per-(idea, evaluator,
 * dimension) row; the unique index enforces idempotency
 * (ADR-0019).
 */

/** Upsert a single rating row. */
export async function upsertRating(row: {
  id: string;
  ideaId: string;
  evaluatorId: string;
  dimensionId: string;
  score: number | null;
  now: number;
}): Promise<void> {
  const existing = await db
    .select()
    .from(ratings)
    .where(
      and(
        eq(ratings.ideaId, row.ideaId),
        eq(ratings.evaluatorId, row.evaluatorId),
        eq(ratings.dimensionId, row.dimensionId),
      ),
    )
    .limit(1);
  if (existing[0]) {
    await db
      .update(ratings)
      .set({ score: row.score, updatedAt: row.now })
      .where(eq(ratings.id, existing[0].id));
    return;
  }
  await db.insert(ratings).values({
    id: row.id,
    ideaId: row.ideaId,
    evaluatorId: row.evaluatorId,
    dimensionId: row.dimensionId,
    score: row.score,
    createdAt: row.now,
    updatedAt: row.now,
  });
}

/** List every rating row for one idea. */
export async function listRatingsForIdea(
  ideaId: string,
): Promise<Array<typeof ratings.$inferSelect>> {
  return db.select().from(ratings).where(eq(ratings.ideaId, ideaId));
}

/** List one evaluator's ratings on one idea. */
export async function listRatingsByEvaluator(
  ideaId: string,
  evaluatorId: string,
): Promise<Array<typeof ratings.$inferSelect>> {
  return db
    .select()
    .from(ratings)
    .where(and(eq(ratings.ideaId, ideaId), eq(ratings.evaluatorId, evaluatorId)));
}

/** Stamp `lockedAt` on every rating row written by `evaluatorId`. */
export async function lockRatingsForDeciding(
  ideaId: string,
  evaluatorId: string,
  now: number,
): Promise<void> {
  await db
    .update(ratings)
    .set({ lockedAt: now })
    .where(and(eq(ratings.ideaId, ideaId), eq(ratings.evaluatorId, evaluatorId)));
  void isNotNull;
}
