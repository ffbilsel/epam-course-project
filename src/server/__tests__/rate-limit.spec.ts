import { describe, expect, it } from "vitest";
import { rateLimit, limiters } from "@/server/rate-limit";
import { AppError } from "@/lib/errors/AppError";

describe("rate-limit", () => {
  it("throws RATE_LIMITED after exhausting the auth bucket", async () => {
    const key = "test-ip-" + Math.random();
    for (let i = 0; i < 5; i++) await rateLimit("auth", key);
    await expect(rateLimit("auth", key)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("register limiter exposes 3 points", () => {
    expect(limiters.register.points).toBe(3);
  });

  it("attachments limiter exposes 20 points", () => {
    expect(limiters.attachments.points).toBe(20);
  });

  it("AppError instance carries http 429", async () => {
    const key = "another-" + Math.random();
    for (let i = 0; i < 5; i++) await rateLimit("auth", key);
    try {
      await rateLimit("auth", key);
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).httpStatus).toBe(429);
    }
  });
});
