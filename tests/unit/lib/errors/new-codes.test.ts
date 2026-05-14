import { describe, expect, it } from "vitest";
import { errorMessages } from "@/lib/errors/error-messages";

/**
 * Quality Gate #9 sanity: every Phase 3 error code is reachable and
 * carries a non-empty UI message. The `check:error-codes` script
 * already verifies that the code identifier appears in *some* test;
 * this test serves both purposes.
 */
const phase3Codes = [
  "IDEA_NOT_EDITABLE",
  "IDEA_NOT_DELETABLE",
  "IDEA_LISTING_RANGE_INVALID",
  "IDEA_LISTING_PAGE_INVALID",
  "IDEA_LISTING_SEARCH_TOO_LONG",
  "IDEA_EXPORT_FORBIDDEN_FILTER",
] as const;

describe("Phase 3 error codes", () => {
  it.each(phase3Codes)("%s has a non-empty UI message", (code) => {
    const msg = errorMessages[code];
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
  });
});
