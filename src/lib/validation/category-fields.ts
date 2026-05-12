import { z } from "zod";

/**
 * Phase 2 — Smart Submission Forms.
 *
 * Zod meta-schema for the category field definitions stored on
 * `categories.field_schema`, plus the runtime answer-shape builder
 * used by both client and server per ADR-0011.
 *
 * See `specs/002-smart-forms/data-model.md` for the canonical
 * entity descriptions.
 */

/** Maximum number of structured fields per category. */
export const CATEGORY_FIELD_LIMIT = 8;
/** Maximum number of structured answers persisted on an idea. */
export const IDEA_ANSWER_LIMIT = 20;
/** Maximum length of a free-text label / help text. */
export const LABEL_MAX = 80;
/** Maximum number of SINGLE_CHOICE options per field. */
export const OPTIONS_MAX = 12;
/** Caps on SHORT_TEXT / LONG_TEXT answer values, mirroring Phase 1. */
export const SHORT_TEXT_MAX = 120;
export const LONG_TEXT_MAX = 2000;

/**
 * Allowed `type` discriminator on a {@link CategoryFieldDefinition}.
 */
export const CATEGORY_FIELD_TYPES = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "NUMBER",
  "SINGLE_CHOICE",
  "YES_NO",
] as const;
/** Union of the five allowed field types. */
export type CategoryFieldType = (typeof CATEGORY_FIELD_TYPES)[number];

/**
 * `key` MUST be a stable, machine-readable snake-case identifier.
 * Used in `IdeaStructuredAnswer.key` and as React form-field name.
 */
const FieldKey = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z][a-z0-9_]{0,39}$/, "CATEGORY_SCHEMA_INVALID");

const BaseField = z.object({
  key: FieldKey,
  label: z.string().trim().min(1).max(LABEL_MAX),
  required: z.boolean().default(false),
  helpText: z.string().trim().max(LABEL_MAX).optional(),
});

const ShortTextField = BaseField.extend({
  type: z.literal("SHORT_TEXT"),
});
const LongTextField = BaseField.extend({
  type: z.literal("LONG_TEXT"),
});
const NumberField = BaseField.extend({
  type: z.literal("NUMBER"),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
});
const SingleChoiceOption = z.object({
  value: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9][a-z0-9_-]{0,39}$/, "CATEGORY_SCHEMA_INVALID"),
  label: z.string().trim().min(1).max(LABEL_MAX),
});
const SingleChoiceField = BaseField.extend({
  type: z.literal("SINGLE_CHOICE"),
  options: z.array(SingleChoiceOption).min(1, "CATEGORY_SCHEMA_OPTION_REQUIRED").max(OPTIONS_MAX),
});
const YesNoField = BaseField.extend({
  type: z.literal("YES_NO"),
});

/** Discriminated union of every supported field shape. */
export const CategoryFieldDefinition = z.discriminatedUnion("type", [
  ShortTextField,
  LongTextField,
  NumberField,
  SingleChoiceField,
  YesNoField,
]);
/** Inferred TypeScript type for {@link CategoryFieldDefinition}. */
export type CategoryFieldDefinition = z.infer<typeof CategoryFieldDefinition>;

/**
 * Top-level meta-schema: the JSON payload stored on
 * `categories.field_schema`. Enforces uniqueness of `key` and the
 * `CATEGORY_FIELD_LIMIT` cap.
 */
export const CategoryFieldSchema = z
  .array(CategoryFieldDefinition)
  .max(CATEGORY_FIELD_LIMIT)
  .superRefine((fields, ctx) => {
    const seen = new Set<string>();
    fields.forEach((f, i) => {
      if (seen.has(f.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CATEGORY_SCHEMA_FIELD_DUPLICATE",
          path: [i, "key"],
        });
      }
      seen.add(f.key);
      if (f.type === "NUMBER" && f.min !== undefined && f.max !== undefined && f.min > f.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CATEGORY_SCHEMA_INVALID",
          path: [i, "max"],
        });
      }
    });
  });
/** Inferred TypeScript type for {@link CategoryFieldSchema}. */
export type CategoryFieldSchemaT = z.infer<typeof CategoryFieldSchema>;

/**
 * The value persisted on `ideas.category_answers` (a value object —
 * see data-model.md "Entity: IdeaStructuredAnswer").
 */
export const IdeaStructuredAnswer = z
  .object({
    key: FieldKey,
    labelSnapshot: z.string().min(1).max(LABEL_MAX),
    type: z.enum(CATEGORY_FIELD_TYPES),
    value: z.union([z.string(), z.number(), z.boolean()]),
    valueLabelSnapshot: z.string().min(1).max(LABEL_MAX).optional(),
  })
  .superRefine((a, ctx) => {
    refineAnswer(a, ctx);
  });
