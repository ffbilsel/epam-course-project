import { ERROR_CODES, type ErrorCode } from "./codes";
import { errorMessages } from "./error-messages";

/**
 * Domain-level error carrying a stable {@link ErrorCode}, an HTTP
 * status, and optional structured details for the JSON envelope.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details: Record<string, unknown> | undefined;

  /**
   * Constructs an AppError for the given registered {@link ErrorCode}.
   */
  constructor(code: ErrorCode, details?: Record<string, unknown>, message?: string) {
    super(message ?? errorMessages[code] ?? code);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = ERROR_CODES[code].httpStatus;
    this.details = details;
  }

  /**
   * Convenience factory for 404-style errors.
   */
  static notFound(code: ErrorCode, details?: Record<string, unknown>): AppError {
    return new AppError(code, details);
  }

  /**
   * Convenience factory for 409-style conflict errors.
   */
  static conflict(code: ErrorCode, details?: Record<string, unknown>): AppError {
    return new AppError(code, details);
  }
}
