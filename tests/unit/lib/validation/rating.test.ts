import { describe, expect, it } from "vitest";
import { RatingPutSchema } from "@/lib/validation/rating";

describe("RatingPutSchema", () => {
  it("accepts a score of 1", () => {
    const r = RatingPutSchema.safeParse({ scores: [{ dimensionId: "d1", score: 1 }] });
    expect(r.success).toBe(true);
  });
  it("accepts a score of 5", () => {
    const r = RatingPutSchema.safeParse({ scores: [{ dimensionId: "d1", score: 5 }] });
    expect(r.success).toBe(true);
  });
  it("rejects a score of 0", () => {
    const r = RatingPutSchema.safeParse({ scores: [{ dimensionId: "d1", score: 0 }] });
    expect(r.success).toBe(false);
  });
  it("rejects a score of 6", () => {
    const r = RatingPutSchema.safeParse({ scores: [{ dimensionId: "d1", score: 6 }] });
    expect(r.success).toBe(false);
  });
  it("accepts null (unrated)", () => {
    const r = RatingPutSchema.safeParse({ scores: [{ dimensionId: "d1", score: null }] });
    expect(r.success).toBe(true);
  });
  it("rejects more than 20 dimensions", () => {
    const scores = Array.from({ length: 21 }, (_, i) => ({ dimensionId: `d${i}`, score: 3 }));
    const r = RatingPutSchema.safeParse({ scores });
    expect(r.success).toBe(false);
  });
});
