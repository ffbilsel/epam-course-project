import { and, eq, lte, or, isNull, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { emailDeliveries } from "@/db/schema";

/** Phase 5 — Insert one email delivery row (status defaults to `pending`). */
export async function insertDelivery(
  row: typeof emailDeliveries.$inferInsert,
): Promise<void> {
  await db.insert(emailDeliveries).values(row);
}

/**
 * Phase 5 — Picks every row eligible for the next dispatch wave:
 * `status = 'pending'` AND (`next_attempt_at IS NULL` OR `<= now`)
 * AND `attempt_count < maxAttempts`. Backed by
 * `idx_email_deliveries_due`.
 */
export async function listDueDeliveries(
  now: number,
  maxAttempts = 6,
): Promise<Array<typeof emailDeliveries.$inferSelect>> {
  return db
    .select()
    .from(emailDeliveries)
    .where(
      and(
        eq(emailDeliveries.status, "pending"),
        or(isNull(emailDeliveries.nextAttemptAt), lte(emailDeliveries.nextAttemptAt, now)),
        lt(emailDeliveries.attemptCount, maxAttempts),
      ),
    );
}

/** Phase 5 — Update a delivery row in place after an attempt. */
export async function updateDelivery(
  id: string,
  patch: Partial<typeof emailDeliveries.$inferInsert>,
): Promise<void> {
  await db.update(emailDeliveries).set(patch).where(eq(emailDeliveries.id, id));
}

/** Phase 5 — Look up one delivery by id (test / introspection). */
export async function findDeliveryById(
  id: string,
): Promise<typeof emailDeliveries.$inferSelect | undefined> {
  const r = await db.select().from(emailDeliveries).where(eq(emailDeliveries.id, id)).limit(1);
  return r[0];
}
