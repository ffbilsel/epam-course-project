import argon2 from "argon2";
import { AppError } from "@/lib/errors/AppError";

const PARAMS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

/**
 * Validates a plaintext password against the FR-002 policy: at least
 * 8 characters with at least one letter and at least one digit.
 * Throws {@link AppError} `USER_PASSWORD_POLICY` on failure.
 */
export function assertPasswordPolicy(plain: string): void {
  if (!PASSWORD_RE.test(plain)) {
    throw new AppError("USER_PASSWORD_POLICY");
  }
}

/**
 * Hashes a plaintext password with argon2id using OWASP-2024 params.
 */
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, PARAMS);
}

/**
 * Verifies a plaintext password against a stored argon2 hash.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
