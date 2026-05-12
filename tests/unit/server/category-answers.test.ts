import { describe, expect, it } from "vitest";
import { validateAnswers, orderAnswersForDisplay } from "@/server/category-answers";
import type { CategoryFieldDefinition } from "@/lib/validation/category-fields";
import { AppError } from "@/lib/errors/AppError";

const fields: CategoryFieldDefinition[] = [
  { type: "SHORT_TEXT", key: "tool_name", label: "Tool name", required: true },
  { type: "NUMBER", key: "hours", label: "Hours", required: false, min: 0, max: 40 },
  {
    type: "SINGLE_CHOICE",
    key: "audience",
    label: "Audience",
    required: true,
    options: [
      { value: "engineering", label: "Engineering teams" },
      { value: "delivery", label: "Delivery teams" },
    ],
  },
  { type: "YES_NO", key: "customer_facing", label: "Customer facing?", required: false },
];

describe("validateAnswers", () => {
  it("snapshots labels and option labels on success", () => {
    const out = validateAnswers(fields, {
      tool_name: "Vitest",
      hours: 8,
      audience: "engineering",
      customer_facing: true,
    });
    expect(out).toEqual([
      { key: "tool_name", labelSnapshot: "Tool name", type: "SHORT_TEXT", value: "Vitest" },
      { key: "hours", labelSnapshot: "Hours", type: "NUMBER", value: 8 },
      {
        key: "audience",
        labelSnapshot: "Audience",
        type: "SINGLE_CHOICE",
        value: "engineering",
        valueLabelSnapshot: "Engineering teams",
      },
      {
        key: "customer_facing",
        labelSnapshot: "Customer facing?",
        type: "YES_NO",
        value: true,
      },
    ]);
  });

  it("rejects with IDEA_ANSWER_REQUIRED when a required field is missing", () => {
    try {
      validateAnswers(fields, { audience: "engineering" });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("IDEA_ANSWER_REQUIRED");
      expect((e as AppError).details).toEqual({ field: "answers.tool_name" });
    }
  });

  it("rejects SHORT_TEXT > 120 chars with IDEA_ANSWER_TOO_LONG", () => {
    try {
      validateAnswers(fields, {
        tool_name: "x".repeat(121),
        audience: "engineering",
      });
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as AppError).code).toBe("IDEA_ANSWER_TOO_LONG");
    }
  });

  it("rejects NUMBER out of range with IDEA_ANSWER_OUT_OF_RANGE", () => {
    try {
      validateAnswers(fields, { tool_name: "x", audience: "engineering", hours: 9999 });
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as AppError).code).toBe("IDEA_ANSWER_OUT_OF_RANGE");
    }
  });

  it("rejects SINGLE_CHOICE not in options with IDEA_ANSWER_OPTION_INVALID", () => {
    try {
      validateAnswers(fields, { tool_name: "x", audience: "nobody" });
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as AppError).code).toBe("IDEA_ANSWER_OPTION_INVALID");
    }
  });

  it("omits optional answers that were not provided", () => {
    const out = validateAnswers(fields, { tool_name: "x", audience: "engineering" });
    expect(out.find((a) => a.key === "hours")).toBeUndefined();
    expect(out.find((a) => a.key === "customer_facing")).toBeUndefined();
  });
});

describe("orderAnswersForDisplay", () => {
  it("orders known answers by schema, then appends orphans", () => {
    const answers = [
      { key: "orphan_a", labelSnapshot: "A old", type: "SHORT_TEXT", value: "x" },
      { key: "tool_name", labelSnapshot: "Tool name", type: "SHORT_TEXT", value: "y" },
      { key: "hours", labelSnapshot: "Hours", type: "NUMBER", value: 1 },
    ] as const;
    const out = orderAnswersForDisplay([...answers], fields);
    expect(out.map((a) => a.key)).toEqual(["tool_name", "hours", "orphan_a"]);
  });
});
