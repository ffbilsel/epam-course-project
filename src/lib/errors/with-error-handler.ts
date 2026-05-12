import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./AppError";
import { ERROR_CODES, type ErrorCode } from "./codes";
import { errorMessages } from "./error-messages";
import { logSecurityEvent } from "@/server/infra/logger";

type RouteHandler<TArgs extends unknown[]> = (...args: TArgs) => Promise<Response> | Response;

/**
 * Wraps a Next.js Route Handler so every thrown {@link AppError} or
 * {@link ZodError} becomes the constitutional `{ error: { code, message, details } }`
 * envelope with the right HTTP status. Anything else becomes
 * `INTERNAL_ERROR` (500); the original stack is logged server-side
 * but never returned to the client.
 */
export function withErrorHandler<TArgs extends unknown[]>(
  handler: RouteHandler<TArgs>,
): RouteHandler<TArgs> {
  return async (...args: TArgs): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof AppError) {
        return errorResponse(err.code, err.message, err.details);
      }
      if (err instanceof ZodError) {
        return errorResponse("VALIDATION_ERROR", errorMessages["VALIDATION_ERROR"], {
          issues: err.flatten(),
        });
      }
      logSecurityEvent({
        event: "internal_error",
        userId: null,
        actorRole: null,
        ip: null,
        requestId: null,
        details: { message: err instanceof Error ? err.message : String(err) },
      });
      return errorResponse("INTERNAL_ERROR", errorMessages["INTERNAL_ERROR"]);
    }
  };
}

/**
 * Builds the constitutional error envelope JSON response.
 */
export function errorResponse(
  code: ErrorCode,
  message?: string,
  details?: Record<string, unknown>,
): NextResponse {
  const body = {
    error: {
      code,
      message: message ?? errorMessages[code],
      ...(details ? { details } : {}),
    },
  };
  return NextResponse.json(body, { status: ERROR_CODES[code].httpStatus });
}
