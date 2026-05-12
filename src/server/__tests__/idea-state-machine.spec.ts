import { describe, expect, it } from "vitest";
import { evaluateTransition, canTransition } from "@/server/idea-state-machine";
import type { CategoryState, IdeaStatus, Role } from "@/db/schema";

type IdeaShape = { status: IdeaStatus; authorId: string; categoryState: CategoryState };
const idea = (over: Partial<IdeaShape> = {}): IdeaShape => ({
  status: "SUBMITTED",
  authorId: "author-1",
  categoryState: "ACTIVE",
  ...over,
});

const actor = (role: Role, id = "reviewer-1") => ({ id, role });

describe("idea-state-machine.evaluateTransition", () => {
  it("allows EVALUATOR to START_REVIEW from SUBMITTED", () => {
    const r = evaluateTransition({
      idea: idea(),
      actor: actor("EVALUATOR"),
      action: "START_REVIEW",
      comment: null,
    });
    expect(r.kind).toBe("allow");
    if (r.kind === "allow") expect(r.toState).toBe("UNDER_REVIEW");
  });

  it("denies EMPLOYEE attempting START_REVIEW with AUTH_FORBIDDEN_ROLE", () => {
    const r = evaluateTransition({
      idea: idea(),
      actor: actor("EMPLOYEE", "x"),
      action: "START_REVIEW",
      comment: null,
    });
    expect(r).toEqual({ kind: "deny", code: "AUTH_FORBIDDEN_ROLE" });
  });

  it("blocks self-evaluation with IDEA_SELF_EVALUATION_FORBIDDEN", () => {
    const r = evaluateTransition({
      idea: idea({ authorId: "me" }),
      actor: actor("EVALUATOR", "me"),
      action: "APPROVE",
      comment: "ok",
    });
    expect(r).toEqual({ kind: "deny", code: "IDEA_SELF_EVALUATION_FORBIDDEN" });
  });

  it("blocks transitions while category is PROPOSED with IDEA_CATEGORY_PENDING", () => {
    const r = evaluateTransition({
      idea: idea({ categoryState: "PROPOSED" }),
      actor: actor("EVALUATOR"),
      action: "APPROVE",
      comment: "x",
    });
    expect(r).toEqual({ kind: "deny", code: "IDEA_CATEGORY_PENDING" });
  });

  it("requires comment for APPROVE — IDEA_COMMENT_REQUIRED", () => {
    const r = evaluateTransition({
      idea: idea(),
      actor: actor("EVALUATOR"),
      action: "APPROVE",
      comment: "  ",
    });
    expect(r).toEqual({ kind: "deny", code: "IDEA_COMMENT_REQUIRED" });
  });

  it("requires comment for REJECT — IDEA_COMMENT_REQUIRED", () => {
    const r = evaluateTransition({
      idea: idea(),
      actor: actor("EVALUATOR"),
      action: "REJECT",
      comment: "",
    });
    expect(r).toEqual({ kind: "deny", code: "IDEA_COMMENT_REQUIRED" });
  });

  it("returns IDEA_ALREADY_DECIDED when approving an APPROVED idea", () => {
    const r = evaluateTransition({
      idea: idea({ status: "APPROVED" }),
      actor: actor("EVALUATOR"),
      action: "APPROVE",
      comment: "ok",
    });
    expect(r).toEqual({ kind: "deny", code: "IDEA_ALREADY_DECIDED" });
  });

  it("returns IDEA_INVALID_TRANSITION for IMPLEMENT from SUBMITTED by ADMIN", () => {
    const r = evaluateTransition({
      idea: idea({ status: "SUBMITTED" }),
      actor: actor("ADMIN"),
      action: "IMPLEMENT",
      comment: null,
    });
    expect(r).toEqual({ kind: "deny", code: "IDEA_INVALID_TRANSITION" });
  });

  it("denies IMPLEMENT for EVALUATOR with AUTH_FORBIDDEN_ROLE", () => {
    const r = evaluateTransition({
      idea: idea({ status: "APPROVED" }),
      actor: actor("EVALUATOR"),
      action: "IMPLEMENT",
      comment: null,
    });
    expect(r).toEqual({ kind: "deny", code: "AUTH_FORBIDDEN_ROLE" });
  });

  it("ADMIN can IMPLEMENT an APPROVED idea", () => {
    const r = evaluateTransition({
      idea: idea({ status: "APPROVED" }),
      actor: actor("ADMIN"),
      action: "IMPLEMENT",
      comment: null,
    });
    expect(r.kind).toBe("allow");
  });

  it("canTransition mirrors evaluateTransition", () => {
    expect(
      canTransition({
        idea: idea(),
        actor: actor("EVALUATOR"),
        action: "START_REVIEW",
        comment: null,
      }),
    ).toBe(true);
    expect(
      canTransition({
        idea: idea(),
        actor: actor("EMPLOYEE", "x"),
        action: "START_REVIEW",
        comment: null,
      }),
    ).toBe(false);
  });
});
