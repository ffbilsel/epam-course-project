import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, users } from "@/db/schema";
import { hashPassword } from "@/server/password";
import { createIdea, applyTransition } from "@/server/idea-service";
import { runListingQuery } from "@/server/idea-listing";
import { ListingQuerySchema } from "@/lib/validation/idea";
import { FixedClock } from "@/server/infra/clock";
import { scoreRequiredForApprove } from "../helpers/score-required";

let authorA: string;
let authorB: string;
let evaluatorId: string;
let adminId: string;
let processCatId: string;
let costCatId: string;

beforeEach(async () => {
  const hash = await hashPassword("Passw0rd!");
  const now = Date.now();
  authorA = crypto.randomUUID();
  authorB = crypto.randomUUID();
  evaluatorId = crypto.randomUUID();
  adminId = crypto.randomUUID();
  await db.insert(users).values([
    {
      id: authorA,
      email: `a${now}@x.io`,
      passwordHash: hash,
      displayName: "Author A",
      role: "EMPLOYEE",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: authorB,
      email: `b${now}@x.io`,
      passwordHash: hash,
      displayName: "Author B",
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
      email: `ad${now}@x.io`,
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
    .where(sql`${categories.state} = 'ACTIVE'`);
  // Pick two ACTIVE categories whose field_schema is empty so we
  // can seed ideas without structured-answer payloads.
  const emptySchemaCats = cats.filter((c) => c.fieldSchema === "[]");
  expect(emptySchemaCats.length).toBeGreaterThanOrEqual(2);
  processCatId = emptySchemaCats[0]!.id;
  costCatId = emptySchemaCats[1]!.id;
});

async function seed(opts: {
  authorId: string;
  title: string;
  categoryId: string;
  createdAt: Date;
  description?: string;
}): Promise<string> {
  const idea = await createIdea(
    {
      title: opts.title,
      description: opts.description ?? "lorem ipsum body",
      categoryId: opts.categoryId,
    },
    opts.authorId,
    {
      clock: new FixedClock(opts.createdAt),
      ids: { next: () => crypto.randomUUID() },
    },
  );
  return idea.id;
}

function q(input: Record<string, unknown>) {
  return ListingQuerySchema.parse({ scope: "mine", ...input });
}

describe("runListingQuery", () => {
  it("mine scope only returns the caller's ideas", async () => {
    await seed({
      authorId: authorA,
      title: "A1",
      categoryId: processCatId,
      createdAt: new Date("2026-01-01"),
    });
    await seed({
      authorId: authorB,
      title: "B1",
      categoryId: processCatId,
      createdAt: new Date("2026-01-02"),
    });
    const page = await runListingQuery(q({}), { id: authorA, role: "EMPLOYEE" });
    expect(page.rows.map((r) => r.title)).toEqual(["A1"]);
  });

  it("queue scope only returns SUBMITTED + UNDER_REVIEW (and not APPROVED)", async () => {
    const i1 = await seed({
      authorId: authorA,
      title: "Pending",
      categoryId: processCatId,
      createdAt: new Date("2026-01-01"),
    });
    const i2 = await seed({
      authorId: authorA,
      title: "ToApprove",
      categoryId: processCatId,
      createdAt: new Date("2026-01-02"),
    });
    await applyTransition(i2, "START_REVIEW", null, {
      id: evaluatorId,
      role: "EVALUATOR",
    });
    await scoreRequiredForApprove(i2, evaluatorId);
    await applyTransition(i2, "APPROVE", "ok", { id: evaluatorId, role: "EVALUATOR" });
    void i1;
    const page = await runListingQuery(q({ scope: "queue" }), {
      id: evaluatorId,
      role: "EVALUATOR",
    });
    expect(page.rows.map((r) => r.title).sort()).toEqual(["Pending"]);
  });

  it("scope=all is unrestricted and reserved for admin", async () => {
    await seed({
      authorId: authorA,
      title: "A-cost",
      categoryId: costCatId,
      createdAt: new Date("2026-02-01"),
    });
    await seed({
      authorId: authorB,
      title: "B-proc",
      categoryId: processCatId,
      createdAt: new Date("2026-02-02"),
    });
    const adminPage = await runListingQuery(q({ scope: "all" }), {
      id: adminId,
      role: "ADMIN",
    });
    expect(adminPage.rows.length).toBeGreaterThanOrEqual(2);
    await expect(
      runListingQuery(q({ scope: "all" }), { id: evaluatorId, role: "EVALUATOR" }),
    ).rejects.toMatchObject({ code: "AUTH_FORBIDDEN_ROLE" });
  });

  it("applies AND semantics across q + categoryId + date range", async () => {
    await seed({
      authorId: authorA,
      title: "Better Coffee",
      categoryId: processCatId,
      createdAt: new Date("2026-03-10"),
    });
    await seed({
      authorId: authorA,
      title: "Coffee Cost Cut",
      categoryId: costCatId,
      createdAt: new Date("2026-03-15"),
    });
    await seed({
      authorId: authorA,
      title: "Coffee Cost Cut II",
      categoryId: costCatId,
      createdAt: new Date("2026-04-01"),
    });
    const page = await runListingQuery(
      q({
        scope: "mine",
        q: "coffee",
        categoryId: costCatId,
        from: "2026-03-01",
        to: "2026-03-31",
      }),
      { id: authorA, role: "EMPLOYEE" },
    );
    expect(page.rows.map((r) => r.title)).toEqual(["Coffee Cost Cut"]);
  });

  it("q is case-insensitive", async () => {
    await seed({
      authorId: authorA,
      title: "MIXED Case",
      categoryId: processCatId,
      createdAt: new Date("2026-04-01"),
    });
    const page = await runListingQuery(q({ q: "mixed" }), {
      id: authorA,
      role: "EMPLOYEE",
    });
    expect(page.rows).toHaveLength(1);
  });

  it("clamps page to last available when out of range", async () => {
    for (let n = 0; n < 3; n++) {
      await seed({
        authorId: authorA,
        title: `T${n}`,
        categoryId: processCatId,
        createdAt: new Date(2026, 0, n + 1),
      });
    }
    const page = await runListingQuery(q({ page: 50, pageSize: 20 }), {
      id: authorA,
      role: "EMPLOYEE",
    });
    expect(page.page).toBe(1);
    expect(page.totalPages).toBe(1);
    expect(page.rows).toHaveLength(3);
  });
});
