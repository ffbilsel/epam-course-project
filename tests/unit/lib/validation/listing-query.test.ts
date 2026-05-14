import { describe, expect, it } from "vitest";
import { parseListingQuery, ListingQuerySchema } from "@/lib/validation/idea";

describe("parseListingQuery", () => {
  it("applies defaults when no params are supplied", () => {
    const q = parseListingQuery(new URLSearchParams());
    expect(q.scope).toBe("mine");
    expect(q.q).toBe("");
    expect(q.page).toBe(1);
    expect(q.pageSize).toBe(20);
    expect(q.categoryId).toBeUndefined();
    expect(q.status).toBeUndefined();
  });

  it("accepts the three scope values", () => {
    expect(parseListingQuery(new URLSearchParams("scope=queue")).scope).toBe("queue");
    expect(parseListingQuery(new URLSearchParams("scope=all")).scope).toBe("all");
  });

  it("rejects unknown scope values", () => {
    expect(() => parseListingQuery(new URLSearchParams("scope=bogus"))).toThrow();
  });

  it("collects repeated status params into an array", () => {
    const q = parseListingQuery(
      new URLSearchParams([
        ["status", "SUBMITTED"],
        ["status", "UNDER_REVIEW"],
      ]),
    );
    expect(q.status).toEqual(["SUBMITTED", "UNDER_REVIEW"]);
  });

  it("coerces page / pageSize from strings", () => {
    const q = parseListingQuery(new URLSearchParams("page=3&pageSize=50"));
    expect(q.page).toBe(3);
    expect(q.pageSize).toBe(50);
  });

  it("trims q and accepts up to 200 chars", () => {
    const q = parseListingQuery(new URLSearchParams("q=" + "a".repeat(199)));
    expect(q.q.length).toBe(199);
  });

  it("rejects q longer than 200 chars", () => {
    expect(() => parseListingQuery(new URLSearchParams("q=" + "a".repeat(201)))).toThrow(
      /IDEA_LISTING_SEARCH_TOO_LONG/,
    );
  });

  it("rejects pageSize outside the allowed set", () => {
    expect(() => parseListingQuery(new URLSearchParams("pageSize=37"))).toThrow(
      /IDEA_LISTING_PAGE_INVALID/,
    );
  });

  it("rejects malformed dates", () => {
    expect(() => parseListingQuery(new URLSearchParams("from=2026-13-99"))).toThrow(
      /IDEA_LISTING_RANGE_INVALID/,
    );
  });

  it("rejects from > to", () => {
    expect(() =>
      parseListingQuery(new URLSearchParams("from=2026-05-10&to=2026-05-01")),
    ).toThrow(/IDEA_LISTING_RANGE_INVALID/);
  });

  it("treats an empty status param as absent", () => {
    const q = parseListingQuery(new URLSearchParams("status="));
    expect(q.status).toBeUndefined();
  });

  it("schema is reusable via .parse on a plain object", () => {
    const q = ListingQuerySchema.parse({ page: 2, pageSize: 100 });
    expect(q.page).toBe(2);
    expect(q.pageSize).toBe(100);
  });
});
