import { describe, expect, it } from "vitest";
import { buildListingPredicate } from "@/server/idea-listing";
import { ListingQuerySchema } from "@/lib/validation/idea";
import { AppError } from "@/lib/errors/AppError";

function parse(input: Record<string, unknown>) {
  return ListingQuerySchema.parse({ scope: "mine", ...input });
}

describe("buildListingPredicate", () => {
  it("scope=mine pins authorScope to the caller", () => {
    const p = buildListingPredicate(parse({}), { id: "user-1", role: "EMPLOYEE" });
    expect(p.authorScope).toBe("user-1");
    expect(p.statusWhitelist).toBeUndefined();
  });

  it("scope=queue forces SUBMITTED + UNDER_REVIEW whitelist", () => {
    const p = buildListingPredicate(parse({ scope: "queue" }), {
      id: "ev-1",
      role: "EVALUATOR",
    });
    expect(p.statusWhitelist).toEqual(["SUBMITTED", "UNDER_REVIEW"]);
    expect(p.authorScope).toBeUndefined();
  });

  it("scope=queue rejects employees with AUTH_FORBIDDEN_ROLE", () => {
    expect(() =>
      buildListingPredicate(parse({ scope: "queue" }), {
        id: "u-1",
        role: "EMPLOYEE",
      }),
    ).toThrow(AppError);
  });

  it("scope=all rejects non-admins", () => {
    expect(() =>
      buildListingPredicate(parse({ scope: "all" }), {
        id: "ev-1",
        role: "EVALUATOR",
      }),
    ).toThrow(AppError);
  });

  it("scope=all passes for admins with no implicit restriction", () => {
    const p = buildListingPredicate(parse({ scope: "all" }), {
      id: "ad-1",
      role: "ADMIN",
    });
    expect(p.authorScope).toBeUndefined();
    expect(p.statusWhitelist).toBeUndefined();
  });

  it("forwards q, status, categoryId, and date range", () => {
    const q = ListingQuerySchema.parse({
      scope: "mine",
      q: "  coffee  ",
      status: ["APPROVED"],
      categoryId: "11111111-1111-4111-8111-111111111111",
      from: "2026-05-01",
      to: "2026-05-31",
    });
    const p = buildListingPredicate(q, { id: "u", role: "EMPLOYEE" });
    expect(p.q).toBe("coffee");
    expect(p.status).toEqual(["APPROVED"]);
    expect(p.categoryId).toBe("11111111-1111-4111-8111-111111111111");
    expect(p.from).toBe("2026-05-01");
    expect(p.to).toBe("2026-05-31");
  });
});
