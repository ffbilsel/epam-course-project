import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { categories, users } from "@/db/schema";
import { sql } from "drizzle-orm";
import { hashPassword } from "@/server/password";
import { createIdea, listMineIdeas, getIdeaDetail } from "@/server/idea-service";
import { proposeCategory } from "@/server/category-service";
import { FixedClock } from "@/server/infra/clock";
import { StaticIdGenerator } from "@/server/infra/id-generator";
import { AppError } from "@/lib/errors/AppError";

let authorId: string;

beforeEach(async () => {
  authorId = crypto.randomUUID();
  const now = Date.now();
  await db.insert(users).values({
    id: authorId,
    email: `u${now}@e.x`,
    passwordHash: await hashPassword("Passw0rd!"),
    displayName: "Author",
    role: "EMPLOYEE",
    createdAt: now,
    updatedAt: now,
  });
});

async function activeCategoryId(): Promise<string> {
  // Use the protected "Other" category — it always has an empty schema,
  // so legacy tests can omit structured `answers` payloads.
  const rows = await db
    .select()
    .from(categories)
    .where(sql`${categories.name} = 'Other'`)
    .limit(1);
  return rows[0]!.id;
}

describe("idea-service.createIdea", () => {
  it("creates an idea with an existing category", async () => {
    const catId = await activeCategoryId();
    const fixed = new FixedClock(new Date("2026-01-15T00:00:00Z"));
    const ids = new StaticIdGenerator(["idea-uuid-aaaa-bbbb-cccc-dddddddddddd"]);
    const idea = await createIdea({ title: "T", description: "D", categoryId: catId }, authorId, {
      clock: fixed,
      ids,
    });
    expect(idea.id).toBe("idea-uuid-aaaa-bbbb-cccc-dddddddddddd");
    expect(idea.status).toBe("SUBMITTED");
    expect(idea.createdAt).toBe(fixed.now().getTime());
    const mine = await listMineIdeas(authorId);
    expect(mine.map((i) => i.id)).toContain(idea.id);
    const detail = await getIdeaDetail(idea.id);
    expect(detail.categoryId).toBe(catId);
  });

  it("proposeCategory creates a PROPOSED category and rejects duplicates", async () => {
    const proposed = await proposeCategory("Sustainability", authorId, "EMPLOYEE");
    expect(proposed.state).toBe("PROPOSED");
    const idea = await createIdea(
      { title: "P", description: "D", categoryId: proposed.id },
      authorId,
    );
    expect(idea.categoryState).toBe("PROPOSED");
    await expect(proposeCategory("sustainability", authorId, "EMPLOYEE")).rejects.toMatchObject({
      code: "CATEGORY_NAME_TAKEN",
    });
  });

  it("throws IDEA_CATEGORY_INVALID when categoryId is missing", async () => {
    await expect(
      createIdea({ title: "x", description: "y" } as never, authorId),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("throws IDEA_CATEGORY_INVALID for non-existent categoryId", async () => {
    await expect(
      createIdea(
        { title: "x", description: "y", categoryId: "00000000-0000-4000-8000-000000000000" },
        authorId,
      ),
    ).rejects.toMatchObject({ code: "IDEA_CATEGORY_INVALID" });
  });
});