// eslint-disable-next-line complexity -- exhaustive type-narrowing per ADR-0012
function refineAnswer(
  a: { type: CategoryFieldType; value: unknown; valueLabelSnapshot?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  if (a.type === "SINGLE_CHOICE" && typeof a.value !== "string") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "IDEA_ANSWER_INVALID",
      path: ["value"],
    });
  }
  if (a.type === "SINGLE_CHOICE" && !a.valueLabelSnapshot) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "IDEA_ANSWER_INVALID",
      path: ["valueLabelSnapshot"],
    });
  }
  if (a.type === "NUMBER" && typeof a.value !== "number") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "IDEA_ANSWER_INVALID",
      path: ["value"],
    });
  }
  if (a.type === "YES_NO" && typeof a.value !== "boolean") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "IDEA_ANSWER_INVALID",
      path: ["value"],
    });
  }
  if ((a.type === "SHORT_TEXT" || a.type === "LONG_TEXT") && typeof a.value !== "string") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "IDEA_ANSWER_INVALID",
      path: ["value"],
    });
  }
}
/** Inferred TypeScript type for {@link IdeaStructuredAnswer}. */
export type IdeaStructuredAnswer = z.infer<typeof IdeaStructuredAnswer>;

/**
 * At-rest validator for the `ideas.category_answers` JSON column.
 * Used on read to fail-fast if a row was corrupted by a hand-edit.
 */
export const IdeaCategoryAnswersList = z
  .array(IdeaStructuredAnswer)
  .max(IDEA_ANSWER_LIMIT)
  .superRefine((answers, ctx) => {
    const seen = new Set<string>();
    answers.forEach((a, i) => {
      if (seen.has(a.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "IDEA_ANSWER_INVALID",
          path: [i, "key"],
        });
      }
      seen.add(a.key);
    });
  });
/** Inferred TypeScript type for {@link IdeaCategoryAnswersList}. */
export type IdeaCategoryAnswersListT = z.infer<typeof IdeaCategoryAnswersList>;

/**
 * Builds a runtime Zod object schema that validates *answer input*
 * (a `{ [key]: value }` record) against the given field definitions
 * per ADR-0011.
 *
 * Used by `IdeaForm` (client, via `zodResolver`) and by
 * `validateAnswers` (server, on every submit).
 */
export function buildAnswersZodSchema(
  fields: readonly CategoryFieldDefinition[],
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    shape[f.key] = buildFieldSchema(f);
  }
  return z.object(shape);
}

function buildFieldSchema(field: CategoryFieldDefinition): z.ZodTypeAny {
  if (field.type === "SHORT_TEXT") return buildTextFieldSchema(field.required, SHORT_TEXT_MAX);
  if (field.type === "LONG_TEXT") return buildTextFieldSchema(field.required, LONG_TEXT_MAX);
  if (field.type === "NUMBER") return buildNumberFieldSchema(field);
  if (field.type === "SINGLE_CHOICE") return buildSingleChoiceFieldSchema(field);
  return buildYesNoFieldSchema(field.required);
}

function buildTextFieldSchema(required: boolean, max: number): z.ZodTypeAny {
  const s = z.string().trim().max(max, "IDEA_ANSWER_TOO_LONG");
  return required
    ? s.min(1, "IDEA_ANSWER_REQUIRED")
    : s
        .optional()
        .or(z.literal(""))
        .transform((v) => (v === "" ? undefined : v));
}

function buildNumberFieldSchema(field: {
  required: boolean;
  min?: number | undefined;
  max?: number | undefined;
}): z.ZodTypeAny {
  let n = z.coerce
    .number({ invalid_type_error: "IDEA_ANSWER_INVALID" })
    .finite("IDEA_ANSWER_INVALID");
  if (field.min !== undefined) n = n.min(field.min, "IDEA_ANSWER_OUT_OF_RANGE");
  if (field.max !== undefined) n = n.max(field.max, "IDEA_ANSWER_OUT_OF_RANGE");
  return field.required
    ? n
    : z
        .union([z.literal(""), z.literal(null), n])
        .optional()
        .transform((v) => (v === "" || v === null ? undefined : v));
}

function buildSingleChoiceFieldSchema(field: {
  required: boolean;
  options: readonly { value: string }[];
}): z.ZodTypeAny {
  const opts = field.options.map((o: { value: string }) => o.value);
  const allowed = opts as [string, ...string[]];
  const e = z.enum(allowed, {
    errorMap: () => ({ message: "IDEA_ANSWER_OPTION_INVALID" }),
  });
  return field.required
    ? e
    : z
        .union([z.literal(""), e])
        .optional()
        .transform((v) => (v === "" ? undefined : v));
}

function buildYesNoFieldSchema(required: boolean): z.ZodTypeAny {
  const b = z.coerce.boolean();
  return required ? b : b.optional();
}
