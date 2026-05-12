import { hashPassword } from "@/server/password";
import { users } from "@/db/schema";
import type { Role } from "@/db/schema";
import type { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/schema";

type DB = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Inserts a user row directly with an argon2-hashed password. Useful
 * for tests that need a known login without going through register.
 */
export async function makeUser(
  db: DB,
  opts: { email: string; password?: string; displayName?: string; role?: Role; id?: string },
): Promise<{ id: string; email: string; role: Role; displayName: string; password: string }> {
  const password = opts.password ?? "Passw0rd!";
  const hash = await hashPassword(password);
  const id = opts.id ?? crypto.randomUUID();
  const now = Date.now();
  await db.insert(users).values({
    id,
    email: opts.email,
    passwordHash: hash,
    displayName: opts.displayName ?? opts.email.split("@")[0]!,
    role: opts.role ?? "EMPLOYEE",
    createdAt: now,
    updatedAt: now,
  });
  return {
    id,
    email: opts.email,
    role: opts.role ?? "EMPLOYEE",
    displayName: opts.displayName ?? opts.email.split("@")[0]!,
    password,
  };
}
