import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors/AppError";
import { ERROR_CODES, type ErrorCode } from "@/lib/errors/codes";
import { errorMessages } from "@/lib/errors/error-messages";

describe("AppError + registry", () => {
  it("every code has an http status and a human message", () => {
    for (const code of Object.keys(ERROR_CODES) as ErrorCode[]) {
      expect(ERROR_CODES[code].httpStatus).toBeGreaterThanOrEqual(400);
      expect(errorMessages[code]).toBeTypeOf("string");
      expect(errorMessages[code].length).toBeGreaterThan(0);
    }
  });

  it("AppError carries code, status, and details", () => {
    const e = new AppError("IDEA_NOT_FOUND", { id: "x" });
    expect(e.code).toBe("IDEA_NOT_FOUND");
    expect(e.httpStatus).toBe(404);
    expect(e.details).toEqual({ id: "x" });
    expect(e.message).toBe(errorMessages.IDEA_NOT_FOUND);
  });

  it("static helpers compose registered codes", () => {
    expect(AppError.notFound("USER_NOT_FOUND").httpStatus).toBe(404);
    expect(AppError.conflict("CATEGORY_NAME_TAKEN").code).toBe("CATEGORY_NAME_TAKEN");
  });
});
