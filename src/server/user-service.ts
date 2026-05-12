import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users, bootstrapAdminMarker, type Role } from "@/db/schema";
import { AppError } from "@/lib/errors/AppError";
import { hashPassword, assertPasswordPolicy } from "@/server/password";
import { logSecurityEvent } from "@/server/infra/logger";
import { SystemClock, type Clock } from "@/server/infra/clock";
import { SystemIdGenerator, type IdGenerator } from "@/server/infra/id-generator";

interface RegisterDeps {
  clock?: Clock;
  ids?: IdGenerator;
}

/**
 * Returns the count of users currently holding a given role.
 */
async function countByRole(role: Role): Promise<number> {
  const r = await db
    .select({ c: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.role, role));
  return Number(r[0]?.c ?? 0);
}

/**
 * Promotes the new user to ADMIN if their email matches a bootstrap
 * marker (FR-005b). Idempotent — clears the marker after promotion.
 */
export async function applyBootstrapPromotionIfMatch(
  userId: string,
  email: string,
): Promise<Role | null> {
  const m = await db
    .select()
    .from(bootstrapAdminMarker)
    .where(sql`lower(${bootstrapAdminMarker.email}) = lower(${email})`)
    .limit(1);
  if (m.length === 0) return null;
  await db.update(users).set({ role: "ADMIN", updatedAt: Date.now() }).where(eq(users.id, userId));
  await db.delete(bootstrapAdminMarker).where(eq(bootstrapAdminMarker.email, m[0]!.email));
  logSecurityEvent({
    event: "role_change",
    userId,
    actorRole: "ADMIN",
    ip: null,
    requestId: null,
    details: { reason: "bootstrap", to: "ADMIN" },
  });
  return "ADMIN";
}

/**
 * Registers a new user (FR-001..FR-005b) and applies bootstrap-admin
 * promotion if applicable.
 */
export async function registerUser(
  input: { email: string; password: string; displayName: string },
  deps: RegisterDeps = {},
): Promise<{ id: string; email: string; role: Role; displayName: string }> {
  assertPasswordPolicy(input.password);
  const clock = deps.clock ?? SystemClock;
  const ids = deps.ids ?? SystemIdGenerator;

  const dup = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${input.email})`)
    .limit(1);
  if (dup.length > 0) throw AppError.conflict("USER_EMAIL_TAKEN");

  const id = ids.next();
  const now = clock.now().getTime();
  const passwordHash = await hashPassword(input.password);
  await db.insert(users).values({
    id,
    email: input.email,
    passwordHash,
    displayName: input.displayName,
    role: "EMPLOYEE",
    createdAt: now,
    updatedAt: now,
  });
  const promoted = await applyBootstrapPromotionIfMatch(id, input.email);
  logSecurityEvent({
    event: "register",
    userId: id,
    actorRole: promoted ?? "EMPLOYEE",
    ip: null,
    requestId: null,
  });
  return {
    id,
    email: input.email,
    displayName: input.displayName,
    role: promoted ?? "EMPLOYEE",
  };
}

/**
 * Changes a user's role with the last-admin-demotion guard (FR-006).
 */
export async function changeRole(
  targetUserId: string,
  newRole: Role,
  actor: { id: string; role: Role },
): Promise<void> {
  if (actor.role !== "ADMIN") throw new AppError("AUTH_FORBIDDEN_ROLE");
  const target = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
  const t = target[0];
  if (!t) throw AppError.notFound("USER_NOT_FOUND");
  if (t.role === newRole) return;
  if (t.role === "ADMIN" && newRole !== "ADMIN") {
    const adminCount = await countByRole("ADMIN");
    if (adminCount <= 1) throw AppError.conflict("AUTH_LAST_ADMIN_DEMOTION");
  }
  await db
    .update(users)
    .set({ role: newRole, updatedAt: Date.now() })
    .where(eq(users.id, targetUserId));
  logSecurityEvent({
    event: "role_change",
    userId: targetUserId,
    actorRole: actor.role,
    ip: null,
    requestId: null,
    details: { from: t.role, to: newRole, by: actor.id },
  });
}

/**
 * Lists every user (admin pages).
 */
export async function listAllUsers(): Promise<
  Array<{ id: string; email: string; displayName: string; role: Role; createdAt: number }>
> {
  const rows = await db.select().from(users).orderBy(users.email);
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.displayName,
    role: r.role,
    createdAt: r.createdAt,
  }));
}
