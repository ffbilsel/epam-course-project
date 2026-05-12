import { describe, expect, it } from "vitest";
import { FixedClock, SystemClock } from "@/server/infra/clock";
import { StaticIdGenerator, SystemIdGenerator } from "@/server/infra/id-generator";
import { logSecurityEvent } from "@/server/infra/logger";

describe("infra primitives", () => {
  it("FixedClock advances deterministically", () => {
    const c = new FixedClock(new Date("2026-01-01T00:00:00Z"));
    expect(c.now().toISOString()).toBe("2026-01-01T00:00:00.000Z");
    c.advance(1_000);
    expect(c.now().toISOString()).toBe("2026-01-01T00:00:01.000Z");
  });

  it("SystemClock returns a Date roughly equal to wall clock", () => {
    const t = SystemClock.now().getTime();
    expect(Math.abs(t - Date.now())).toBeLessThan(5_000);
  });

  it("StaticIdGenerator returns ids in order then exhausts", () => {
    const g = new StaticIdGenerator(["a", "b"]);
    expect(g.next()).toBe("a");
    expect(g.next()).toBe("b");
    expect(() => g.next()).toThrow();
  });

  it("SystemIdGenerator returns a uuid", () => {
    expect(SystemIdGenerator.next()).toMatch(/[0-9a-f-]{36}/);
  });

  it("logSecurityEvent does not throw for any registered event", () => {
    expect(() =>
      logSecurityEvent({
        event: "internal_error",
        userId: null,
        actorRole: null,
        ip: null,
        requestId: null,
      }),
    ).not.toThrow();
  });
});
