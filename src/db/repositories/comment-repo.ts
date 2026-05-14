import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { comments } from "@/db/schema";

/**
 * Phase 4 — Repository for `comments`. Soft-delete via
 * `deletedAt`. One level of nesting only — enforced by the service
 * (ADR-0020).
 */

/** Insert a new comment row. */
export async function insertComment(row: typeof comments.$inferInsert): Promise<void> {
  await db.insert(comments).values(row);
}

/** Get one comment by id. */
export async function getComment(id: string): Promise<typeof comments.$inferSelect | undefined> {
  const r = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  return r[0];
}

/** Soft-delete: stamps `deletedAt` + `deletedById`. */
export async function softDeleteComment(
  id: string,
  deletedById: string,
  now: number,
): Promise<void> {
  await db.update(comments).set({ deletedAt: now, deletedById }).where(eq(comments.id, id));
}

/** Edit a comment body. */
export async function editComment(id: string, body: string, now: number): Promise<void> {
  await db.update(comments).set({ body, editedAt: now }).where(eq(comments.id, id));
}

/** List every comment row for one idea, chronological. */
export async function listForIdea(ideaId: string): Promise<Array<typeof comments.$inferSelect>> {
  return db
    .select()
    .from(comments)
    .where(eq(comments.ideaId, ideaId))
    .orderBy(asc(comments.createdAt));
}
