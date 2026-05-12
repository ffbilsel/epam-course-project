import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "@/lib/format/date";

describe("date formatting", () => {
  it("formatDate returns a non-empty string", () => {
    expect(formatDate(new Date("2026-05-12T15:14:00Z")).length).toBeGreaterThan(3);
  });

  it("formatDateTime returns a non-empty string", () => {
    expect(formatDateTime(new Date("2026-05-12T15:14:00Z")).length).toBeGreaterThan(5);
  });
});
