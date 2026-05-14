import { describe, expect, it } from "vitest";
import { NotificationKindEnum, NotificationPayloadSchema } from "@/lib/validation/notification";

describe("NotificationKindEnum", () => {
  it.each([
    ["STATUS_CHANGED", true],
    ["COMMENT_ADDED", true],
    ["RATING_ADDED", true],
    ["REPLY_ON_REVIEW", true],
    ["BULK_DIGEST", true],
    ["UNKNOWN", false],
  ])("kind %s → ok=%s", (kind, ok) => {
    expect(NotificationKindEnum.safeParse(kind).success).toBe(ok);
  });
});

describe("NotificationPayloadSchema", () => {
  it("accepts a STATUS_CHANGED payload", () => {
    const r = NotificationPayloadSchema.safeParse({
      kind: "STATUS_CHANGED",
      ideaTitle: "Idea",
      fromState: "SUBMITTED",
      toState: "UNDER_REVIEW",
      actorDisplayName: "Reviewer",
    });
    expect(r.success).toBe(true);
  });
  it("accepts a COMMENT_ADDED payload", () => {
    const r = NotificationPayloadSchema.safeParse({
      kind: "COMMENT_ADDED",
      ideaTitle: "Idea",
      snippet: "Hello",
      actorDisplayName: "Reviewer",
    });
    expect(r.success).toBe(true);
  });
  it("accepts a RATING_ADDED payload", () => {
    const r = NotificationPayloadSchema.safeParse({
      kind: "RATING_ADDED",
      ideaTitle: "Idea",
      perDimension: [{ label: "Impact", score: 5 }],
      actorDisplayName: "Reviewer",
    });
    expect(r.success).toBe(true);
  });
  it("accepts a REPLY_ON_REVIEW payload", () => {
    const r = NotificationPayloadSchema.safeParse({
      kind: "REPLY_ON_REVIEW",
      ideaTitle: "Idea",
      snippet: "Hi",
      actorDisplayName: "Author",
    });
    expect(r.success).toBe(true);
  });
  it("accepts a BULK_DIGEST payload with at least one item", () => {
    const r = NotificationPayloadSchema.safeParse({
      kind: "BULK_DIGEST",
      actorDisplayName: "Admin",
      items: [
        { ideaId: "i1", ideaTitle: "Idea 1", fromState: "SUBMITTED", toState: "APPROVED" },
      ],
    });
    expect(r.success).toBe(true);
  });
  it("rejects a payload with unknown kind", () => {
    const r = NotificationPayloadSchema.safeParse({
      kind: "UNKNOWN",
      ideaTitle: "Idea",
    });
    expect(r.success).toBe(false);
  });
  it("rejects RATING_ADDED with score 6", () => {
    const r = NotificationPayloadSchema.safeParse({
      kind: "RATING_ADDED",
      ideaTitle: "Idea",
      perDimension: [{ label: "Impact", score: 6 }],
      actorDisplayName: "Reviewer",
    });
    expect(r.success).toBe(false);
  });
  it("rejects COMMENT_ADDED with snippet > 280 chars", () => {
    const r = NotificationPayloadSchema.safeParse({
      kind: "COMMENT_ADDED",
      ideaTitle: "Idea",
      snippet: "x".repeat(281),
      actorDisplayName: "Reviewer",
    });
    expect(r.success).toBe(false);
  });
  it("rejects BULK_DIGEST with no items", () => {
    const r = NotificationPayloadSchema.safeParse({
      kind: "BULK_DIGEST",
      actorDisplayName: "Admin",
      items: [],
    });
    expect(r.success).toBe(false);
  });
});
