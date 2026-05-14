import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { categories, users } from "@/db/schema";
import { sql } from "drizzle-orm";
import { hashPassword } from "@/server/password";
import {
  saveDraft,
  loadDraft,
  listMyDrafts,
  deleteDraft,
  submitDraft,
} from "@/server/draft-service";
import { AppError } from "@/lib/errors/AppError";

let authorId: string;
let otherId: string;

beforeEach(async () => {
  const now = Date.now();
  authorId = crypto.randomUUID();
  otherId = crypto.randomUUID();
  await db.insert(users).values([
    {
      id: authorId,
      email: `a${now}@e.x`,
      passwordHash: await hashPassword("Passw0rd!"),
      displayName: "Author",
      role: "EMPLOYEE",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: otherId,
      email: `b${now}@e.x`,
      passwordHash: await hashPassword("Passw0rd!"),
      displayName: "Other",
      role: "EMPLOYEE",
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

describe("draft-service", () => {
  it("creates, edits, lists, and deletes a draft (author-only)", async () => {
    const draft = await saveDraft(
      { title: "draft 1", description: "first", categoryId: null },
      { id: authorId },
    );
    expect(draft.title).toBe("draft 1");

    const updated = await saveDraft({ id: draft.id, title: "draft 2" }, { id: authorId });
    expect(updated.title).toBe("draft 2");
    expect(updated.description).toBe("first");

    const list = await listMyDrafts(authorId);
    expect(list.map((d) => d.id)).toContain(draft.id);

    await deleteDraft(draft.id, { id: authorId });
    const after = await listMyDrafts(authorId);
    expect(after.map((d) => d.id)).not.toContain(draft.id);
  });

  it("refuses cross-author access", async () => {
    const draft = await saveDraft({ title: "secret" }, { id: authorId });
    await expect(loadDraft(draft.id, { id: otherId })).rejects.toMatchObject({
      code: "DRAFT_FORBIDDEN",
    });
    await expect(deleteDraft(draft.id, { id: otherId })).rejects.toMatchObject({
      code: "DRAFT_FORBIDDEN",
    });
  });

  it("submits a complete draft and removes it", async () => {
    const catId = await activeCategoryId();
    const draft = await saveDraft(
      { title: "ready", description: "go", categoryId: catId },
      { id: authorId },
    );
    const result = await submitDraft(draft.id, { id: authorId, role: "EMPLOYEE" });
    expect(result.ideaId).toBeTruthy();
    await expect(loadDraft(draft.id, { id: authorId })).rejects.toBeInstanceOf(AppError);
  });

  it("rejects submitting an incomplete draft with DRAFT_VALIDATION", async () => {
    const draft = await saveDraft({ title: "no body" }, { id: authorId });
    await expect(submitDraft(draft.id, { id: authorId, role: "EMPLOYEE" })).rejects.toMatchObject({
      code: "DRAFT_VALIDATION",
    });
  });
});
