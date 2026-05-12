import { describe, expect, it } from "vitest";
import { ZodError, z } from "zod";
import { withErrorHandler, errorResponse } from "@/lib/errors/with-error-handler";
import { AppError } from "@/lib/errors/AppError";

describe("withErrorHandler", () => {
  it("converts AppError to envelope with correct status", async () => {
    const handler = withErrorHandler(async () => {
      throw AppError.notFound("IDEA_NOT_FOUND");
    });
    const res = await handler();
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("IDEA_NOT_FOUND");
  });

  it("converts ZodError to VALIDATION_ERROR (400)", async () => {
    const handler = withErrorHandler(async () => {
      try {
        z.string().min(5).parse("a");
      } catch (e) {
        throw e as ZodError;
      }
      return new Response("");
    });
    const res = await handler();
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; details?: unknown } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toBeDefined();
  });

  it("converts unknown error to INTERNAL_ERROR (500)", async () => {
    const handler = withErrorHandler(async () => {
      throw new Error("boom");
    });
    const res = await handler();
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("errorResponse builds correct envelope for any code", async () => {
    const r1 = errorResponse("RATE_LIMITED");
    expect(r1.status).toBe(429);
    const r2 = errorResponse("CSRF_INVALID");
    expect(r2.status).toBe(403);
    const r3 = errorResponse("ATTACHMENT_TOO_LARGE");
    expect(r3.status).toBe(413);
    const r4 = errorResponse("AUTH_INVALID_CREDENTIALS");
    expect(r4.status).toBe(401);
    const r5 = errorResponse("AUTH_SESSION_EXPIRED");
    expect(r5.status).toBe(401);
  });
});
