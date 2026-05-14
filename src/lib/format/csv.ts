/**
 * Minimal RFC 4180 CSV writer. The output is streaming-friendly: one
 * row in, one CRLF-terminated string out. Cells may be `string`,
 * `number`, `boolean`, `null`, or `undefined`; `null`/`undefined`
 * become an empty field. Quoting is applied only when a cell
 * contains a comma, a double-quote, a CR, or an LF; embedded
 * double-quotes are doubled per the spec.
 */
export type CsvCell = string | number | boolean | null | undefined;

const MUST_QUOTE = /[",\r\n]/;

/**
 * Escapes a single cell. Exported for unit testing.
 */
export function escapeCsvCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return "";
  const s = typeof cell === "string" ? cell : String(cell);
  if (!MUST_QUOTE.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Formats a single CSV row, terminating with CRLF as the spec
 * requires.
 */
export function formatCsvRow(cells: readonly CsvCell[]): string {
  return cells.map(escapeCsvCell).join(",") + "\r\n";
}
