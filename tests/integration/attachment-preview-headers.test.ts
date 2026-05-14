import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/db/client";
import { attachments, categories, users } from "@/db/schema";
import { hashPassword } from "@/server/password";
import { createIdea } from "@/server/idea-service";
import { attachToIdea } from "@/server/attachment-service";

// Mock the auth() resolver used inside requireSession.
vi.mock("@/server/auth-options", () => ({
  auth: vi.fn(),
}));
import { auth } from "@/server/auth-options";

import { GET } from "@/app/api/attachments/[id]/preview/route";

const PNG = Buffer.from(
  "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6300010000000500010D0A2DB40000000049454E44AE426082",
  "hex",
);

let authorId: string;
let ideaId: string;

async function activeCategoryId(): Promise<string> {
  const rows = await db
    .select()
    .from(categories)
    .where(sql`${categories.name} = 'Other'`)
    .limit(1);
  return rows[0]!.id;
}

function makeRequest(): never {
  // route handler doesn't read the request body in our tests
  return new Request("http://localhost/preview") as never;
}

beforeEach(async () => {
  const now = Date.now();
  authorId = crypto.randomUUID();
  await db.insert(users).values({
    id: authorId,
    email: `prev-${now}@x.io`,
    passwordHash: await hashPassword("Passw0rd!"),
    displayName: "P",
    role: "EMPLOYEE",
    createdAt: now,
    updatedAt: now,
  });
  const idea = await createIdea(
    { title: "T", description: "D", categoryId: await activeCategoryId() },
    authorId,
  );
  ideaId = idea.id;
  vi.mocked(auth).mockResolvedValue({
    user: { id: authorId, role: "EMPLOYEE", email: "p@x", displayName: "P" },
  } as never);
});

describe("preview route headers", () => {
  it("PNG: 200 with inline + sandbox + nosniff", async () => {
    const [att] = await attachToIdea({
      ideaId,
      files: [{ buffer: PNG, originalName: "a.png" }],
      actor: { id: authorId, role: "EMPLOYEE" },
    });
    const res = await GET(makeRequest(), { params: { id: att!.id } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toMatch(/^inline; filename="a\.png"/);
    expect(res.headers.get("Content-Security-Policy")).toBe("sandbox");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  it("Markdown: returns sanitised HTML body", async () => {
    // Insert a text/markdown attachment directly (file-type cannot sniff plain text).
    const id = crypto.randomUUID();
    const dir = join(process.cwd(), "data", "uploads", ideaId);
    mkdirSync(dir, { recursive: true });
    const storedPath = join(dir, `${id}__note.md`);
    writeFileSync(storedPath, "# Title\n<script>alert(1)</script>\n[ok](http://x)");
    await db.insert(attachments).values({
      id,
      ideaId,
      uploaderId: authorId,
      originalName: "note.md",
      storedPath,
      mimeType: "text/markdown",
      sizeBytes: 64,
      uploadedAt: Date.now(),
      displayOrder: 0,
    });
    const res = await GET(makeRequest(), { params: { id } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("Content-Security-Policy")).toBe("sandbox");
    const body = await res.text();
    expect(body).not.toContain("<script>");
  });

  it("SVG: returns 415 ATTACHMENT_PREVIEW_UNSUPPORTED", async () => {
    const id = crypto.randomUUID();
    const dir = join(process.cwd(), "data", "uploads", ideaId);
    mkdirSync(dir, { recursive: true });
    const storedPath = join(dir, `${id}__x.svg`);
    writeFileSync(storedPath, "<svg/>");
    await db.insert(attachments).values({
      id,
      ideaId,
      uploaderId: authorId,
      originalName: "x.svg",
      storedPath,
      mimeType: "image/svg+xml",
      sizeBytes: 6,
      uploadedAt: Date.now(),
      displayOrder: 0,
    });
    const res = await GET(makeRequest(), { params: { id } });
    expect(res.status).toBe(415);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("ATTACHMENT_PREVIEW_UNSUPPORTED");
  });
});
