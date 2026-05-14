import { describe, expect, it } from "vitest";
import { errorMessages } from "@/lib/errors/error-messages";
import { ERROR_CODES } from "@/lib/errors/codes";

/**
 * Quality Gate #9: every new Phase 4 error code is registered, has
 * an HTTP status, and resolves to a non-empty UI message.
 */
const phase4Codes = [
  "DRAFT_NOT_FOUND",
  "DRAFT_FORBIDDEN",
  "DRAFT_VALIDATION",
  "RATING_INVALID_SCORE",
  "RATING_REQUIRED_MISSING",
  "RATING_LOCKED",
  "COMMENT_NOT_FOUND",
  "COMMENT_FORBIDDEN",
  "COMMENT_TOO_LONG",
  "COMMENT_NESTING_EXCEEDED",
  "COMMENT_EDIT_WINDOW_EXPIRED",
  "INSIGHTS_FORBIDDEN",
  "INSIGHTS_RANGE_INVALID",
] as const;

describe("Phase 4 error codes", () => {
  it.each(phase4Codes)("%s has a non-empty UI message and HTTP status", (code) => {
    expect(ERROR_CODES[code]).toBeDefined();
    expect(typeof ERROR_CODES[code].httpStatus).toBe("number");
    const msg = errorMessages[code];
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
  });
});
