import { describe, expect, it } from "vitest";
import { escapeCsvCell, formatCsvRow } from "@/lib/format/csv";

describe("escapeCsvCell", () => {
  it.each([
    ["plain", "plain"],
    ["", ""],
    ["leading space", "leading space"],
    ["trailing space ", "trailing space "],
    ["unicode ✓ é", "unicode ✓ é"],
  ])("returns unquoted cells when safe (%s)", (input, expected) => {
    expect(escapeCsvCell(input)).toBe(expected);
  });

  it("quotes embedded commas", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
  });

  it("quotes and doubles embedded double-quotes", () => {
    expect(escapeCsvCell('he said "hi"')).toBe('"he said ""hi"""');
  });

  it("quotes embedded CRLF / LF / CR", () => {
    expect(escapeCsvCell("line1\r\nline2")).toBe('"line1\r\nline2"');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvCell("line1\rline2")).toBe('"line1\rline2"');
  });

  it("renders numbers and booleans", () => {
    expect(escapeCsvCell(42)).toBe("42");
    expect(escapeCsvCell(true)).toBe("true");
  });

  it("renders null and undefined as empty", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });
});

describe("formatCsvRow", () => {
  it("joins cells with commas and ends with CRLF", () => {
    expect(formatCsvRow(["a", "b", "c"])).toBe("a,b,c\r\n");
  });

  it("escapes individual cells", () => {
    expect(formatCsvRow(['has "quote"', "a,b", null])).toBe('"has ""quote""","a,b",\r\n');
  });

  it("renders empty row as a lone CRLF", () => {
    expect(formatCsvRow([])).toBe("\r\n");
  });
});
