import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { categories, ideas, users, type Role } from "@/db/schema";
import { sql } from "drizzle-orm";
import { hashPassword } from "@/server/password";
import {
  getApprovalRate,
  getCategoryDistribution,
  getSubmissionTrend,
} from "@/server/insights-service";
import { AppError } from "@/lib/errors/AppError";

let adminId: string;
let evaluatorId: string;
let employeeId: string;
let catId: string;

beforeEach(async () => {
  const now = Date.now();
  adminId = crypto.randomUUID();
  evaluatorId = crypto.randomUUID();
  employeeId = crypto.randomUUID();
  const mkUser = async (id: string, role: Role, name: string) => ({
    id,
    email: `${name}-${now}@e.x`,
    passwordHash: await hashPassword("Passw0rd!"),
    displayName: name,
    role,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(users).values([
    await mkUser(adminId, "ADMIN", "admin"),
    await mkUser(evaluatorId, "EVALUATOR", "evaluator"),
    await mkUser(employeeId, "EMPLOYEE", "employee"),
  ]);
  const cats = await db
    .select()
    .from(categories)
    .where(sql`${categories.name} = 'Other'`)
    .limit(1);
  catId = cats[0]!.id;

  // Seed 3 ideas in the last 7 days
  const days = [1, 2, 3];
  for (const offset of days) {
    const t = now - offset * 86_400_000;
    await db.insert(ideas).values({
      id: crypto.randomUUID(),
      title: `idea-${offset}`,
      description: "x",
      status: offset === 1 ? "APPROVED" : "SUBMITTED",
      categoryId: catId,
      authorId: employeeId,
      anonymous: 0,
      createdAt: t,
      updatedAt: t,
    });
  }
});

describe("insights-service · role gating", () => {
  it("EMPLOYEE is forbidden from every chart endpoint", () => {
    const actor = { id: employeeId, role: "EMPLOYEE" as Role };
    expect(() => getSubmissionTrend({ preset: "30d", bucket: "day" }, actor)).toThrow(AppError);
    expect(() => getApprovalRate({ preset: "30d", bucket: "day" }, actor)).toThrow(AppError);
    expect(() => getCategoryDistribution({ preset: "30d", bucket: "day" }, actor)).toThrow(AppError);
  });

  it("EVALUATOR can read all three charts", () => {
    const actor = { id: evaluatorId, role: "EVALUATOR" as Role };
    const trend = getSubmissionTrend({ preset: "30d", bucket: "day" }, actor);
    const approval = getApprovalRate({ preset: "30d", bucket: "day" }, actor);
    const dist = getCategoryDistribution({ preset: "30d", bucket: "day" }, actor);
    expect(trend.data.length).toBeGreaterThan(0);
    expect(approval.data.approved).toBeGreaterThanOrEqual(1);
    expect(dist.data.some((d) => d.categoryId === catId && d.count === 3)).toBe(true);
  });

  it("ADMIN can read all three charts", () => {
    const actor = { id: adminId, role: "ADMIN" as Role };
    const trend = getSubmissionTrend({ preset: "30d", bucket: "day" }, actor);
    expect(trend.range.bucket).toBe("day");
    expect(trend.data.reduce((s, p) => s + p.count, 0)).toBe(3);
  });
});

describe("insights-service · range validation", () => {
  it("rejects from > to with INSIGHTS_RANGE_INVALID", () => {
    const actor = { id: adminId, role: "ADMIN" as Role };
    expect(() =>
      getSubmissionTrend(
        { preset: "custom", from: "2026-05-10", to: "2026-05-01", bucket: "day" },
        actor,
      ),
    ).toThrow(
      expect.objectContaining({ code: "INSIGHTS_RANGE_INVALID" }) as unknown as Error,
    );
  });
});
