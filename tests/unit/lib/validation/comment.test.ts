import { describe, expect, it } from "vitest";
import { CommentEditSchema, CommentPostSchema } from "@/lib/validation/comment";

describe("CommentPostSchema", () => {
  it("accepts a short body", () => {
    expect(CommentPostSchema.safeParse({ body: "hello" }).success).toBe(true);
  });
  it("preserves embedded LF", () => {
    const r = CommentPostSchema.safeParse({ body: "line1\nline2" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.body).toBe("line1\nline2");
  });
  it("rejects empty body", () => {
    expect(CommentPostSchema.safeParse({ body: "  " }).success).toBe(false);
  });
  it("rejects bodies over 2000 chars", () => {
    expect(CommentPostSchema.safeParse({ body: "a".repeat(2001) }).success).toBe(false);
  });
  it("accepts a parentId", () => {
    expect(
      CommentPostSchema.safeParse({
        body: "reply",
        parentId: "11111111-1111-1111-1111-111111111111",
      }).success,
    ).toBe(true);
  });
});

describe("CommentEditSchema", () => {
  it("requires a non-empty body", () => {
    expect(CommentEditSchema.safeParse({ body: "" }).success).toBe(false);
    expect(CommentEditSchema.safeParse({ body: "edited" }).success).toBe(true);
  });
});
