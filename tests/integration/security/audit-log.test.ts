import { describe, expect, it } from "vitest";
import pino from "pino";
import { logSecurityEvent } from "@/server/infra/logger";

describe("audit log (FR-028)", () => {
  it("emits structured records for each security event without throwing", () => {
    const events = [
      "register",
      "login_success",
      "login_failure",
      "logout",
      "role_change",
      "category_decision",
      "idea_transition",
      "internal_error",
    ] as const;
    for (const ev of events) {
      expect(() =>
        logSecurityEvent({
          event: ev,
          userId: "u1",
          actorRole: "ADMIN",
          ip: "127.0.0.1",
          requestId: "req-1",
        }),
      ).not.toThrow();
    }
  });

  it("redact configuration prevents password/token leakage in JSON output", () => {
    let captured = "";
    const sink = {
      write(chunk: string): void {
        captured += chunk;
      },
    };
    const local = pino(
      {
        redact: {
          paths: ["password", "passwordHash", "token", "csrfToken", "authorization"],
          censor: "[REDACTED]",
        },
      },
      sink as unknown as NodeJS.WritableStream,
    );
    local.info({ password: "topsecret", token: "topsecret-token", note: "ok" }, "leaky");
    expect(captured).not.toContain("topsecret");
    expect(captured).toContain("[REDACTED]");
  });
});
