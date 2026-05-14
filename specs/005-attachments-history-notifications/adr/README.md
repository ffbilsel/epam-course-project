# Architecture Decision Records — Phase 5

This folder records the load-bearing design decisions for feature
`005-attachments-history-notifications`. Each ADR follows the MADR
template adopted by the constitution (Principle IX).

| ID | Title | Status |
|---|---|---|
| [0023](./0023-nodemailer-smtp-transport.md) | Outbound mail uses nodemailer SMTP with a queued, retried, transport-injected dispatcher | Accepted |
| [0024](./0024-version-history-and-diff-strategy.md) | Idea versions are whole snapshots; diffs come from the `diff` npm package, computed server-side | Accepted |
| [0025](./0025-attachment-preview-sandbox.md) | Attachment preview is browser-native (img / sandboxed iframe) with a server-classified `previewKind` and a download fallback | Accepted |
| [0026](./0026-in-app-notification-polling.md) | In-app notification badge polls every 60 s with a visibility-pause; no SSE / WebSocket / push | Accepted |
