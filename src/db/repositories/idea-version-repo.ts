import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { ideaVersions } from "@/db/schema";

/** Phase 5 — Insert one version snapshot row. */
export async function insertVersion(row: typeof ideaVersions.$inferInsert): Promise<void> {
  await db.insert(ideaVersions).values(row);
}

/**
 * Phase 5 — Returns the next version number for an idea (max + 1).
 */
export async function nextVersionNo(ideaId: string): Promise<number> {
  const r = await db
    .select({ max: sql<number>`coalesce(max(${ideaVersions.versionNo}), 0)` })
    .from(ideaVersions)
    .where(eq(ideaVersions.ideaId, ideaId));
  return Number(r[0]?.max ?? 0) + 1;
}

/** Phase 5 — Lists every version for an idea, oldest first. */
export async function listVersionsForIdea(
  ideaId: string,
): Promise<Array<typeof ideaVersions.$inferSelect>> {
  return db
    .select()
    .from(ideaVersions)
    .where(eq(ideaVersions.ideaId, ideaId))
    .orderBy(asc(ideaVersions.versionNo));
}

/** Phase 5 — Loads one specific version. */
export async function findVersion(
  ideaId: string,
  versionNo: number,
): Promise<typeof ideaVersions.$inferSelect | undefined> {
  const r = await db
    .select()
    .from(ideaVersions)
    .where(and(eq(ideaVersions.ideaId, ideaId), eq(ideaVersions.versionNo, versionNo)))
    .limit(1);
  return r[0];
}

/**
 * Phase 5 — Returns the latest snapshot for an idea (used by the
 * back-fill to detect duplicate runs).
 */
export async function findLatestVersion(
  ideaId: string,
): Promise<typeof ideaVersions.$inferSelect | undefined> {
  const r = await db
    .select()
    .from(ideaVersions)
    .where(eq(ideaVersions.ideaId, ideaId))
    .orderBy(desc(ideaVersions.versionNo))
    .limit(1);
  return r[0];
}
