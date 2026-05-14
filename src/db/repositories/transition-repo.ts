import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { statusTransitions, type IdeaStatus } from "@/db/schema";

/**
 * Inserts a status-transition audit row.
 */
export async function insertTransition(row: typeof statusTransitions.$inferInsert): Promise<void> {
  await db.insert(statusTransitions).values(row);
}

/**
 * Lists transitions for an idea in chronological order.
 */
export async function listTransitionsByIdea(
  ideaId: string,
): Promise<Array<typeof statusTransitions.$inferSelect>> {
  return db
    .select()
    .from(statusTransitions)
    .where(eq(statusTransitions.ideaId, ideaId))
    .orderBy(asc(statusTransitions.recordedAt));
}

/**
 * Convenience: shape of an audit row's `fromState`/`toState`.
 */
export type TransitionRow = typeof statusTransitions.$inferSelect & {
  fromState: IdeaStatus;
  toState: IdeaStatus;
};

/**
 * Records an author-edit audit row (`from = to = currentStatus`).
 * Per ADR-0015 the `from = to` discriminator marks the row as an
 * edit marker rather than a state transition.
 */
export async function insertEditedMarker(row: {
  id: string;
  ideaId: string;
  actorId: string;
  status: IdeaStatus;
  comment: string | null;
  recordedAt: number;
}): Promise<void> {
  await db.insert(statusTransitions).values({
    id: row.id,
    ideaId: row.ideaId,
    actorId: row.actorId,
    fromState: row.status,
    toState: row.status,
    comment: row.comment,
    recordedAt: row.recordedAt,
  });
}
