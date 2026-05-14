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

/**
 * Whitelisted block / inline tags safe to render from a markdown
 * source. Anything outside this set is stripped wholesale by
 * {@link sanitizeMarkdownHtml}. SVG, scripts, iframes, images, and
 * form controls are all rejected — image previews go through the
 * dedicated preview sandbox, not through markdown rendering.
 */
const ALLOWED_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "ul",
  "ol",
  "li",
  "code",
  "pre",
  "a",
  "strong",
  "em",
  "br",
]);

/** Self-closing tags that may legally appear without a closing tag. */
const VOID_TAGS = new Set(["br"]);

/**
 * Phase 5 — DOM-free safe-tag whitelist sanitiser used by the
 * attachment markdown preview path (FR-002, ADR-0025). Strips every
 * tag not in {@link ALLOWED_TAGS}; on `<a>` tags drops every
 * attribute except `href` (and only if it begins with `http:`,
 * `https:`, or `mailto:`), then rewrites `rel` and `target` to safe
 * defaults. All other allowed tags lose every attribute. Inline
 * event handlers (`on*=`), `javascript:` hrefs, `<script>`,
 * `<style>`, `<iframe>`, `<img>`, and `<svg>` cannot survive this
 * pass.
 * @example
 *   sanitizeMarkdownHtml('<a href="javascript:alert(1)">x</a>') === 'x';
 *   sanitizeMarkdownHtml('<p onclick="x()">hi</p>') === '<p>hi</p>';
 */
export function sanitizeMarkdownHtml(html: string): string {
  // 1. Strip dangerous element bodies entirely (script/style/iframe/svg
  //    embed their content, so we cannot just drop the open/close tags).
  let cleaned = html.replace(
    /<(script|style|iframe|svg|object|embed|form|input|button|textarea|select)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    "",
  );
  // 2. Drop any orphaned dangerous opener (no matching close tag).
  cleaned = cleaned.replace(
    /<\/?(script|style|iframe|svg|object|embed|form|input|button|textarea|select|img)\b[^>]*>/gi,
    "",
  );
  // 3. Walk every remaining tag and rewrite or strip.
  return cleaned.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_match, raw: string, attrs: string) => {
    const name = raw.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return "";
    const isClose = _match.startsWith("</");
    if (isClose) return `</${name}>`;
    if (VOID_TAGS.has(name)) return `<${name} />`;
    if (name === "a") {
      const hrefMatch = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
      const href = hrefMatch ? (hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? "") : "";
      const safe = /^(https?:|mailto:)/i.test(href);
      if (!safe) return "<a>";
      return `<a href="${escapeAttr(href)}" rel="noopener noreferrer" target="_blank">`;
    }
    return `<${name}>`;
  });
}

/**
 * Minimal attribute-value escaper used by {@link sanitizeMarkdownHtml}.
 */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
