/**
 * Canonical error-code registry. Every code MUST appear in at least
 * one test (Quality Gate #9). HTTP status mapping per Constitution
 * VII.3 and data-model.md "Error-code surface".
 */
export const ERROR_CODES = {
  AUTH_INVALID_CREDENTIALS: { httpStatus: 401 },
  AUTH_SESSION_EXPIRED: { httpStatus: 401 },
  AUTH_FORBIDDEN_ROLE: { httpStatus: 403 },
  AUTH_LAST_ADMIN_DEMOTION: { httpStatus: 409 },
  USER_EMAIL_TAKEN: { httpStatus: 409 },
  USER_PASSWORD_POLICY: { httpStatus: 400 },
  USER_NOT_FOUND: { httpStatus: 404 },
  IDEA_TITLE_REQUIRED: { httpStatus: 400 },
  IDEA_TITLE_TOO_LONG: { httpStatus: 400 },
  IDEA_DESCRIPTION_REQUIRED: { httpStatus: 400 },
  IDEA_DESCRIPTION_TOO_LONG: { httpStatus: 400 },
  IDEA_CATEGORY_INVALID: { httpStatus: 400 },
  IDEA_CATEGORY_PENDING: { httpStatus: 409 },
  IDEA_NOT_FOUND: { httpStatus: 404 },
  IDEA_INVALID_TRANSITION: { httpStatus: 409 },
  IDEA_COMMENT_REQUIRED: { httpStatus: 400 },
  IDEA_ALREADY_DECIDED: { httpStatus: 409 },
  IDEA_SELF_EVALUATION_FORBIDDEN: { httpStatus: 403 },
  ATTACHMENT_TOO_LARGE: { httpStatus: 413 },
  ATTACHMENT_TYPE_NOT_ALLOWED: { httpStatus: 400 },
  ATTACHMENT_NOT_FOUND: { httpStatus: 404 },
  CATEGORY_NAME_TAKEN: { httpStatus: 409 },
  CATEGORY_NOT_FOUND: { httpStatus: 404 },
  CATEGORY_NOT_PENDING: { httpStatus: 409 },
  CATEGORY_NOT_ACTIVE: { httpStatus: 409 },
  CATEGORY_PROTECTED: { httpStatus: 409 },
  CATEGORY_SCHEMA_INVALID: { httpStatus: 400 },
  CATEGORY_SCHEMA_FIELD_DUPLICATE: { httpStatus: 400 },
  CATEGORY_SCHEMA_OPTION_REQUIRED: { httpStatus: 400 },
  IDEA_ANSWER_REQUIRED: { httpStatus: 400 },
  IDEA_ANSWER_INVALID: { httpStatus: 400 },
  IDEA_ANSWER_TOO_LONG: { httpStatus: 400 },
  IDEA_ANSWER_OUT_OF_RANGE: { httpStatus: 400 },
  IDEA_ANSWER_OPTION_INVALID: { httpStatus: 400 },
  RATE_LIMITED: { httpStatus: 429 },
  CSRF_INVALID: { httpStatus: 403 },
  VALIDATION_ERROR: { httpStatus: 400 },
  INTERNAL_ERROR: { httpStatus: 500 },
} as const satisfies Record<string, { httpStatus: number }>;

/**
 * Union type of every declared error code.
 */
export type ErrorCode = keyof typeof ERROR_CODES;
