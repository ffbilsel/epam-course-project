import { describe, expect, it } from "vitest";
import { VersionRangeSchema } from "@/lib/validation/version";

describe("VersionRangeSchema", () => {
  it.each([
    [{ from: 1, to: 2 }, true],
    [{ from: 2, to: 5 }, true],
    [{ from: "1", to: "3" }, true], // coerces strings
    [{ from: 0, to: 1 }, false],
    [{ from: 1, to: 1 }, false],
    [{ from: 3, to: 2 }, false],
    [{ from: -1, to: 2 }, false],
  ])("%j → ok=%s", (input, ok) => {
    expect(VersionRangeSchema.safeParse(input).success).toBe(ok);
  });
});
