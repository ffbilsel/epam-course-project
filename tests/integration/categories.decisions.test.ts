import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, users, ideas } from "@/db/schema";
import { hashPassword } from "@/server/password";
import { createIdea } from "@/server/idea-service";
import { approveCategory, rejectCategory } from "@/server/category-service";

let adminId: string;
let authorId: string;

beforeEach(async () => {
  const now = Date.now();
  const hash = await hashPassword("Passw0rd!");
  adminId = crypto.randomUUID();
  authorId = crypto.randomUUID();
  await db.insert(users).values([
    {
      id: adminId,
      email: `ca-${now}@x.io`,
      passwordHash: hash,
      displayName: "C",
      role: "ADMIN",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: authorId,
      email: `au-${now}@x.io`,
      passwordHash: hash,
      displayName: "A",
      role: "EMPLOYEE",
      createdAt: now,
      updatedAt: now,
    },
  ]);
});

describe("categories decisions", () => {
  it("approve happy path → ACTIVE", async () => {
    const idea = await createIdea(
      { title: "x", description: "y", proposedCategoryName: `Cat-${Date.now()}` },
      authorId,
    );
    await approveCategory(idea.categoryId, adminId);
    const r = await db
      .select()
      .from(categories)
      .where(sql`${categories.id} = ${idea.categoryId}`);
    expect(r[0]?.state).toBe("ACTIVE");
  });

  it("reject relinks ideas to Other and marks REJECTED", async () => {
    const name = `Cat-${Date.now()}`;
    const idea1 = await createIdea(
      { title: "1", description: "y", proposedCategoryName: name },
      authorId,
    );
    // second idea on same category
    const idea2Cat = idea1.categoryId;
    const idea2 = await createIdea(
      { title: "2", description: "y", categoryId: idea2Cat },
      authorId,
    );
    expect(idea2.categoryId).toBe(idea2Cat);
    await rejectCategory(idea1.categoryId, adminId);
    const all = await db
      .select()
      .from(ideas)
      .where(sql`${ideas.id} IN (${idea1.id}, ${idea2.id})`);
    const otherCat = await db
      .select()
      .from(categories)
      .where(sql`lower(${categories.name}) = 'other'`);
    for (const i of all) expect(i.categoryId).toBe(otherCat[0]!.id);
    const cat = await db
      .select()
      .from(categories)
      .where(sql`${categories.id} = ${idea1.categoryId}`);
    expect(cat[0]?.state).toBe("REJECTED");
  });

  it("approve already-decided → CATEGORY_NOT_PENDING", async () => {
    const idea = await createIdea(
      { title: "x", description: "y", proposedCategoryName: `Done-${Date.now()}` },
      authorId,
    );
    await approveCategory(idea.categoryId, adminId);
    await expect(approveCategory(idea.categoryId, adminId)).rejects.toMatchObject({
      code: "CATEGORY_NOT_PENDING",
    });
  });

  it("reject the protected Other → CATEGORY_PROTECTED", async () => {
    const otherCat = await db
      .select()
      .from(categories)
      .where(sql`lower(${categories.name}) = 'other'`);
    await expect(rejectCategory(otherCat[0]!.id, adminId)).rejects.toMatchObject({
      code: "CATEGORY_PROTECTED",
    });
  });

  it("reject of unknown id → CATEGORY_NOT_FOUND", async () => {
    await expect(
      rejectCategory("00000000-0000-4000-8000-000000000000", adminId),
    ).rejects.toMatchObject({ code: "CATEGORY_NOT_FOUND" });
  });
});
