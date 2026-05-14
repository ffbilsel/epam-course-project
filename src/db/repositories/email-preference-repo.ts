import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { emailPreferences } from "@/db/schema";

/**
 * Phase 5 — Per-user transactional email preferences. Missing row
 * implies all-on (FR-014); the service layer applies that default.
 */
export async function findPreferencesByUserId(
  userId: string,
): Promise<typeof emailPreferences.$inferSelect | undefined> {
  const r = await db
    .select()
    .from(emailPreferences)
    .where(eq(emailPreferences.userId, userId))
    .limit(1);
  return r[0];
}

/** Phase 5 — Upsert preferences; bumps `updatedAt`. */
export async function upsertPreferences(row: typeof emailPreferences.$inferInsert): Promise<void> {
  await db
    .insert(emailPreferences)
    .values(row)
    .onConflictDoUpdate({ target: emailPreferences.userId, set: row });
}
