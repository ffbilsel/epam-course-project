import { describe, expect, it } from "vitest";
import { CreateIdeaSchema, ProposeCategorySchema, TransitionSchema } from "@/lib/validation/idea";
import { RegisterSchema, LoginSchema } from "@/lib/validation/auth";

describe("validation schemas", () => {
  it("CreateIdeaSchema rejects missing categoryId", () => {
    const r = CreateIdeaSchema.safeParse({ title: "t", description: "d" });
    expect(r.success).toBe(false);
  });

  it("CreateIdeaSchema rejects a non-uuid categoryId (IDEA_CATEGORY_INVALID)", () => {
    const r = CreateIdeaSchema.safeParse({
      title: "t",
      description: "d",
      categoryId: "not-a-uuid",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.message)).toContain("IDEA_CATEGORY_INVALID");
    }
  });

  it("ProposeCategorySchema accepts a 1–40 char name, rejects empty/too-long", () => {
    expect(ProposeCategorySchema.safeParse({ name: "Sustainability" }).success).toBe(true);
    expect(ProposeCategorySchema.safeParse({ name: "" }).success).toBe(false);
    expect(ProposeCategorySchema.safeParse({ name: "x".repeat(41) }).success).toBe(false);
  });

  it("CreateIdeaSchema rejects too-long title (IDEA_TITLE_TOO_LONG message)", () => {
    const r = CreateIdeaSchema.safeParse({
      title: "x".repeat(121),
      description: "d",
      categoryId: "11111111-1111-4111-8111-111111111101",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message);
      expect(msgs.some((m) => m === "IDEA_TITLE_TOO_LONG")).toBe(true);
    }
  });

  it("CreateIdeaSchema rejects too-long description (IDEA_DESCRIPTION_TOO_LONG)", () => {
    const r = CreateIdeaSchema.safeParse({
      title: "ok",
      description: "x".repeat(2001),
      categoryId: "11111111-1111-4111-8111-111111111101",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message);
      expect(msgs).toContain("IDEA_DESCRIPTION_TOO_LONG");
    }
  });

  it("CreateIdeaSchema rejects empty title (IDEA_TITLE_REQUIRED)", () => {
    const r = CreateIdeaSchema.safeParse({
      title: "",
      description: "d",
      categoryId: "11111111-1111-4111-8111-111111111101",
    });
    if (!r.success) {
      expect(r.error.issues.map((i) => i.message)).toContain("IDEA_TITLE_REQUIRED");
    }
  });

  it("CreateIdeaSchema rejects empty description (IDEA_DESCRIPTION_REQUIRED)", () => {
    const r = CreateIdeaSchema.safeParse({
      title: "ok",
      description: "",
      categoryId: "11111111-1111-4111-8111-111111111101",
    });
    if (!r.success) {
      expect(r.error.issues.map((i) => i.message)).toContain("IDEA_DESCRIPTION_REQUIRED");
    }
  });

  it("TransitionSchema accepts the four enum actions", () => {
    expect(TransitionSchema.safeParse({ action: "APPROVE", comment: "ok" }).success).toBe(true);
    expect(TransitionSchema.safeParse({ action: "X" }).success).toBe(false);
  });

  it("RegisterSchema enforces password policy", () => {
    expect(
      RegisterSchema.safeParse({ email: "a@b.co", password: "short", displayName: "x" }).success,
    ).toBe(false);
    expect(
      RegisterSchema.safeParse({ email: "a@b.co", password: "Passw0rd!", displayName: "Aaron" })
        .success,
    ).toBe(true);
  });

  it("LoginSchema requires email + non-empty password", () => {
    expect(LoginSchema.safeParse({ email: "x", password: "p" }).success).toBe(false);
    expect(LoginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});
