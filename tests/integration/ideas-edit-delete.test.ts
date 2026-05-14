import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, ideas, statusTransitions, users } from "@/db/schema";
import { hashPassword } from "@/server/password";
import {
  createIdea,
  editIdea,
  deleteIdea,
  applyTransition,
  getIdeaDetail,
} from "@/server/idea-service";
import { FixedClock } from "@/server/infra/clock";
import { StaticIdGenerator } from "@/server/infra/id-generator";

let authorId: string;
let strangerId: string;
let evaluatorId: string;

beforeEach(async () => {
  const now = Date.now();
  const hash = await hashPassword("Passw0rd!");
  authorId = crypto.randomUUID();
  strangerId = crypto.randomUUID();
  evaluatorId = crypto.randomUUID();
  await db.insert(users).values([
    {
      id: authorId,
      email: `au${now}@x.io`,
      passwordHash: hash,
      displayName: "Au",
      role: "EMPLOYEE",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: strangerId,
      email: `st${now}@x.io`,
      passwordHash: hash,
      displayName: "St",
      role: "EMPLOYEE",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: evaluatorId,
      email: `ev${now}@x.io`,
      passwordHash: hash,
      displayName: "Ev",
      role: "EVALUATOR",
      createdAt: now,
      updatedAt: now,
    },
  ]);
});

async function activeCategoryId(): Promise<string> {
  const rows = await db
    .select()
    .from(categories)
    .where(sql`${categories.name} = 'Other'`)
    .limit(1);
  return rows[0]!.id;
}

async function makeSubmittedIdea(): Promise<string> {
  const catId = await activeCategoryId();
  const idea = await createIdea({ title: "T0", description: "D0", categoryId: catId }, authorId, {
    clock: new FixedClock(new Date("2026-01-01")),
    ids: { next: () => crypto.randomUUID() },
  });
  return idea.id;
}

describe("editIdea", () => {
  it("updates fields and writes a from=to=SUBMITTED audit row", async () => {
    const ideaId = await makeSubmittedIdea();
    const catId = await activeCategoryId();
    const editClock = new FixedClock(new Date("2026-02-01"));
    const detail = await editIdea(
      ideaId,
      { title: "T1", description: "D1 longer description", categoryId: catId },
      { id: authorId, role: "EMPLOYEE" },
      {
        clock: editClock,
        ids: new StaticIdGenerator(["aud-uuid-aaaa-bbbb-cccc-dddddddddddd"]),
      },
    );
    expect(detail.title).toBe("T1");
    expect(detail.description).toBe("D1 longer description");
    expect(detail.updatedAt).toBe(editClock.now().getTime());

    const audit = await db
      .select()
      .from(statusTransitions)
      .where(sql`${statusTransitions.ideaId} = ${ideaId}`);
    const editRow = audit.find((r) => r.fromState === "SUBMITTED" && r.toState === "SUBMITTED");
    expect(editRow).toBeDefined();
    expect(editRow!.actorId).toBe(authorId);
  });

  it("rejects edits by another user with AUTH_FORBIDDEN_ROLE", async () => {
    const ideaId = await makeSubmittedIdea();
    const catId = await activeCategoryId();
    await expect(
      editIdea(
        ideaId,
        { title: "Hax", description: "Hax body", categoryId: catId },
        { id: strangerId, role: "EMPLOYEE" },
      ),
    ).rejects.toMatchObject({ code: "AUTH_FORBIDDEN_ROLE" });
  });

  it("rejects edits past SUBMITTED with IDEA_NOT_EDITABLE", async () => {
    const ideaId = await makeSubmittedIdea();
    await applyTransition(ideaId, "START_REVIEW", null, {
      id: evaluatorId,
      role: "EVALUATOR",
    });
    const catId = await activeCategoryId();
    await expect(
      editIdea(
        ideaId,
        { title: "Late", description: "Too late to edit", categoryId: catId },
        { id: authorId, role: "EMPLOYEE" },
      ),
    ).rejects.toMatchObject({ code: "IDEA_NOT_EDITABLE" });
  });
});

describe("deleteIdea", () => {
  it("hard-deletes the idea row", async () => {
    const ideaId = await makeSubmittedIdea();
    await deleteIdea(ideaId, { id: authorId, role: "EMPLOYEE" });
    const remaining = await db
      .select()
      .from(ideas)
      .where(sql`${ideas.id} = ${ideaId}`);
    expect(remaining).toHaveLength(0);
    await expect(getIdeaDetail(ideaId)).rejects.toMatchObject({ code: "IDEA_NOT_FOUND" });
  });

  it("refuses deletes by another user", async () => {
    const ideaId = await makeSubmittedIdea();
    await expect(
      deleteIdea(ideaId, { id: strangerId, role: "EMPLOYEE" }),
    ).rejects.toMatchObject({ code: "AUTH_FORBIDDEN_ROLE" });
  });

  it("refuses deletes past SUBMITTED with IDEA_NOT_DELETABLE", async () => {
    const ideaId = await makeSubmittedIdea();
    await applyTransition(ideaId, "START_REVIEW", null, {
      id: evaluatorId,
      role: "EVALUATOR",
    });
    await expect(
      deleteIdea(ideaId, { id: authorId, role: "EMPLOYEE" }),
    ).rejects.toMatchObject({ code: "IDEA_NOT_DELETABLE" });
  });
});
