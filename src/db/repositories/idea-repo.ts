import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ideas, type IdeaStatus } from "@/db/schema";

/**
 * Inserts a new Idea row.
 */
export async function insertIdea(row: typeof ideas.$inferInsert): Promise<void> {
  await db.insert(ideas).values(row);
}

/**
 * Finds an idea by id, or returns undefined.
 */
export async function findIdeaById(id: string): Promise<typeof ideas.$inferSelect | undefined> {
  const r = await db.select().from(ideas).where(eq(ideas.id, id)).limit(1);
  return r[0];
}

/**
 * Lists ideas authored by the given user, newest update first.
 */
export async function listIdeasByAuthor(
  authorId: string,
): Promise<Array<typeof ideas.$inferSelect>> {
  return db.select().from(ideas).where(eq(ideas.authorId, authorId)).orderBy(desc(ideas.updatedAt));
}

/**
 * Lists pending ideas for the reviewer queue.
 */
export async function listPendingIdeas(): Promise<Array<typeof ideas.$inferSelect>> {
  return db
    .select()
    .from(ideas)
    .where(eq(ideas.status, "SUBMITTED" as IdeaStatus))
    .orderBy(asc(ideas.createdAt));
}

/**
 * Updates the status (and updatedAt) of an idea.
 */
export async function updateIdeaStatus(
  id: string,
  status: IdeaStatus,
  updatedAt: number,
): Promise<void> {
  await db.update(ideas).set({ status, updatedAt }).where(eq(ideas.id, id));
}

/**
 * Re-links every idea on `fromCategoryId` to `toCategoryId`. Used when
 * a proposed category is rejected (FR-016).
 */
export async function relinkCategory(
  fromCategoryId: string,
  toCategoryId: string,
  updatedAt: number,
): Promise<void> {
  await db
    .update(ideas)
    .set({ categoryId: toCategoryId, updatedAt })
    .where(and(eq(ideas.categoryId, fromCategoryId)));
}
