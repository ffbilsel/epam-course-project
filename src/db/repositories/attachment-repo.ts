import { and, asc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { attachments } from "@/db/schema";

/**
 * Inserts an attachment row in the staged (no idea linked) state.
 */
export async function insertStagedAttachment(row: typeof attachments.$inferInsert): Promise<void> {
  await db.insert(attachments).values(row);
}

/**
 * Looks up an attachment by id.
 */
export async function findAttachmentById(
  id: string,
): Promise<typeof attachments.$inferSelect | undefined> {
  const r = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
  return r[0];
}

/**
 * Looks up the (single, by unique index) attachment for an idea.
 */
export async function findAttachmentByIdeaId(
  ideaId: string,
): Promise<typeof attachments.$inferSelect | undefined> {
  const r = await db.select().from(attachments).where(eq(attachments.ideaId, ideaId)).limit(1);
  return r[0];
}

/**
 * Atomically links a staged attachment to an idea. The caller is
 * responsible for moving the file out of `.staging/`.
 */
export async function commitAttachmentToIdea(
  attachmentId: string,
  ideaId: string,
  storedPath: string,
): Promise<void> {
  await db.update(attachments).set({ ideaId, storedPath }).where(eq(attachments.id, attachmentId));
}

/**
 * Returns staged attachments older than the cutoff (for sweeper).
 */
export async function listOrphanStagedAttachments(
  cutoffMs: number,
): Promise<Array<typeof attachments.$inferSelect>> {
  return db
    .select()
    .from(attachments)
    .where(and(isNull(attachments.ideaId), lt(attachments.uploadedAt, cutoffMs)));
}

/**
 * Deletes an attachment row (and orphans its file — caller cleans up).
 */
export async function deleteAttachment(id: string): Promise<void> {
  await db.delete(attachments).where(eq(attachments.id, id));
}

/**
 * Phase 5 — Returns every attachment for an idea, ordered by
 * (`displayOrder`, `uploadedAt`) so the UI gallery and the version
 * snapshot agree on ordering.
 */
export async function listByIdeaOrdered(
  ideaId: string,
): Promise<Array<typeof attachments.$inferSelect>> {
  return db
    .select()
    .from(attachments)
    .where(eq(attachments.ideaId, ideaId))
    .orderBy(asc(attachments.displayOrder), asc(attachments.uploadedAt));
}

/**
 * Phase 5 — Sums on-disk byte usage for the per-idea quota check
 * (`ATTACHMENT_QUOTA_EXCEEDED`).
 */
export async function sumBytesForIdea(ideaId: string): Promise<number> {
  const r = await db
    .select({ total: sql<number>`coalesce(sum(${attachments.sizeBytes}), 0)` })
    .from(attachments)
    .where(eq(attachments.ideaId, ideaId));
  return Number(r[0]?.total ?? 0);
}

/**
 * Phase 5 — Inserts a batch of attachments in one transaction.
 */
export async function insertBatch(rows: Array<typeof attachments.$inferInsert>): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(attachments).values(rows);
}

/**
 * Phase 5 — Reorders the attachments of an idea by writing
 * `display_order` for each id in the supplied sequence. Caller must
 * have validated that `orderedIds` is exactly the current set
 * (`ATTACHMENT_ORDER_INVALID` otherwise).
 */
export async function reorder(ideaId: string, orderedIds: string[]): Promise<void> {
  // better-sqlite3 transactions are synchronous; Drizzle requires a sync
  // callback. We run the updates sequentially inside one transaction.
  db.transaction((tx) => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      const id = orderedIds[i]!;
      tx
        .update(attachments)
        .set({ displayOrder: i })
        .where(and(eq(attachments.ideaId, ideaId), eq(attachments.id, id)))
        .run();
    }
  });
}

/**
 * Phase 5 — Loads attachments by an arbitrary id list, preserving
 * insertion order on the result via id-keyed map at call site.
 */
export async function listByIds(
  ids: string[],
): Promise<Array<typeof attachments.$inferSelect>> {
  if (ids.length === 0) return [];
  return db.select().from(attachments).where(inArray(attachments.id, ids));
}
