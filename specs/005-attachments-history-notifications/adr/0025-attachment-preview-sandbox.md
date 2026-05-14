# ADR-0025: Attachment preview is browser-native, served from a sandboxed inline endpoint, with a download fallback

- **Status**: Accepted
- **Date**: 2026-05-14
- **Deciders**: Phase-5 design
- **Consulted**: Phase-1 `attachments` table + magic-number sniff,
  existing `src/lib/format/plain-text.ts` escaper, NFR-006
- **Informed**: spec FR-001..FR-005, NFR-001, NFR-006, SC-005

## Context and Problem Statement

Phase 5 requires in-portal preview of attachments (images, PDF,
text, markdown) without a download round-trip, while keeping the
threat model honest: an uploader may submit a maliciously crafted
file, possibly with a misleading mime declaration.

## Decision Drivers

- NFR-006: no `<script>`, no `on*` handlers, no auto-loaded external
  resources, no arbitrary user-supplied HTML.
- FR-003: image / PDF / text / markdown inline; unsupported → graceful
  download card (no error, no broken viewer).
- Avoid adding a heavy client-side viewer library (PDF.js et al.) —
  supply-chain footprint and bundle size.
- The renderer must be theme-aware (FR-031 / SC-006) for text /
  markdown previews.

## Considered Options

1. **Browser-native rendering: `<img>` for images, sandboxed
   `<iframe>` for PDF and (server-sanitised) text / markdown, served
   from `/api/attachments/[id]/preview` with hard response headers;
   download card for everything else** (Decision).
2. Ship a client-side viewer library (PDF.js + Prism + a markdown
   renderer) and route every type through it.
3. Pre-render every uploaded file to a normalised HTML/PNG at upload
   time and serve only the normalised artefact.
4. Always download — no preview.

## Decision Outcome

Chosen option: **#1**.

- Server classifies each attachment's `previewKind` from its sniffed
  `mimeType` (the Phase-1 magic-number sniff is the source of truth;
  the extension is ignored): `image` | `pdf` | `text` | `download`.
  `image/svg+xml` is forced to `download` because sanitising
  arbitrary SVG is out of scope for this phase.
- The preview endpoint
  `GET /api/attachments/[id]/preview` streams the bytes with:
  - `Content-Type: <sniffed mime>`
  - `Content-Disposition: inline; filename="<sanitised>"`
  - `Content-Security-Policy: sandbox`
  - `X-Content-Type-Options: nosniff`
  - `Cache-Control: private, max-age=300`
- For `text/markdown` and `text/plain`, the response is
  pre-sanitised HTML (Phase-4 escaper extended with a bounded
  whitelist: `<h1..h6>`, `<p>`, `<ul>/<ol>/<li>`, `<code>`, `<pre>`,
  `<a rel="noopener noreferrer" target="_blank">`, `<strong>`,
  `<em>`, line breaks). No `<img>`, no `<iframe>`, no inline styles.
- The client wraps the preview in:
  - `<img>` for images.
  - `<iframe sandbox>` (no `allow-scripts`, no `allow-same-origin`
    unless required for PDF navigation in specific browsers, in
    which case `allow-same-origin` only) for PDF and text.
- The preview viewer is itself a focus-trapping `<dialog>` (shadcn
  primitive) that traps Tab and restores focus to the trigger on
  close. The chrome (close button, title, footer with download link)
  is token-driven so it re-themes live with the app.
- Unsupported types render a download card with name, size, type,
  and a `Download` button that streams the same endpoint with
  `Content-Disposition: attachment`.

### Positive Consequences

- Zero new client dependencies.
- The `Content-Security-Policy: sandbox` header + `sandbox` iframe
  attribute ensure that even if an attacker uploads a hostile HTML
  file (misdeclared as text/plain), it cannot run scripts, reach
  the parent origin, or fetch sub-resources.
- The server is the single oracle for "what is renderable" — the
  client never has to second-guess the mime.
- The preview viewer is implemented entirely in `src/components/
  ui/`-grade primitives; no inline `style`, no hard-coded hex.

### Negative Consequences

- Per-browser PDF chrome varies (Chromium has a toolbar; Firefox /
  Safari have a different toolbar). Acceptable per spec — the spec
  treats "rendered" as "no download was required", not "looks
  identical across browsers".
- The SVG → download routing is a known papercut. Acceptable in
  Phase 5; addressing it requires a hardened SVG sanitiser, deferred
  to a future ADR.
- Sanitised markdown loses round-trip fidelity for advanced markdown
  features (tables, footnotes). Acceptable — the use case is "read
  a one-page brief", not "render a published article".

## Pros and Cons of the Options

- **Option 2** bloats the bundle by > 1 MB and adds a substantial
  attack surface; PDF.js has had multiple CVEs in the last 24
  months.
- **Option 3** is operationally expensive (synchronous pre-render
  blocks upload for large files; async pre-render needs a worker
  pipeline) and doubles storage.
- **Option 4** fails Story 1's core UX requirement.

## Links

- Implements [FR-001..FR-005](../spec.md) (preview half) and
  [NFR-006](../spec.md).
- Reuses Phase-1 attachment magic-number sniff in
  [`src/server/attachment-service.ts`](../../../src/server/attachment-service.ts).
- Extends Phase-4 escaper
  [`src/lib/format/plain-text.ts`](../../../src/lib/format/plain-text.ts).
