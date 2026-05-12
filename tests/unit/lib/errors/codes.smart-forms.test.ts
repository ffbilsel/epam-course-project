import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@/lib/errors/codes";
import { errorMessages } from "@/lib/errors/error-messages";

/**
 * Quality Gate #9: every Phase 2 code must map to exactly one HTTP
 * status (no generics) and carry a human-readable UI string.
 */
const PHASE_2_CODES = [
  { code: "CATEGORY_SCHEMA_INVALID", httpStatus: 400 },
  { code: "CATEGORY_SCHEMA_FIELD_DUPLICATE", httpStatus: 400 },
  { code: "CATEGORY_SCHEMA_OPTION_REQUIRED", httpStatus: 400 },
  { code: "CATEGORY_NOT_ACTIVE", httpStatus: 409 },
  { code: "IDEA_ANSWER_REQUIRED", httpStatus: 400 },
  { code: "IDEA_ANSWER_INVALID", httpStatus: 400 },
  { code: "IDEA_ANSWER_TOO_LONG", httpStatus: 400 },
  { code: "IDEA_ANSWER_OUT_OF_RANGE", httpStatus: 400 },
  { code: "IDEA_ANSWER_OPTION_INVALID", httpStatus: 400 },
] as const;

describe("Phase 2 error code registry", () => {
  it.each(PHASE_2_CODES)("should map $code to $httpStatus", ({ code, httpStatus }) => {
    expect(ERROR_CODES[code]).toBeDefined();
    expect(ERROR_CODES[code].httpStatus).toBe(httpStatus);
  });

  it.each(PHASE_2_CODES)("should have UI copy for $code", ({ code }) => {
    expect(errorMessages[code]).toBeTypeOf("string");
    expect(errorMessages[code].length).toBeGreaterThan(0);
  });
});
