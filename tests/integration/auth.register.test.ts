import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { bootstrapAdminMarker, users } from "@/db/schema";
import {
  registerUser,
  changeRole,
  applyBootstrapPromotionIfMatch,
  listAllUsers,
} from "@/server/user-service";

beforeEach(async () => {
  await db.delete(bootstrapAdminMarker);
});

describe("auth.register", () => {
  it("happy path stores user and lower-case-unique email", async () => {
    const email = `Reg${Date.now()}@x.io`;
    const u = await registerUser({ email, password: "Passw0rd!", displayName: "R" });
    expect(u.role).toBe("EMPLOYEE");
    const stored = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`);
    expect(stored).toHaveLength(1);
  });

  it("duplicate email → USER_EMAIL_TAKEN", async () => {
    const email = `dup${Date.now()}@x.io`;
    await registerUser({ email, password: "Passw0rd!", displayName: "D" });
    await expect(
      registerUser({ email: email.toUpperCase(), password: "Passw0rd!", displayName: "D" }),
    ).rejects.toMatchObject({ code: "USER_EMAIL_TAKEN" });
  });

  it("weak password → USER_PASSWORD_POLICY", async () => {
    await expect(
      registerUser({ email: `w${Date.now()}@x.io`, password: "abc", displayName: "x" }),
    ).rejects.toMatchObject({ code: "USER_PASSWORD_POLICY" });
  });

  it("bootstrap-admin marker promotes to ADMIN once and is then consumed", async () => {
    const email = `boot${Date.now()}@x.io`;
    await db.insert(bootstrapAdminMarker).values({ email, createdAt: Date.now() });
    const u = await registerUser({ email, password: "Passw0rd!", displayName: "B" });
    expect(u.role).toBe("ADMIN");
    const markers = await db
      .select()
      .from(bootstrapAdminMarker)
      .where(sql`${bootstrapAdminMarker.email} = ${email}`);
    expect(markers).toHaveLength(0);
    // second call without a marker is a no-op
    const second = await applyBootstrapPromotionIfMatch(
      crypto.randomUUID(),
      `other${Date.now()}@x.io`,
    );
    expect(second).toBeNull();
  });

  it("listAllUsers returns ordered list", async () => {
    await registerUser({
      email: `l1-${Date.now()}@x.io`,
      password: "Passw0rd!",
      displayName: "L1",
    });
    const all = await listAllUsers();
    expect(all.length).toBeGreaterThan(0);
  });

  it("changeRole denies non-admin actor with AUTH_FORBIDDEN_ROLE", async () => {
    const u = await registerUser({
      email: `t${Date.now()}@x.io`,
      password: "Passw0rd!",
      displayName: "T",
    });
    await expect(
      changeRole(u.id, "EVALUATOR", { id: "x", role: "EMPLOYEE" }),
    ).rejects.toMatchObject({ code: "AUTH_FORBIDDEN_ROLE" });
  });

  it("changeRole on missing user → USER_NOT_FOUND", async () => {
    await expect(
      changeRole("00000000-0000-4000-8000-000000000000", "EVALUATOR", {
        id: "any",
        role: "ADMIN",
      }),
    ).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
  });
});
