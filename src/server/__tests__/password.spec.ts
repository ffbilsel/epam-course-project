import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, assertPasswordPolicy } from "@/server/password";
import { AppError } from "@/lib/errors/AppError";

describe("password", () => {
  it("hashPassword + verifyPassword round-trip", async () => {
    const hash = await hashPassword("Passw0rd!");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword("Passw0rd!", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("verifyPassword returns false for garbled hashes", async () => {
    expect(await verifyPassword("anything", "not-a-real-hash")).toBe(false);
  });

  it("assertPasswordPolicy throws USER_PASSWORD_POLICY for short", () => {
    expect(() => assertPasswordPolicy("a1")).toThrowError(AppError);
    try {
      assertPasswordPolicy("a1");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("USER_PASSWORD_POLICY");
    }
  });

  it("rejects letter-only and digit-only with USER_PASSWORD_POLICY", () => {
    expect(() => assertPasswordPolicy("abcdefgh")).toThrow();
    expect(() => assertPasswordPolicy("12345678")).toThrow();
  });

  it("accepts compliant password", () => {
    expect(() => assertPasswordPolicy("alpha1bravo")).not.toThrow();
  });
});
