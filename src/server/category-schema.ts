import {
  CategoryFieldSchema,
  type CategoryFieldDefinition,
} from "@/lib/validation/category-fields";
import { AppError } from "@/lib/errors/AppError";

/**
 * Parses raw input (typically a JSON body) through the
 * `CategoryFieldSchema` Zod meta-schema. Throws
 * `CATEGORY_SCHEMA_INVALID` for any failure — sub-codes such as
 * `CATEGORY_SCHEMA_FIELD_DUPLICATE` and
 * `CATEGORY_SCHEMA_OPTION_REQUIRED` are emitted by the meta-schema
 * itself and re-projected onto the error envelope by the route
 * handler's `withErrorHandler`.
 */
export function validateSchema(input: unknown): CategoryFieldDefinition[] {
  const result = CategoryFieldSchema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    const code = mapZodIssueToCode(first?.message);
    throw new AppError(code, { issues: result.error.issues });
  }
  return result.data;
}

function mapZodIssueToCode(
  message: string | undefined,
): "CATEGORY_SCHEMA_FIELD_DUPLICATE" | "CATEGORY_SCHEMA_OPTION_REQUIRED" | "CATEGORY_SCHEMA_INVALID" {
  if (message === "CATEGORY_SCHEMA_FIELD_DUPLICATE") return "CATEGORY_SCHEMA_FIELD_DUPLICATE";
  if (message === "CATEGORY_SCHEMA_OPTION_REQUIRED") return "CATEGORY_SCHEMA_OPTION_REQUIRED";
  return "CATEGORY_SCHEMA_INVALID";
}

/**
 * Diffs two schemas by `key`, surfacing fields that were added,
 * removed, or whose `label` changed between revisions. Useful for
 * audit logs in future phases; currently unused by the runtime but
 * exported for reuse by tests and the UI.
 */
export function diffSchemas(
  prev: readonly CategoryFieldDefinition[],
  next: readonly CategoryFieldDefinition[],
): {
  added: string[];
  removed: string[];
  renamed: Array<{ key: string; from: string; to: string }>;
} {
  const prevByKey = new Map(prev.map((f) => [f.key, f]));
  const nextByKey = new Map(next.map((f) => [f.key, f]));
  const added = [...nextByKey.keys()].filter((k) => !prevByKey.has(k));
  const removed = [...prevByKey.keys()].filter((k) => !nextByKey.has(k));
  const renamed: Array<{ key: string; from: string; to: string }> = [];
  for (const [key, p] of prevByKey) {
    const n = nextByKey.get(key);
    if (n && n.label !== p.label) {
      renamed.push({ key, from: p.label, to: n.label });
    }
  }
  return { added, removed, renamed };
}
