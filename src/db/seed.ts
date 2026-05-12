import { sql } from "drizzle-orm";
import { db, sqliteClient } from "./client";
import { categories } from "./schema";

const SEED_CATEGORIES: Array<{ id: string; name: string; isProtected: number }> = [
  { id: "11111111-1111-4111-8111-111111111101", name: "Process Improvement", isProtected: 0 },
  { id: "11111111-1111-4111-8111-111111111102", name: "Tooling", isProtected: 0 },
  { id: "11111111-1111-4111-8111-111111111103", name: "Customer Experience", isProtected: 0 },
  { id: "11111111-1111-4111-8111-111111111104", name: "Cost Savings", isProtected: 0 },
  { id: "11111111-1111-4111-8111-1111111111ff", name: "Other", isProtected: 1 },
];

/**
 * Idempotent seed of the five default categories (FR-014). Safe to
 * re-run; uses INSERT OR IGNORE keyed by `lower(name)`.
 */
function seed(): void {
  const now = Date.now();
  for (const c of SEED_CATEGORIES) {
    db.insert(categories)
      .values({
        id: c.id,
        name: c.name,
        state: "ACTIVE",
        proposedById: null,
        decidedById: null,
        decidedAt: null,
        createdAt: now,
        isProtected: c.isProtected,
      })
      .onConflictDoNothing({ target: sql`(lower(name))` })
      .run();
  }
  console.log(`[db] seeded ${SEED_CATEGORIES.length} default categories`);
  sqliteClient.close();
}

seed();
