import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { notificationEvents } from "@/db/schema";

/** Phase 5 — Insert one notification row. */
export async function insertNotification(
  row: typeof notificationEvents.$inferInsert,
): Promise<void> {
  await db.insert(notificationEvents).values(row);
}

/**
 * Phase 5 — Returns the recent 50 notifications for a user, newest
 * first; uses `idx_notifications_recipient_created`.
 */
export async function listRecentForUser(
  recipientId: string,
  limit = 50,
): Promise<Array<typeof notificationEvents.$inferSelect>> {
  return db
    .select()
    .from(notificationEvents)
    .where(eq(notificationEvents.recipientId, recipientId))
    .orderBy(desc(notificationEvents.createdAt))
    .limit(limit);
}

/**
 * Phase 5 — Counts unread notifications for a user. Backed by the
 * partial index `idx_notifications_recipient_unread`.
 */
export async function countUnreadForUser(recipientId: string): Promise<number> {
  const r = await db
    .select({ c: count() })
    .from(notificationEvents)
    .where(and(eq(notificationEvents.recipientId, recipientId), isNull(notificationEvents.readAt)));
  return Number(r[0]?.c ?? 0);
}

/** Phase 5 — Idempotent mark-read. */
export async function markRead(
  notificationId: string,
  recipientId: string,
  when: number,
): Promise<number> {
  const r = await db
    .update(notificationEvents)
    .set({ readAt: when })
    .where(
      and(
        eq(notificationEvents.id, notificationId),
        eq(notificationEvents.recipientId, recipientId),
        isNull(notificationEvents.readAt),
      ),
    );
  return r.changes ?? 0;
}

/** Phase 5 — Look up one notification (used for auth check on mark-read). */
export async function findNotificationById(
  id: string,
): Promise<typeof notificationEvents.$inferSelect | undefined> {
  const r = await db
    .select()
    .from(notificationEvents)
    .where(eq(notificationEvents.id, id))
    .limit(1);
  return r[0];
}
