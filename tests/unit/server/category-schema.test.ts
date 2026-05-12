import { describe, expect, it } from "vitest";
import { validateSchema, diffSchemas } from "@/server/category-schema";
import { AppError } from "@/lib/errors/AppError";
import type { CategoryFieldDefinition } from "@/lib/validation/category-fields";

const baseField = (overrides: Partial<CategoryFieldDefinition> = {}): CategoryFieldDefinition => ({
  type: "SHORT_TEXT",
  key: "tool_name",
  label: "Tool name",
  required: false,
  ...overrides,
} as CategoryFieldDefinition);

describe("validateSchema", () => {
  it("returns parsed fields on success", () => {
    const out = validateSchema([baseField()]);
    expect(out).toHaveLength(1);
    expect(out[0]!.key).toBe("tool_name");
  });

  it("maps duplicate keys to CATEGORY_SCHEMA_FIELD_DUPLICATE", () => {
    try {
      validateSchema([baseField(), baseField()]);
      expect.fail("should throw");
    } catch (e) {
      expect((e as AppError).code).toBe("CATEGORY_SCHEMA_FIELD_DUPLICATE");
    }
  });

  it("maps empty options to CATEGORY_SCHEMA_OPTION_REQUIRED", () => {
    try {
      validateSchema([
        {
          type: "SINGLE_CHOICE",
          key: "x",
          label: "X",
          required: false,
          options: [],
        },
      ]);
      expect.fail("should throw");
    } catch (e) {
      expect((e as AppError).code).toBe("CATEGORY_SCHEMA_OPTION_REQUIRED");
    }
  });

  it("maps generic schema failures to CATEGORY_SCHEMA_INVALID", () => {
    try {
      validateSchema([{ ...baseField(), key: "Not-A-Key" }]);
      expect.fail("should throw");
    } catch (e) {
      expect((e as AppError).code).toBe("CATEGORY_SCHEMA_INVALID");
    }
  });
});

describe("diffSchemas", () => {
  it("detects added, removed and renamed fields", () => {
    const prev: CategoryFieldDefinition[] = [
      baseField({ key: "a", label: "A" }),
      baseField({ key: "b", label: "B" }),
    ];
    const next: CategoryFieldDefinition[] = [
      baseField({ key: "a", label: "A renamed" }),
      baseField({ key: "c", label: "C" }),
    ];
    const d = diffSchemas(prev, next);
    expect(d.added).toEqual(["c"]);
    expect(d.removed).toEqual(["b"]);
    expect(d.renamed).toEqual([{ key: "a", from: "A", to: "A renamed" }]);
  });
});
