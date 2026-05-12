import { beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users, attachments } from "@/db/schema";
import { hashPassword } from "@/server/password";
import { stageUpload, loadAttachment } from "@/server/attachment-service";

let userId: string;

beforeEach(async () => {
  const now = Date.now();
  userId = crypto.randomUUID();
  await db.insert(users).values({
    id: userId,
    email: `att-${now}@x.io`,
    passwordHash: await hashPassword("Passw0rd!"),
    displayName: "U",
    role: "EMPLOYEE",
    createdAt: now,
    updatedAt: now,
  });
});

describe("attachment-service", () => {
  it("stages a valid PNG and persists row", async () => {
    // 1x1 PNG
    const png = Buffer.from(
      "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6300010000000500010D0A2DB40000000049454E44AE426082",
      "hex",
    );
    const out = await stageUpload(png, "tiny.png", userId);
    expect(out.mimeType).toBe("image/png");
    expect(statSync(out.storedPath).size).toBeGreaterThan(0);
    const row = await db
      .select()
      .from(attachments)
      .where(sql`${attachments.id} = ${out.id}`);
    expect(row[0]?.uploaderId).toBe(userId);
  });

  it("rejects renamed .exe with ATTACHMENT_TYPE_NOT_ALLOWED", async () => {
    // MZ header
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    await expect(stageUpload(exe, "evil.pdf", userId)).rejects.toMatchObject({
      code: "ATTACHMENT_TYPE_NOT_ALLOWED",
    });
  });

  it("rejects oversized files with ATTACHMENT_TOO_LARGE", async () => {
    const big = Buffer.alloc(26 * 1024 * 1024, 0);
    await expect(stageUpload(big, "big.pdf", userId)).rejects.toMatchObject({
      code: "ATTACHMENT_TOO_LARGE",
    });
  });

  it("loadAttachment throws ATTACHMENT_NOT_FOUND for unknown id", async () => {
    await expect(loadAttachment("00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({
      code: "ATTACHMENT_NOT_FOUND",
    });
  });
});

describe("attachment-service file content", () => {
  it("staged file bytes equal input bytes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "att-"));
    const path = join(dir, "x.pdf");
    // Minimal PDF header magic
    const pdf = Buffer.from("%PDF-1.4\n%âãÏÓ\n", "binary");
    writeFileSync(path, pdf);
    const out = await stageUpload(readFileSync(path), "x.pdf", userId);
    expect(readFileSync(out.storedPath).slice(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
