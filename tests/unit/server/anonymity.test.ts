import { describe, expect, it } from "vitest";
import { maskAuthor, maskHistoryEvent, ANONYMOUS_SUBMITTER_LABEL } from "@/server/anonymity";
import type { Role } from "@/db/schema";

const baseIdea = {
  id: "i1",
  authorId: "a1",
  authorName: "Ada Lovelace",
  authorEmail: "ada@example.test",
  authorAvatarUrl: "https://example.test/ada.png",
  anonymous: false,
};

interface Row {
  viewerRole: Role;
  viewerId: string;
  anonymous: boolean;
  expectMask: boolean;
}

const matrix: Row[] = [
  { viewerRole: "ADMIN", viewerId: "x", anonymous: true, expectMask: false },
  { viewerRole: "ADMIN", viewerId: "x", anonymous: false, expectMask: false },
  { viewerRole: "EVALUATOR", viewerId: "x", anonymous: true, expectMask: true },
  { viewerRole: "EVALUATOR", viewerId: "x", anonymous: false, expectMask: false },
  { viewerRole: "EVALUATOR", viewerId: "a1", anonymous: true, expectMask: false },
  { viewerRole: "EMPLOYEE", viewerId: "x", anonymous: true, expectMask: false },
  { viewerRole: "EMPLOYEE", viewerId: "a1", anonymous: true, expectMask: false },
];

describe("maskAuthor truth table", () => {
  it.each(matrix)(
    "viewer=%s anonymous=%s → mask=%s",
    ({ viewerRole, viewerId, anonymous, expectMask }) => {
      const idea = { ...baseIdea, anonymous };
      const out = maskAuthor(idea, { id: viewerId, role: viewerRole });
      if (expectMask) {
        expect(out.authorName).toBe(ANONYMOUS_SUBMITTER_LABEL);
        expect(out.authorId).toBe("");
        expect(out.authorEmail).toBeNull();
        expect(out.authorAvatarUrl).toBeNull();
      } else {
        expect(out.authorName).toBe(baseIdea.authorName);
        expect(out.authorId).toBe(baseIdea.authorId);
      }
    },
  );

  it("is pure (does not mutate input)", () => {
    const idea = { ...baseIdea, anonymous: true };
    maskAuthor(idea, { id: "x", role: "EVALUATOR" });
    expect(idea.authorName).toBe(baseIdea.authorName);
  });
});

describe("maskHistoryEvent", () => {
  it("masks SUBMITTED by author for evaluator on anonymous idea", () => {
    const out = maskHistoryEvent(
      { kind: "SUBMITTED", actorId: "a1", actorName: "Ada Lovelace" },
      { ideaAnonymous: true, authorId: "a1", viewer: { id: "x", role: "EVALUATOR" } },
    );
    expect(out.actorName).toBe(ANONYMOUS_SUBMITTER_LABEL);
  });

  it("does not mask TRANSITION events (reviewer identity is never masked)", () => {
    const out = maskHistoryEvent(
      { kind: "TRANSITION", actorId: "r1", actorName: "Reviewer" },
      { ideaAnonymous: true, authorId: "a1", viewer: { id: "x", role: "EVALUATOR" } },
    );
    expect(out.actorName).toBe("Reviewer");
  });
});
