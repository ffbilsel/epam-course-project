/**
 * Plain-text → safe HTML converter for comment bodies (NFR-007).
 *
 * Comments are stored as plain text. When rendered into the DOM we
 * escape the five special HTML characters and then convert any
 * newline (`\r\n` or `\n`) into a `<br />` tag. The output is a
 * `string` that the caller may inject via
 * `dangerouslySetInnerHTML` — every character outside the explicit
 * `<br />` markup is HTML-escaped, so no untrusted markup can leak
 * through.
 * @example
 *   escapeAndLinebreak("a < b\nc & d") === "a &lt; b<br />c &amp; d"
 */
export function escapeAndLinebreak(input: string): string {
  const escaped = input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  return escaped.replace(/\r\n|\r|\n/g, "<br />");
}
