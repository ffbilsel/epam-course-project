import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, users } from "@/db/schema";
import { hashPassword } from "@/server/password";
import { createIdea, applyTransition } from "@/server/idea-service";
import { streamIdeasCsv } from "@/server/idea-export";
import { ListingQuerySchema } from "@/lib/validation/idea";
import { FixedClock } from "@/server/infra/clock";
import { AppError } from "@/lib/errors/AppError";

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
      email: `ea${now}@x.io`,
      passwordHash: hash,
      displayName: "Alice Author",
      role: "EMPLOYEE",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: authorB,
      email: `eb${now}@x.io`,
      passwordHash: hash,
      displayName: "Bob Author",
      role: "EMPLOYEE",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: evaluatorId,
      email: `eve${now}@x.io`,
      passwordHash: hash,
      displayName: "Eve Reviewer",
      role: "EVALUATOR",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: adminId,
      email: `ad${now}@x.io`,
      passwordHash: hash,
      displayName: "Ada Admin",
      role: "ADMIN",
      createdAt: now,
      updatedAt: now,
    },
  ]);
  const cats = await db.select().from(categories).where(sql`${categories.state} = 'ACTIVE'`);
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

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.length;
  }
  return new TextDecoder().decode(buf);
}

function q(input: Record<string, unknown>) {
  return ListingQuerySchema.parse({ scope: "all", ...input });
}

describe("streamIdeasCsv", () => {
  it("rejects non-admin callers with AUTH_FORBIDDEN_ROLE", async () => {
    await expect(
      streamIdeasCsv(q({}), { id: evaluatorId, role: "EVALUATOR" }),
    ).rejects.toMatchObject({ code: "AUTH_FORBIDDEN_ROLE" });
    await expect(
      streamIdeasCsv(q({}), { id: authorA, role: "EMPLOYEE" }),
    ).rejects.toMatchObject({ code: "AUTH_FORBIDDEN_ROLE" });
  });

  it("emits a header row matching the data-model contract", async () => {
    const stream = await streamIdeasCsv(q({}), { id: adminId, role: "ADMIN" });
    const csv = await drain(stream);
    const header = csv.split("\r\n")[0];
    expect(header).toBe(
      "id,title,status,category,author_email,created_at,updated_at,latest_decision_at,latest_decision_actor,latest_decision_comment",
    );
  });

  it("escapes RFC 4180 special characters in cells", async () => {
    await seed({
      authorId: authorA,
      title: 'Quote, "comma"',
      categoryId: processCatId,
      createdAt: new Date("2026-03-01"),
      description: "Line1\r\nLine2",
    });
    const stream = await streamIdeasCsv(q({}), { id: adminId, role: "ADMIN" });
    const csv = await drain(stream);
    expect(csv).toContain('"Quote, ""comma"""');
  });

  it("row count matches the filtered listing total", async () => {
    await seed({
      authorId: authorA,
      title: "Proc-A",
      categoryId: processCatId,
      createdAt: new Date("2026-04-01"),
    });
    await seed({
      authorId: authorB,
      title: "Proc-B",
      categoryId: processCatId,
      createdAt: new Date("2026-04-02"),
    });
    await seed({
      authorId: authorA,
      title: "Cost-A",
      categoryId: costCatId,
      createdAt: new Date("2026-04-03"),
    });
    const stream = await streamIdeasCsv(
      q({ categoryId: processCatId }),
      { id: adminId, role: "ADMIN" },
    );
    const csv = await drain(stream);
    const lines = csv.split("\r\n").filter((l) => l.length > 0);
    // header + 2 data rows for the process category
    expect(lines.length).toBe(3);
    expect(csv).toContain("Proc-A");
    expect(csv).toContain("Proc-B");
    expect(csv).not.toContain("Cost-A");
  });

  it("includes latest decision metadata for transitioned ideas", async () => {
    const id = await seed({
      authorId: authorA,
      title: "Approved one",
      categoryId: processCatId,
      createdAt: new Date("2026-05-01"),
    });
    await applyTransition(id, "START_REVIEW", null, { id: evaluatorId, role: "EVALUATOR" });
    await applyTransition(id, "APPROVE", "looks good", {
      id: evaluatorId,
      role: "EVALUATOR",
    });
    const stream = await streamIdeasCsv(q({}), { id: adminId, role: "ADMIN" });
    const csv = await drain(stream);
    const row = csv.split("\r\n").find((l) => l.includes("Approved one"))!;
    expect(row).toContain("APPROVED");
    expect(row).toContain("Eve Reviewer");
    expect(row).toContain("looks good");
  });
});

// `AppError` shape check used by the first test — keeps the import
// from being elided by aggressive bundlers.
void AppError;
