import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, users, ideaVersions } from "@/db/schema";
import { hashPassword } from "@/server/password";
import { createIdea, editIdea } from "@/server/idea-service";
import { listVersions, getVersion } from "@/server/version-service";

let authorId: string;
let strangerId: string;
let evaluatorId: string;
let ideaId: string;

async function activeCategoryId(): Promise<string> {
  const rows = await db
    .select()
    .from(categories)
    .where(sql`${categories.name} = 'Other'`)
    .limit(1);
  return rows[0]!.id;
}

beforeEach(async () => {
  const now = Date.now();
  authorId = crypto.randomUUID();
  strangerId = crypto.randomUUID();
  evaluatorId = crypto.randomUUID();
  await db.insert(users).values([
    {
      id: authorId,
      email: `v-a-${now}@x.io`,
      passwordHash: await hashPassword("Passw0rd!"),
      displayName: "A",
      role: "EMPLOYEE",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: strangerId,
      email: `v-s-${now}@x.io`,
      passwordHash: await hashPassword("Passw0rd!"),
      displayName: "S",
      role: "EMPLOYEE",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: evaluatorId,
      email: `v-e-${now}@x.io`,
      passwordHash: await hashPassword("Passw0rd!"),
      displayName: "E",
      role: "EVALUATOR",
      createdAt: now,
      updatedAt: now,
    },
  ]);
  const cat = await activeCategoryId();
  const idea = await createIdea(
    { title: "First", description: "Desc", categoryId: cat },
    authorId,
  );
  ideaId = idea.id;
});

describe("version-service", () => {
  it("creates v1 on initial submit", async () => {
    const rows = await db.select().from(ideaVersions);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.versionNo).toBe(1);
    expect(rows[0]!.title).toBe("First");
  });

  it("creates v2 on a subsequent author edit", async () => {
    const cat = await activeCategoryId();
    await editIdea(
      ideaId,
      { title: "Second", description: "Desc2", categoryId: cat },
      { id: authorId, role: "EMPLOYEE" },
    );
    const list = await listVersions(ideaId, { id: authorId, role: "EMPLOYEE" });
    expect(list).toHaveLength(2);
    expect(list.map((r) => r.versionNo)).toEqual([1, 2]);
    expect(list[1]!.actorDisplayName).toBe("A");
  });

  it("non-author non-reviewer cannot see versions (IDEA_NOT_FOUND)", async () => {
    await expect(
      listVersions(ideaId, { id: strangerId, role: "EMPLOYEE" }),
    ).rejects.toMatchObject({ code: "IDEA_NOT_FOUND" });
  });

  it("evaluator can see versions", async () => {
    const list = await listVersions(ideaId, { id: evaluatorId, role: "EVALUATOR" });
    expect(list).toHaveLength(1);
  });

  it("getVersion returns IDEA_VERSION_NOT_FOUND for unknown version", async () => {
    await expect(
      getVersion(ideaId, 999, { id: authorId, role: "EMPLOYEE" }),
    ).rejects.toMatchObject({ code: "IDEA_VERSION_NOT_FOUND" });
  });
});
