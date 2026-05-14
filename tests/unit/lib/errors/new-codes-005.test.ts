import { describe, it, expect } from "vitest";
import { ERROR_CODES } from "@/lib/errors/codes";
import { errorMessages } from "@/lib/errors/error-messages";

const NEW_CODES = [
  "ATTACHMENT_LIMIT_EXCEEDED",
  "ATTACHMENT_QUOTA_EXCEEDED",
  "ATTACHMENT_ORDER_INVALID",
  "ATTACHMENT_FORBIDDEN",
  "ATTACHMENT_PREVIEW_UNSUPPORTED",
  "IDEA_VERSION_NOT_FOUND",
  "IDEA_VERSION_RANGE_INVALID",
  "NOTIFICATION_NOT_FOUND",
  "NOTIFICATION_FORBIDDEN",
  "EMAIL_PREFERENCE_INVALID",
  "EMAIL_DELIVERY_PERMANENT_FAILURE",
] as const;

describe("Phase 5 new error codes (Quality Gate 9)", () => {
  it.each(NEW_CODES)("%s has an HTTP status and a UI message", (code) => {
    expect(ERROR_CODES[code]).toBeDefined();
    expect(errorMessages[code]).toBeTypeOf("string");
    expect(errorMessages[code]!.length).toBeGreaterThan(0);
  });
});
