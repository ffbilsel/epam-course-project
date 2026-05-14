import { describe, expect, it } from "vitest";
import { SaveDraftSchema, SubmitDraftSchema } from "@/lib/validation/draft";

describe("SaveDraftSchema", () => {
  it("accepts an empty payload (every field optional)", () => {
    expect(SaveDraftSchema.safeParse({}).success).toBe(true);
  });
  it("rejects a too-long title", () => {
    expect(SaveDraftSchema.safeParse({ title: "x".repeat(121) }).success).toBe(false);
  });
});

describe("SubmitDraftSchema", () => {
  it("rejects a draft missing required fields", () => {
    expect(SubmitDraftSchema.safeParse({}).success).toBe(false);
  });
  it("accepts a complete draft body", () => {
    const r = SubmitDraftSchema.safeParse({
      title: "ready",
      description: "to go",
      categoryId: "11111111-1111-1111-1111-111111111111",
    });
    expect(r.success).toBe(true);
  });
});
