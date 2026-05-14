import type { CategoryState, IdeaStatus, Role } from "@/db/schema";
import type { ErrorCode } from "@/lib/errors/codes";

/**
 * Discrete actions a reviewer/admin can request on an idea.
 */
export type TransitionAction = "START_REVIEW" | "APPROVE" | "REJECT" | "IMPLEMENT";

/**
 * Result returned by {@link evaluateTransition}.
 */
export type Decision =
  | { kind: "allow"; toState: IdeaStatus; commentRequired: boolean }
  | { kind: "deny"; code: ErrorCode };

/**
 * Inputs to the pure transition evaluator. No DB or Node-only APIs;
 * importable from RSC and the client (per ADR-0004).
 */
export interface EvaluateTransitionInput {
  idea: { status: IdeaStatus; authorId: string; categoryState: CategoryState };
  actor: { id: string; role: Role };
  action: TransitionAction;
  comment: string | null;
}

/** Static metadata describing the legal transitions for a single action. */
interface Rule {
  from: IdeaStatus[];
  to: IdeaStatus;
  commentRequired: boolean;
  allowedRoles: Role[];
}

const MAP: Record<TransitionAction, Rule> = {
  START_REVIEW: {
    from: ["SUBMITTED"],
    to: "UNDER_REVIEW",
    commentRequired: false,
    allowedRoles: ["EVALUATOR", "ADMIN"],
  },
  APPROVE: {
    from: ["SUBMITTED", "UNDER_REVIEW"],
    to: "APPROVED",
    commentRequired: true,
    allowedRoles: ["EVALUATOR", "ADMIN"],
  },
  REJECT: {
    from: ["SUBMITTED", "UNDER_REVIEW"],
    to: "REJECTED",
    commentRequired: true,
    allowedRoles: ["EVALUATOR", "ADMIN"],
  },
  IMPLEMENT: {
    from: ["APPROVED"],
    to: "IMPLEMENTED",
    commentRequired: false,
    allowedRoles: ["ADMIN"],
  },
};

/**
 * Pure function: returns whether `action` is allowed and, if so, the
 * target state. Used by both the API (defence-in-depth inside the
 * tx) and the UI (button gating).
 */
export function evaluateTransition(input: EvaluateTransitionInput): Decision {
  const rule = MAP[input.action];
  const guard =
    checkRole(input, rule) ??
    checkSelfEval(input) ??
    checkCategoryPending(input) ??
    checkFromState(input, rule) ??
    checkComment(input, rule);
  if (guard) return guard;
  return { kind: "allow", toState: rule.to, commentRequired: rule.commentRequired };
}

function checkRole(input: EvaluateTransitionInput, rule: Rule): Decision | null {
  return rule.allowedRoles.includes(input.actor.role)
    ? null
    : { kind: "deny", code: "AUTH_FORBIDDEN_ROLE" };
}

function checkSelfEval(input: EvaluateTransitionInput): Decision | null {
  return input.actor.id === input.idea.authorId
    ? { kind: "deny", code: "IDEA_SELF_EVALUATION_FORBIDDEN" }
    : null;
}

function checkCategoryPending(input: EvaluateTransitionInput): Decision | null {
  return input.idea.categoryState === "PROPOSED"
    ? { kind: "deny", code: "IDEA_CATEGORY_PENDING" }
    : null;
}

function checkFromState(input: EvaluateTransitionInput, rule: Rule): Decision | null {
  if (rule.from.includes(input.idea.status)) return null;
  const decided = ["APPROVED", "REJECTED", "IMPLEMENTED"];
  if (
    (input.action === "APPROVE" || input.action === "REJECT") &&
    decided.includes(input.idea.status)
  ) {
    return { kind: "deny", code: "IDEA_ALREADY_DECIDED" };
  }
  return { kind: "deny", code: "IDEA_INVALID_TRANSITION" };
}

function checkComment(input: EvaluateTransitionInput, rule: Rule): Decision | null {
  if (!rule.commentRequired) return null;
  return (input.comment ?? "").trim().length === 0
    ? { kind: "deny", code: "IDEA_COMMENT_REQUIRED" }
    : null;
}

/**
 * Convenience boolean for UI button gating.
 *
 * Note: gating ignores the `commentRequired` guard — the comment is
 * collected by the action dialog at submit time, so we only want to
 * know whether the action is structurally possible (role, self-eval,
 * category state, from-state). The comment requirement is still
 * enforced by {@link evaluateTransition} when the dialog POSTs and
 * by the API route as defence-in-depth.
 */
export function canTransition(input: EvaluateTransitionInput): boolean {
  const rule = MAP[input.action];
  const guard =
    checkRole(input, rule) ??
    checkSelfEval(input) ??
    checkCategoryPending(input) ??
    checkFromState(input, rule);
  return guard === null;
}

/**
 * Pure UI gate: returns true when the actor is the author of an idea
 * whose status is still `SUBMITTED`. Anything past that is locked
 * for the author (ADR-0013).
 */
export function canAuthorEdit(input: {
  idea: { status: IdeaStatus; authorId: string };
  actor: { id: string };
}): boolean {
  return input.actor.id === input.idea.authorId && input.idea.status === "SUBMITTED";
}

/**
 * Pure UI gate: same predicate as {@link canAuthorEdit}; kept
 * separate so future divergence (e.g. soft delete) doesn't have to
 * rename a public symbol.
 */
export function canAuthorDelete(input: {
  idea: { status: IdeaStatus; authorId: string };
  actor: { id: string };
}): boolean {
  return canAuthorEdit(input);
}
