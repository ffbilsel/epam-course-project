import { and, eq, isNull, lt } from "drizzle-orm";
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
