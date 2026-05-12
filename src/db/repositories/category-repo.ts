import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, type CategoryState } from "@/db/schema";

/**
 * Lists categories filtered by state. With no filter, returns all.
 */
export async function listCategories(
  state?: CategoryState,
): Promise<Array<typeof categories.$inferSelect>> {
  const q = db.select().from(categories).orderBy(asc(categories.name));
  if (state) return q.where(eq(categories.state, state));
  return q;
}

/**
 * Finds a category by case-insensitive name match.
 */
export async function findCategoryByLowerName(
  name: string,
): Promise<typeof categories.$inferSelect | undefined> {
  const r = await db
    .select()
    .from(categories)
    .where(sql`lower(${categories.name}) = lower(${name})`)
    .limit(1);
  return r[0];
}

/**
 * Finds a category by id.
 */
export async function findCategoryById(
  id: string,
): Promise<typeof categories.$inferSelect | undefined> {
  const r = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return r[0];
}

/**
 * Inserts a new PROPOSED category.
 */
export async function insertProposedCategory(row: typeof categories.$inferInsert): Promise<void> {
  await db.insert(categories).values(row);
}

/**
 * Updates a category state alongside the deciding admin and timestamp.
 */
export async function decideCategory(
  id: string,
  state: CategoryState,
  decidedById: string,
  decidedAt: number,
): Promise<void> {
  await db.update(categories).set({ state, decidedById, decidedAt }).where(eq(categories.id, id));
}

/**
 * Resolves the protected `Other` category id (seeded by `db:seed`).
 */
export async function findOtherCategoryId(): Promise<string> {
  const r = await db
    .select()
    .from(categories)
    .where(sql`lower(${categories.name}) = 'other'`)
    .limit(1);
  const row = r[0];
  if (!row) throw new Error("Seed missing: Other category");
  return row.id;
}
