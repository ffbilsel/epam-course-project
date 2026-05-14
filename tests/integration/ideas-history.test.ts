import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, users } from "@/db/schema";
import { hashPassword } from "@/server/password";
import { createIdea, editIdea, applyTransition } from "@/server/idea-service";
import { getIdeaHistory } from "@/server/idea-history";
import { FixedClock } from "@/server/infra/clock";
import { StaticIdGenerator } from "@/server/infra/id-generator";

let authorId: string;
let strangerId: string;
let evaluatorId: string;
let adminId: string;
let catId: string;

beforeEach(async () => {
  const hash = await hashPassword("Passw0rd!");
  const now = Date.now();
  authorId = crypto.randomUUID();
  strangerId = crypto.randomUUID();
  evaluatorId = crypto.randomUUID();
  adminId = crypto.randomUUID();
  await db.insert(users).values([
    {
      id: authorId,
      email: `a${now}@x.io`,
      passwordHash: hash,
      displayName: "Author",
      role: "EMPLOYEE",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: strangerId,
      email: `s${now}@x.io`,
      passwordHash: hash,
      displayName: "Stranger",
      role: "EMPLOYEE",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: evaluatorId,
      email: `e${now}@x.io`,
      passwordHash: hash,
      displayName: "Ev",
      role: "EVALUATOR",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: adminId,
      email: `d${now}@x.io`,
      passwordHash: hash,
      displayName: "Ad",
      role: "ADMIN",
      createdAt: now,
      updatedAt: now,
    },
  ]);
  const cats = await db
    .select()
    .from(categories)
    .where(sql`${categories.name} = 'Other'`);
  catId = cats[0]!.id;
});

async function seedIdea(): Promise<string> {
  const idea = await createIdea(
    { title: "Hist test", description: "body", categoryId: catId },
    authorId,
    {
      clock: new FixedClock(new Date("2026-01-01")),
      ids: { next: () => crypto.randomUUID() },
    },
  );
  return idea.id;
}

describe("getIdeaHistory", () => {
  it("returns just SUBMITTED for a brand-new idea", async () => {
    const ideaId = await seedIdea();
    const events = await getIdeaHistory(ideaId, { id: authorId, role: "EMPLOYEE" });
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe("SUBMITTED");
    expect(events[0]!.actorName).toBe("Author");
  });

  it("classifies from=to rows as EDITED and others as TRANSITION", async () => {
    const ideaId = await seedIdea();
    await editIdea(
      ideaId,
      { title: "Hist edited", description: "new body that is longer", categoryId: catId },
      { id: authorId, role: "EMPLOYEE" },
      {
        clock: new FixedClock(new Date("2026-01-02")),
        ids: new StaticIdGenerator(["edit-uuid-aaaa-bbbb-cccc-dddddddddddd"]),
      },
    );
    await applyTransition(ideaId, "START_REVIEW", null, {
      id: evaluatorId,
      role: "EVALUATOR",
    });
    await applyTransition(ideaId, "APPROVE", "looks good", {
      id: evaluatorId,
      role: "EVALUATOR",
    });
    const events = await getIdeaHistory(ideaId, { id: authorId, role: "EMPLOYEE" });
    expect(events.map((e) => e.kind)).toEqual(["SUBMITTED", "EDITED", "TRANSITION", "TRANSITION"]);
    const approve = events[3];
    if (approve!.kind !== "TRANSITION") throw new Error("expected TRANSITION");
    expect(approve!.from).toBe("UNDER_REVIEW");
    expect(approve!.to).toBe("APPROVED");
    expect(approve!.comment).toBe("looks good");
  });

  it("lets reviewers and admins read any idea's history", async () => {
    const ideaId = await seedIdea();
    await expect(
      getIdeaHistory(ideaId, { id: evaluatorId, role: "EVALUATOR" }),
    ).resolves.toBeDefined();
    await expect(getIdeaHistory(ideaId, { id: adminId, role: "ADMIN" })).resolves.toBeDefined();
  });

  it("rejects unrelated employees with AUTH_FORBIDDEN_ROLE", async () => {
    const ideaId = await seedIdea();
    await expect(
      getIdeaHistory(ideaId, { id: strangerId, role: "EMPLOYEE" }),
    ).rejects.toMatchObject({ code: "AUTH_FORBIDDEN_ROLE" });
  });
});
