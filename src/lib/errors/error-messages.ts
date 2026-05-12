import type { ErrorCode } from "./codes";

/**
 * Human-readable English copy for every error code. The UI MUST
 * resolve `code` to a message via this map; never hard-code copy.
 */
export const errorMessages: Record<ErrorCode, string> = {
  AUTH_INVALID_CREDENTIALS: "Invalid email or password.",
  AUTH_SESSION_EXPIRED: "Your session has expired. Please sign in again.",
  AUTH_FORBIDDEN_ROLE: "You do not have permission to perform this action.",
  AUTH_LAST_ADMIN_DEMOTION: "Cannot demote the last remaining Admin.",
  USER_EMAIL_TAKEN: "An account with that email already exists.",
  USER_PASSWORD_POLICY:
    "Password must be at least 8 characters and include at least one letter and one digit.",
  USER_NOT_FOUND: "User not found.",
  IDEA_TITLE_REQUIRED: "Title is required.",
  IDEA_TITLE_TOO_LONG: "Title must be 120 characters or fewer.",
  IDEA_DESCRIPTION_REQUIRED: "Description is required.",
  IDEA_DESCRIPTION_TOO_LONG: "Description must be 2000 characters or fewer.",
  IDEA_CATEGORY_INVALID: "Choose an existing category or propose a new one.",
  IDEA_CATEGORY_PENDING: "Awaiting category approval.",
  IDEA_NOT_FOUND: "Idea not found.",
  IDEA_INVALID_TRANSITION: "That status change is not allowed.",
  IDEA_COMMENT_REQUIRED: "A comment is required for this decision.",
  IDEA_ALREADY_DECIDED: "This idea has already been decided.",
  IDEA_SELF_EVALUATION_FORBIDDEN: "You cannot evaluate your own idea.",
  ATTACHMENT_TOO_LARGE: "Attachment exceeds the 25 MB limit.",
  ATTACHMENT_TYPE_NOT_ALLOWED: "Only PDF, PNG, JPEG, DOCX, and PPTX files are allowed.",
  ATTACHMENT_NOT_FOUND: "Attachment not found.",
  CATEGORY_NAME_TAKEN: "A category with that name already exists.",
  CATEGORY_NOT_FOUND: "Category not found.",
  CATEGORY_NOT_PENDING: "Only proposed categories can be approved or rejected.",
  CATEGORY_PROTECTED: "This category cannot be modified.",
  RATE_LIMITED: "Too many requests. Please try again later.",
  CSRF_INVALID: "Invalid or missing CSRF token.",
  VALIDATION_ERROR: "Validation failed.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
};
