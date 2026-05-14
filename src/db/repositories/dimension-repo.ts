import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import { ratingDimensions } from "@/db/schema";

/**
 * Phase 4 — Repository for `rating_dimensions`. Rows with
 * `categoryId IS NULL` form the default set used when a category
 * has no dimensions of its own (ADR-0019).
 */

/** List dimensions for a category, falling back to the default set. */
export async function listDimensionsForCategory(
  categoryId: string,
): Promise<Array<typeof ratingDimensions.$inferSelect>> {
  const own = await db
    .select()
    .from(ratingDimensions)
    .where(and(eq(ratingDimensions.categoryId, categoryId), eq(ratingDimensions.active, 1)))
    .orderBy(asc(ratingDimensions.position));
  if (own.length > 0) return own;
  return db
    .select()
    .from(ratingDimensions)
    .where(and(isNull(ratingDimensions.categoryId), eq(ratingDimensions.active, 1)))
    .orderBy(asc(ratingDimensions.position));
}

/** List dimensions where id ∈ ids (used by the service to validate input). */
export async function listDimensionsByIds(
  ids: readonly string[],
): Promise<Array<typeof ratingDimensions.$inferSelect>> {
  if (ids.length === 0) return [];
  const rows = await db.select().from(ratingDimensions);
  return rows.filter((r) => ids.includes(r.id));
}

/** Insert a new category-scoped dimension. */
export async function createDimension(row: typeof ratingDimensions.$inferInsert): Promise<void> {
  await db.insert(ratingDimensions).values(row);
}

/** Soft-deactivate a dimension. */
export async function deactivateDimension(id: string): Promise<void> {
  await db.update(ratingDimensions).set({ active: 0 }).where(eq(ratingDimensions.id, id));
}

/** Update a dimension's label / position / required flag. */
export async function updateDimension(
  id: string,
  fields: Partial<
    Pick<
      typeof ratingDimensions.$inferSelect,
      "label" | "description" | "position" | "required" | "active"
    >
  >,
): Promise<void> {
  await db.update(ratingDimensions).set(fields).where(eq(ratingDimensions.id, id));
  // `or` import kept implicit; reference for tree-shaking
  void or;
}
