import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, users } from "@/db/schema";
import { hashPassword } from "@/server/password";
import { createIdea } from "@/server/idea-service";
import {
  attachToIdea,
  listForIdea,
  reorderAttachments,
  removeAttachment,
  previewKindFor,
} from "@/server/attachment-service";

// 1x1 PNG (sniffable)
const PNG = Buffer.from(
  "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6300010000000500010D0A2DB40000000049454E44AE426082",
  "hex",
);

let authorId: string;
let otherId: string;
let categoryId: string;
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
  otherId = crypto.randomUUID();
  await db.insert(users).values([
    {
      id: authorId,
      email: `a-${now}@x.io`,
      passwordHash: await hashPassword("Passw0rd!"),
      displayName: "A",
      role: "EMPLOYEE",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: otherId,
      email: `b-${now}@x.io`,
      passwordHash: await hashPassword("Passw0rd!"),
      displayName: "B",
      role: "EMPLOYEE",
      createdAt: now,
      updatedAt: now,
    },
  ]);
  categoryId = await activeCategoryId();
  const idea = await createIdea({ title: "T", description: "D", categoryId }, authorId);
  ideaId = idea.id;
});

describe("attachment-service.attachToIdea", () => {
  it("attaches a batch and orders them", async () => {
    const items = await attachToIdea({
      ideaId,
      files: [
        { buffer: PNG, originalName: "a.png" },
        { buffer: PNG, originalName: "b.png" },
      ],
      actor: { id: authorId, role: "EMPLOYEE" },
    });
    expect(items).toHaveLength(2);
    expect(items[0]!.displayOrder).toBe(0);
    expect(items[1]!.displayOrder).toBe(1);
    expect(items[0]!.previewKind).toBe("image");
  });

  it("rejects non-author with ATTACHMENT_FORBIDDEN", async () => {
    await expect(
      attachToIdea({
        ideaId,
        files: [{ buffer: PNG, originalName: "x.png" }],
        actor: { id: otherId, role: "EMPLOYEE" },
      }),
    ).rejects.toMatchObject({ code: "ATTACHMENT_FORBIDDEN" });
  });

  it("rejects an 11th attachment with ATTACHMENT_LIMIT_EXCEEDED", async () => {
    const files = Array.from({ length: 10 }, (_, i) => ({
      buffer: PNG,
      originalName: `f${i}.png`,
    }));
    await attachToIdea({
      ideaId,
      files,
      actor: { id: authorId, role: "EMPLOYEE" },
    });
    await expect(
      attachToIdea({
        ideaId,
        files: [{ buffer: PNG, originalName: "over.png" }],
        actor: { id: authorId, role: "EMPLOYEE" },
      }),
    ).rejects.toMatchObject({ code: "ATTACHMENT_LIMIT_EXCEEDED" });
  });
});

describe("attachment-service.reorderAttachments", () => {
  it("reorders the attachment list", async () => {
    const items = await attachToIdea({
      ideaId,
      files: [
        { buffer: PNG, originalName: "a.png" },
        { buffer: PNG, originalName: "b.png" },
      ],
      actor: { id: authorId, role: "EMPLOYEE" },
    });
    const reversed = [items[1]!.id, items[0]!.id];
    await reorderAttachments({
      ideaId,
      orderedIds: reversed,
      actor: { id: authorId, role: "EMPLOYEE" },
    });
    const after = await listForIdea({
      ideaId,
      viewer: { id: authorId, role: "EMPLOYEE" },
    });
    expect(after.map((a) => a.id)).toEqual(reversed);
  });

  it("rejects unknown id with ATTACHMENT_ORDER_INVALID", async () => {
    const items = await attachToIdea({
      ideaId,
      files: [{ buffer: PNG, originalName: "a.png" }],
      actor: { id: authorId, role: "EMPLOYEE" },
    });
    await expect(
      reorderAttachments({
        ideaId,
        orderedIds: [items[0]!.id, "00000000-0000-4000-8000-000000000000"],
        actor: { id: authorId, role: "EMPLOYEE" },
      }),
    ).rejects.toMatchObject({ code: "ATTACHMENT_ORDER_INVALID" });
  });
});

describe("attachment-service.removeAttachment", () => {
  it("removes an attachment by author", async () => {
    const items = await attachToIdea({
      ideaId,
      files: [{ buffer: PNG, originalName: "a.png" }],
      actor: { id: authorId, role: "EMPLOYEE" },
    });
    await removeAttachment({
      attachmentId: items[0]!.id,
      actor: { id: authorId, role: "EMPLOYEE" },
    });
    const after = await listForIdea({
      ideaId,
      viewer: { id: authorId, role: "EMPLOYEE" },
    });
    expect(after).toHaveLength(0);
  });
});

describe("attachment-service.listForIdea", () => {
  it("evaluator can list any idea's attachments", async () => {
    await attachToIdea({
      ideaId,
      files: [{ buffer: PNG, originalName: "a.png" }],
      actor: { id: authorId, role: "EMPLOYEE" },
    });
    const items = await listForIdea({
      ideaId,
      viewer: { id: otherId, role: "EVALUATOR" },
    });
    expect(items).toHaveLength(1);
  });

  it("non-author EMPLOYEE is forbidden", async () => {
    await expect(
      listForIdea({ ideaId, viewer: { id: otherId, role: "EMPLOYEE" } }),
    ).rejects.toMatchObject({ code: "ATTACHMENT_FORBIDDEN" });
  });
});

describe("previewKindFor", () => {
  it.each([
    ["image/png", "image"],
    ["application/pdf", "pdf"],
    ["text/markdown", "text"],
    ["text/plain", "text"],
    ["image/svg+xml", "download"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "download"],
  ] as const)("maps %s to %s", (mime, kind) => {
    expect(previewKindFor(mime)).toBe(kind);
  });
});
