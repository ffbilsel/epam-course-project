import pino from "pino";
import type { Role } from "@/db/schema";

/**
 * Structured JSON logger — stdout in production, pretty-printed in dev.
 * Sensitive fields are redacted at the serializer level (FR-028).
 */
export const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  redact: {
    paths: [
      "password",
      "passwordHash",
      "token",
      "csrfToken",
      "authorization",
      "*.password",
      "*.passwordHash",
      "*.token",
    ],
    censor: "[REDACTED]",
  },
  ...(process.env["NODE_ENV"] !== "production"
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : {}),
});

/**
 * Structured fields required by FR-028 for security-relevant events.
 */
export interface SecurityEvent {
  event:
    | "register"
    | "login_success"
    | "login_failure"
    | "logout"
    | "role_change"
    | "category_decision"
    | "category_schema_update"
    | "idea_transition"
    | "internal_error";
  userId: string | null;
  actorRole: Role | null;
  ip: string | null;
  requestId: string | null;
  details?: Record<string, unknown>;
}

/**
 * Emit a single security-relevant event as a structured JSON line.
 */
export function logSecurityEvent(evt: SecurityEvent): void {
  logger.info({ kind: "security", ...evt });
}
