import { describe, expect, it } from "vitest";
import {
  AttachmentBatchUploadSchema,
  AttachmentReorderSchema,
  ATTACHMENT_LIMIT,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_TOTAL_MAX_BYTES,
} from "@/lib/validation/attachment";

const file = (size: number, name = "a.png", mimeType = "image/png") => ({ name, size, mimeType });

describe("AttachmentBatchUploadSchema", () => {
  it.each([
    ["1 small file", [file(100)], true],
    ["10 small files", Array.from({ length: ATTACHMENT_LIMIT }, () => file(100)), true],
    ["0 files (empty)", [], false],
    ["11 files", Array.from({ length: ATTACHMENT_LIMIT + 1 }, () => file(100)), false],
    ["single file over per-file cap", [file(ATTACHMENT_MAX_BYTES + 1)], false],
    [
      "total exceeds 100 MB",
      Array.from({ length: 5 }, () => file(ATTACHMENT_TOTAL_MAX_BYTES / 4)),
      false,
    ],
  ])("%s → ok=%s", (_label, files, ok) => {
    expect(AttachmentBatchUploadSchema.safeParse({ files }).success).toBe(ok);
  });
});

describe("AttachmentReorderSchema", () => {
  it.each([
    ["1 id", ["a"], true],
    ["10 ids", Array.from({ length: ATTACHMENT_LIMIT }, (_, i) => `id-${i}`), true],
    ["empty", [], false],
    ["11 ids", Array.from({ length: ATTACHMENT_LIMIT + 1 }, (_, i) => `id-${i}`), false],
    ["duplicate ids", ["a", "a"], false],
  ])("%s → ok=%s", (_label, orderedIds, ok) => {
    expect(AttachmentReorderSchema.safeParse({ orderedIds }).success).toBe(ok);
  });
});
