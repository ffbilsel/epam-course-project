import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { categories, users } from "@/db/schema";
import { sql } from "drizzle-orm";
import { hashPassword } from "@/server/password";
import { createIdea, getIdeaDetail } from "@/server/idea-service";
import { writeSchema } from "@/db/repositories/category-repo";
import type { CategoryFieldDefinition } from "@/lib/validation/category-fields";

let authorId: string;
let catId: string;

const schema: CategoryFieldDefinition[] = [
  { type: "SHORT_TEXT", key: "tool_name", label: "Tool name", required: true },
  { type: "NUMBER", key: "hours", label: "Hours saved", required: false, min: 0, max: 40 },
  {
    type: "SINGLE_CHOICE",
    key: "audience",
    label: "Audience",
    required: true,
    options: [
      { value: "engineering", label: "Engineering teams" },
      { value: "delivery", label: "Delivery teams" },
    ],
  },
  { type: "YES_NO", key: "customer_facing", label: "Customer facing?", required: false },
];

beforeEach(async () => {
  authorId = crypto.randomUUID();
  const now = Date.now();
  await db.insert(users).values({
    id: authorId,
    email: `u${now}-${Math.random()}@e.x`,
    passwordHash: await hashPassword("Passw0rd!"),
    displayName: "Author",
    role: "EMPLOYEE",
    createdAt: now,
    updatedAt: now,
  });
  const rows = await db
    .select()
    .from(categories)
    .where(sql`${categories.state} = 'ACTIVE'`)
    .limit(1);
  catId = rows[0]!.id;
  await writeSchema(catId, schema);
});

describe("idea-service.createIdea — structured answers", () => {
  it("persists answers with label snapshots and roundtrips via detail", async () => {
    const idea = await createIdea(
      {
        title: "Idea",
        description: "Description",
        categoryId: catId,
        answers: {
          tool_name: "Vitest",
          hours: 12,
          audience: "engineering",
          customer_facing: true,
        },
      },
      authorId,
    );
    const detail = await getIdeaDetail(idea.id);
    const byKey = Object.fromEntries(detail.answers.map((a) => [a.key, a]));
    expect(byKey["tool_name"]).toMatchObject({ value: "Vitest", labelSnapshot: "Tool name" });
    expect(byKey["hours"]).toMatchObject({ value: 12 });
    expect(byKey["audience"]).toMatchObject({
      value: "engineering",
      valueLabelSnapshot: "Engineering teams",
    });
    expect(byKey["customer_facing"]).toMatchObject({ value: true });
  });

  it("rejects when a required answer is missing", async () => {
    await expect(
      createIdea(
        {
          title: "Idea",
          description: "Description",
          categoryId: catId,
          answers: { tool_name: "Vitest" },
        },
        authorId,
      ),
    ).rejects.toMatchObject({ code: "IDEA_ANSWER_REQUIRED" });
  });

  it("rejects SINGLE_CHOICE not in options", async () => {
    await expect(
      createIdea(
        {
          title: "Idea",
          description: "Description",
          categoryId: catId,
          answers: { tool_name: "Vitest", audience: "nobody" },
        },
        authorId,
      ),
    ).rejects.toMatchObject({ code: "IDEA_ANSWER_OPTION_INVALID" });
  });

  it("preserves stored snapshot when admin changes a SINGLE_CHOICE label later", async () => {
    const idea = await createIdea(
      {
        title: "Idea",
        description: "Description",
        categoryId: catId,
        answers: {
          tool_name: "Vitest",
          audience: "engineering",
        },
      },
      authorId,
    );
    // Admin renames the option label.
    const updated: CategoryFieldDefinition[] = schema.map((f) =>
      f.key === "audience" && f.type === "SINGLE_CHOICE"
        ? {
            ...f,
            options: [
              { value: "engineering", label: "Engineering org" },
              { value: "delivery", label: "Delivery teams" },
            ],
          }
        : f,
    );
    await writeSchema(catId, updated);
    const detail = await getIdeaDetail(idea.id);
    const ans = detail.answers.find((a) => a.key === "audience");
    expect(ans?.valueLabelSnapshot).toBe("Engineering teams");
  });
});
