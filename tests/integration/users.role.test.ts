import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { hashPassword } from "@/server/password";
import { registerUser, changeRole } from "@/server/user-service";

let admin1: string;
let admin2: string;

beforeEach(async () => {
  const now = Date.now();
  const hash = await hashPassword("Passw0rd!");
  admin1 = crypto.randomUUID();
  admin2 = crypto.randomUUID();
  await db.insert(users).values([
    {
      id: admin1,
      email: `ad1-${now}@x.io`,
      passwordHash: hash,
      displayName: "Ad1",
      role: "ADMIN",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: admin2,
      email: `ad2-${now}@x.io`,
      passwordHash: hash,
      displayName: "Ad2",
      role: "ADMIN",
      createdAt: now,
      updatedAt: now,
    },
  ]);
});

describe("users role admin", () => {
  it("happy promote/demote between two admins works", async () => {
    await changeRole(admin2, "EMPLOYEE", { id: admin1, role: "ADMIN" });
    const r = await db
      .select()
      .from(users)
      .where(sql`${users.id} = ${admin2}`);
    expect(r[0]?.role).toBe("EMPLOYEE");
  });

  it("last-admin demotion → AUTH_LAST_ADMIN_DEMOTION", async () => {
    await changeRole(admin2, "EMPLOYEE", { id: admin1, role: "ADMIN" });
    await expect(
      changeRole(admin1, "EMPLOYEE", { id: admin1, role: "ADMIN" }),
    ).rejects.toMatchObject({ code: "AUTH_LAST_ADMIN_DEMOTION" });
  });

  it("promote a fresh user to EVALUATOR", async () => {
    const fresh = await registerUser({
      email: `fresh-${Date.now()}@x.io`,
      password: "Passw0rd!",
      displayName: "F",
    });
    await changeRole(fresh.id, "EVALUATOR", { id: admin1, role: "ADMIN" });
    const r = await db
      .select()
      .from(users)
      .where(sql`${users.id} = ${fresh.id}`);
    expect(r[0]?.role).toBe("EVALUATOR");
  });
});
