import { describe, expect, it } from "vitest";
import { resolveRange, rollUpBuckets } from "@/server/insights-service";
import type { DailyCountRow } from "@/db/repositories/insights-repo";
import { AppError } from "@/lib/errors/AppError";

describe("resolveRange", () => {
  it("computes a 30-day window from a stable reference date", () => {
    const r = resolveRange({ preset: "30d", bucket: "day" }, new Date("2026-05-14T10:00:00.000Z"));
    expect(r.fromIso).toBe("2026-04-15");
    expect(r.toIso).toBe("2026-05-14");
    expect(r.bucket).toBe("day");
  });

  it("rejects custom from > to with INSIGHTS_RANGE_INVALID", () => {
    expect(() =>
      resolveRange(
        { preset: "custom", from: "2026-05-10", to: "2026-05-01", bucket: "day" },
        new Date("2026-05-14T10:00:00.000Z"),
      ),
    ).toThrow(AppError);
  });

  it("rejects custom range with missing endpoints", () => {
    expect(() =>
      resolveRange({ preset: "custom", bucket: "day" }, new Date("2026-05-14T00:00:00.000Z")),
    ).toThrow(AppError);
  });

  it("respects 'year' preset by anchoring to Jan 1 UTC", () => {
    const r = resolveRange(
      { preset: "year", bucket: "month" },
      new Date("2026-05-14T10:00:00.000Z"),
    );
    expect(r.fromIso).toBe("2026-01-01");
  });
});

describe("rollUpBuckets", () => {
  const daily: DailyCountRow[] = [
    { bucket: "2026-05-04", count: 1 }, // Mon (ISO week start)
    { bucket: "2026-05-05", count: 2 },
    { bucket: "2026-05-11", count: 3 }, // next Monday
  ];

  it("returns the daily series untouched when bucket=day", () => {
    expect(rollUpBuckets(daily, "day")).toEqual(daily);
  });

  it("rolls into ISO-Monday weeks when bucket=week", () => {
    const r = rollUpBuckets(daily, "week");
    expect(r).toEqual([
      { bucket: "2026-05-04", count: 3 },
      { bucket: "2026-05-11", count: 3 },
    ]);
  });

  it("rolls into YYYY-MM months when bucket=month", () => {
    const r = rollUpBuckets(
      [
        { bucket: "2026-04-30", count: 1 },
        { bucket: "2026-05-01", count: 2 },
        { bucket: "2026-05-31", count: 3 },
      ],
      "month",
    );
    expect(r).toEqual([
      { bucket: "2026-04", count: 1 },
      { bucket: "2026-05", count: 5 },
    ]);
  });

  it("returns an empty array for an empty input (FR-030)", () => {
    expect(rollUpBuckets([], "day")).toEqual([]);
    expect(rollUpBuckets([], "week")).toEqual([]);
    expect(rollUpBuckets([], "month")).toEqual([]);
  });
});
