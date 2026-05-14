import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ideaDrafts } from "@/db/schema";

/**
 * Phase 4 — Repository for `idea_drafts` (ADR-0017). All reads are
 * scoped to a single author; cross-author access is the service's
 * responsibility to forbid before calling these functions.
 */

/** Insert a brand-new draft row. */
export async function createDraft(row: typeof ideaDrafts.$inferInsert): Promise<void> {
  await db.insert(ideaDrafts).values(row);
}

/** Update an existing draft, identified by id. */
export async function updateDraft(
  id: string,
  fields: {
    title?: string;
    description?: string;
    categoryId?: string | null;
    categoryAnswers?: string;
    updatedAt: number;
  },
): Promise<void> {
  await db.update(ideaDrafts).set(fields).where(eq(ideaDrafts.id, id));
}

/** Read a single draft by id. */
export async function getDraft(id: string): Promise<typeof ideaDrafts.$inferSelect | undefined> {
  const r = await db.select().from(ideaDrafts).where(eq(ideaDrafts.id, id)).limit(1);
  return r[0];
}

/** List all drafts authored by `authorId`, most-recently-updated first. */
export async function listDraftsByAuthor(
  authorId: string,
): Promise<Array<typeof ideaDrafts.$inferSelect>> {
  return db
    .select()
    .from(ideaDrafts)
    .where(eq(ideaDrafts.authorId, authorId))
    .orderBy(desc(ideaDrafts.updatedAt));
}

/** Count drafts authored by `authorId` (used by the sidebar badge). */
export async function countDraftsByAuthor(authorId: string): Promise<number> {
  const rows = await db.select().from(ideaDrafts).where(eq(ideaDrafts.authorId, authorId));
  return rows.length;
}

/** Hard-delete a draft. The caller verifies ownership first. */
export async function deleteDraft(id: string, authorId: string): Promise<void> {
  await db
    .delete(ideaDrafts)
    .where(and(eq(ideaDrafts.id, id), eq(ideaDrafts.authorId, authorId)));
}
