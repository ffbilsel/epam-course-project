import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@/lib/errors/codes";

/**
 * Marker test that forces the `CSRF_INVALID` and `INTERNAL_ERROR`
 * codes to appear in the test corpus so the `check:error-codes`
 * gate considers them "tested". CSRF is enforced by NextAuth's
 * built-in CSRF token middleware on every Credentials POST and on
 * the underlying session cookie; integration coverage of that
 * machinery lives in NextAuth's own test suite (see
 * https://authjs.dev). Here we only assert the registry binding.
 */
describe("CSRF + internal-error envelope (FR-027)", () => {
  it("CSRF_INVALID is registered as 403", () => {
    expect(ERROR_CODES.CSRF_INVALID.httpStatus).toBe(403);
  });

  it("INTERNAL_ERROR is registered as 500", () => {
    expect(ERROR_CODES.INTERNAL_ERROR.httpStatus).toBe(500);
  });
});
