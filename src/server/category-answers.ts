import { AppError } from "@/lib/errors/AppError";
import type { ErrorCode } from "@/lib/errors/codes";
import {
  type CategoryFieldDefinition,
  type IdeaStructuredAnswer,
  SHORT_TEXT_MAX,
  LONG_TEXT_MAX,
} from "@/lib/validation/category-fields";

/**
 * Validates raw answers (a `{ [key]: value }` record produced by the
 * client form) against the live `field_schema` and returns the
 * persistence-ready `IdeaStructuredAnswer[]`.
 *
 * On the server, the source of truth for what's required and what's
 * allowed is **always** the live schema attached to the category at
 * submit time — never the client-supplied schema. Every answer
 * carries a `labelSnapshot` (and, for SINGLE_CHOICE, a
 * `valueLabelSnapshot`) so that the detail view survives later
 * schema edits per FR-008 and ADR-0010.
 *
 * Throws `AppError(IDEA_ANSWER_*)` with `details: { field: "answers.<key>" }`
 * on the first violation.
 */
export function validateAnswers(
  fields: readonly CategoryFieldDefinition[],
  input: Record<string, unknown> | null | undefined,
): IdeaStructuredAnswer[] {
  const raw = input ?? {};
  const out: IdeaStructuredAnswer[] = [];
  const seen = new Set<string>();

  for (const field of fields) {
    if (seen.has(field.key)) continue;
    seen.add(field.key);
    const value = raw[field.key];
    const answer = validateOne(field, value);
    if (answer !== undefined) out.push(answer);
  }
  return out;
}

function failField(key: string, code: ErrorCode): never {
  throw new AppError(code, { field: `answers.${key}` });
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function validateOne(
  field: CategoryFieldDefinition,
  value: unknown,
): IdeaStructuredAnswer | undefined {
  if (isMissing(value)) {
    if (field.required) failField(field.key, "IDEA_ANSWER_REQUIRED");
    return undefined;
  }
  return validateByType(field, value);
}

// eslint-disable-next-line complexity -- exhaustive switch over the 5 field types from ADR-0012
function validateByType(
  field: CategoryFieldDefinition,
  value: unknown,
): IdeaStructuredAnswer | undefined {
  if (field.type === "SHORT_TEXT") {
    if (typeof value !== "string") failField(field.key, "IDEA_ANSWER_INVALID");
    const v = (value as string).trim();
    if (v.length > SHORT_TEXT_MAX) failField(field.key, "IDEA_ANSWER_TOO_LONG");
    return { key: field.key, labelSnapshot: field.label, type: "SHORT_TEXT", value: v };
  }
  if (field.type === "LONG_TEXT") {
    if (typeof value !== "string") failField(field.key, "IDEA_ANSWER_INVALID");
    const v = (value as string).trim();
    if (v.length > LONG_TEXT_MAX) failField(field.key, "IDEA_ANSWER_TOO_LONG");
    return { key: field.key, labelSnapshot: field.label, type: "LONG_TEXT", value: v };
  }
  if (field.type === "NUMBER") {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) failField(field.key, "IDEA_ANSWER_INVALID");
    if (field.min !== undefined && n < field.min) {
      failField(field.key, "IDEA_ANSWER_OUT_OF_RANGE");
    }
    if (field.max !== undefined && n > field.max) {
      failField(field.key, "IDEA_ANSWER_OUT_OF_RANGE");
    }
    return { key: field.key, labelSnapshot: field.label, type: "NUMBER", value: n };
  }
  if (field.type === "SINGLE_CHOICE") {
    if (typeof value !== "string") failField(field.key, "IDEA_ANSWER_INVALID");
    const opt = field.options.find((o: { value: string }) => o.value === value);
    if (!opt) failField(field.key, "IDEA_ANSWER_OPTION_INVALID");
    return {
      key: field.key,
      labelSnapshot: field.label,
      type: "SINGLE_CHOICE",
      value: opt.value,
      valueLabelSnapshot: opt.label,
    };
  }
  // YES_NO
  let b: boolean | undefined;
  if (typeof value === "boolean") b = value;
  else if (value === "true") b = true;
  else if (value === "false") b = false;
  if (b === undefined) failField(field.key, "IDEA_ANSWER_INVALID");
  return { key: field.key, labelSnapshot: field.label, type: "YES_NO", value: b };
}

/**
 * Returns `answers` sorted by the order of `fields` (matched by
 * `key`) with any orphan answers (whose key no longer appears in the
 * schema) appended at the end in their original array order.
 *
 * Used by the idea detail view per FR-008 / data-model.md.
 */
export function orderAnswersForDisplay(
  answers: readonly IdeaStructuredAnswer[],
  fields: readonly CategoryFieldDefinition[],
): IdeaStructuredAnswer[] {
  const order = new Map<string, number>();
  fields.forEach((f, i) => order.set(f.key, i));
  const known: IdeaStructuredAnswer[] = [];
  const orphans: IdeaStructuredAnswer[] = [];
  for (const a of answers) {
    if (order.has(a.key)) known.push(a);
    else orphans.push(a);
  }
  known.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
  return [...known, ...orphans];
}
