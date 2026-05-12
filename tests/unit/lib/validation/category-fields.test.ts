import { describe, expect, it } from "vitest";
import {
  CategoryFieldSchema,
  buildAnswersZodSchema,
  type CategoryFieldDefinition,
} from "@/lib/validation/category-fields";

const validShortText: CategoryFieldDefinition = {
  type: "SHORT_TEXT",
  key: "tool_name",
  label: "Tool name",
  required: true,
};
const validNumber: CategoryFieldDefinition = {
  type: "NUMBER",
  key: "hours",
  label: "Hours",
  required: false,
  min: 0,
  max: 40,
};
const validSingleChoice: CategoryFieldDefinition = {
  type: "SINGLE_CHOICE",
  key: "audience",
  label: "Audience",
  required: false,
  options: [
    { value: "engineering", label: "Engineering teams" },
    { value: "delivery", label: "Delivery teams" },
  ],
};
const validLongText: CategoryFieldDefinition = {
  type: "LONG_TEXT",
  key: "details",
  label: "Details",
  required: true,
};
const validYesNo: CategoryFieldDefinition = {
  type: "YES_NO",
  key: "customer_facing",
  label: "Customer facing?",
  required: false,
};

describe("CategoryFieldSchema", () => {
  it("accepts a valid mixed schema", () => {
    const r = CategoryFieldSchema.safeParse([
      validShortText,
      validNumber,
      validSingleChoice,
      validLongText,
      validYesNo,
    ]);
    expect(r.success).toBe(true);
  });

  it("rejects duplicate keys", () => {
    const r = CategoryFieldSchema.safeParse([validShortText, { ...validShortText }]);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.message)).toContain("CATEGORY_SCHEMA_FIELD_DUPLICATE");
    }
  });

  it("rejects SINGLE_CHOICE with empty options", () => {
    const r = CategoryFieldSchema.safeParse([
      { ...validSingleChoice, options: [] } as CategoryFieldDefinition,
    ]);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.message)).toContain("CATEGORY_SCHEMA_OPTION_REQUIRED");
    }
  });

  it("rejects NUMBER with inverted min/max", () => {
    const r = CategoryFieldSchema.safeParse([
      { ...validNumber, min: 10, max: 5 } as CategoryFieldDefinition,
    ]);
    expect(r.success).toBe(false);
  });

  it("rejects an invalid key pattern", () => {
    const r = CategoryFieldSchema.safeParse([{ ...validShortText, key: "Not-A-Key" }]);
    expect(r.success).toBe(false);
  });

  it("rejects an unknown type", () => {
    const r = CategoryFieldSchema.safeParse([
      { key: "x", label: "X", required: false, type: "MYSTERY" },
    ]);
    expect(r.success).toBe(false);
  });

  it("rejects an oversized label", () => {
    const r = CategoryFieldSchema.safeParse([{ ...validShortText, label: "x".repeat(200) }]);
    expect(r.success).toBe(false);
  });

  it("rejects schemas over the 8-field cap", () => {
    const fields = Array.from({ length: 9 }, (_, i) => ({
      ...validShortText,
      key: `f_${i}`,
    }));
    const r = CategoryFieldSchema.safeParse(fields);
    expect(r.success).toBe(false);
  });
});

describe("buildAnswersZodSchema", () => {
  it("rejects when a required SHORT_TEXT is missing", () => {
    const schema = buildAnswersZodSchema([validShortText]);
    const r = schema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("accepts when a required SHORT_TEXT is present", () => {
    const schema = buildAnswersZodSchema([validShortText]);
    const r = schema.safeParse({ tool_name: "Vitest" });
    expect(r.success).toBe(true);
  });

  it("coerces NUMBER strings", () => {
    const schema = buildAnswersZodSchema([{ ...validNumber, required: true }]);
    const r = schema.safeParse({ hours: "12" });
    expect(r.success).toBe(true);
  });

  it("rejects NUMBER out of range", () => {
    const schema = buildAnswersZodSchema([{ ...validNumber, required: true }]);
    const r = schema.safeParse({ hours: 999 });
    expect(r.success).toBe(false);
  });

  it("rejects SINGLE_CHOICE value not in options", () => {
    const schema = buildAnswersZodSchema([{ ...validSingleChoice, required: true }]);
    const r = schema.safeParse({ audience: "nobody" });
    expect(r.success).toBe(false);
  });
});
