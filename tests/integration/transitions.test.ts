import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, ideas, statusTransitions, users } from "@/db/schema";
import { hashPassword } from "@/server/password";
import { createIdea, applyTransition } from "@/server/idea-service";
import { FixedClock } from "@/server/infra/clock";

let authorId: string;
let evaluatorId: string;
let adminId: string;

beforeEach(async () => {
  const now = Date.now();
  const hash = await hashPassword("Passw0rd!");
  authorId = crypto.randomUUID();
  evaluatorId = crypto.randomUUID();
  adminId = crypto.randomUUID();
  await db.insert(users).values([
    {
      id: authorId,
      email: `a${now}@x.io`,
      passwordHash: hash,
      displayName: "A",
      role: "EMPLOYEE",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: evaluatorId,
      email: `e${now}@x.io`,
      passwordHash: hash,
      displayName: "E",
      role: "EVALUATOR",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: adminId,
      email: `ad${now}@x.io`,
      passwordHash: hash,
      displayName: "Ad",
      role: "ADMIN",
      createdAt: now,
      updatedAt: now,
    },
  ]);
});

async function makeIdea(): Promise<string> {
  const cat = await db
    .select()
    .from(categories)
    .where(sql`${categories.name} = 'Other'`)
    .limit(1);
  const idea = await createIdea(
    { title: "x", description: "y", categoryId: cat[0]!.id },
    authorId,
    { clock: new FixedClock(new Date("2026-01-01")), ids: { next: () => crypto.randomUUID() } },
  );
  return idea.id;
}

describe("transitions", () => {
  it("START_REVIEW → APPROVE happy path writes a transition row", async () => {
    const id = await makeIdea();
    await applyTransition(id, "START_REVIEW", null, { id: evaluatorId, role: "EVALUATOR" });
    const after = await applyTransition(id, "APPROVE", "looks good", {
      id: evaluatorId,
      role: "EVALUATOR",
    });
    expect(after.status).toBe("APPROVED");
    const trs = await db
      .select()
      .from(statusTransitions)
      .where(sql`${statusTransitions.ideaId} = ${id}`);
    expect(trs).toHaveLength(2);
  });

  it("APPROVE without comment → IDEA_COMMENT_REQUIRED", async () => {
    const id = await makeIdea();
    await applyTransition(id, "START_REVIEW", null, { id: evaluatorId, role: "EVALUATOR" });
    await expect(
      applyTransition(id, "APPROVE", "  ", { id: evaluatorId, role: "EVALUATOR" }),
    ).rejects.toMatchObject({ code: "IDEA_COMMENT_REQUIRED" });
  });

  it("self-evaluation → IDEA_SELF_EVALUATION_FORBIDDEN", async () => {
    const id = await makeIdea();
    // promote author to evaluator for the test
    await db
      .update(users)
      .set({ role: "EVALUATOR" })
      .where(sql`${users.id} = ${authorId}`);
    await expect(
      applyTransition(id, "START_REVIEW", null, { id: authorId, role: "EVALUATOR" }),
    ).rejects.toMatchObject({ code: "IDEA_SELF_EVALUATION_FORBIDDEN" });
  });

  it("IMPLEMENT by EVALUATOR → AUTH_FORBIDDEN_ROLE; by ADMIN → IMPLEMENTED", async () => {
    const id = await makeIdea();
    await applyTransition(id, "START_REVIEW", null, { id: evaluatorId, role: "EVALUATOR" });
    await applyTransition(id, "APPROVE", "ok", { id: evaluatorId, role: "EVALUATOR" });
    await expect(
      applyTransition(id, "IMPLEMENT", null, { id: evaluatorId, role: "EVALUATOR" }),
    ).rejects.toMatchObject({ code: "AUTH_FORBIDDEN_ROLE" });
    const out = await applyTransition(id, "IMPLEMENT", null, { id: adminId, role: "ADMIN" });
    expect(out.status).toBe("IMPLEMENTED");
  });

  it("APPROVE again → IDEA_ALREADY_DECIDED", async () => {
    const id = await makeIdea();
    await applyTransition(id, "START_REVIEW", null, { id: evaluatorId, role: "EVALUATOR" });
    await applyTransition(id, "APPROVE", "ok", { id: evaluatorId, role: "EVALUATOR" });
    await expect(
      applyTransition(id, "APPROVE", "again", { id: evaluatorId, role: "EVALUATOR" }),
    ).rejects.toMatchObject({ code: "IDEA_ALREADY_DECIDED" });
  });

  it("category PROPOSED → IDEA_CATEGORY_PENDING blocks transition", async () => {
    // create idea with a proposed category
    const idea = await createIdea(
      { title: "p", description: "d", proposedCategoryName: "Pending-Cat-" + Date.now() },
      authorId,
    );
    await expect(
      applyTransition(idea.id, "START_REVIEW", null, { id: evaluatorId, role: "EVALUATOR" }),
    ).rejects.toMatchObject({ code: "IDEA_CATEGORY_PENDING" });
  });

  it("transition on missing idea → IDEA_NOT_FOUND", async () => {
    await expect(
      applyTransition("00000000-0000-4000-8000-000000000000", "START_REVIEW", null, {
        id: evaluatorId,
        role: "EVALUATOR",
      }),
    ).rejects.toMatchObject({ code: "IDEA_NOT_FOUND" });
  });

  it("invalid action shape from undefined idea → IDEA_INVALID_TRANSITION", async () => {
    const id = await makeIdea();
    // IMPLEMENT from SUBMITTED is invalid for ADMIN too
    await expect(
      applyTransition(id, "IMPLEMENT", null, { id: adminId, role: "ADMIN" }),
    ).rejects.toMatchObject({ code: "IDEA_INVALID_TRANSITION" });
  });

  it("listIdeaTransitions exposes audit rows", async () => {
    const id = await makeIdea();
    await applyTransition(id, "START_REVIEW", null, { id: evaluatorId, role: "EVALUATOR" });
    const trs = await db
      .select()
      .from(statusTransitions)
      .where(sql`${statusTransitions.ideaId} = ${id}`);
    expect(trs[0]?.actorId).toBe(evaluatorId);
  });

  it("status transitions table records both states", async () => {
    const id = await makeIdea();
    await applyTransition(id, "START_REVIEW", null, { id: evaluatorId, role: "EVALUATOR" });
    const trs = await db.select().from(statusTransitions);
    const last = trs.at(-1);
    expect(last?.fromState).toBe("SUBMITTED");
    expect(last?.toState).toBe("UNDER_REVIEW");
  });

  it("idea row updates updated_at on transition", async () => {
    const id = await makeIdea();
    await applyTransition(id, "START_REVIEW", null, { id: evaluatorId, role: "EVALUATOR" });
    const r = await db
      .select()
      .from(ideas)
      .where(sql`${ideas.id} = ${id}`);
    expect(r[0]?.status).toBe("UNDER_REVIEW");
  });
});
