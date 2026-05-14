# Architecture Decision Records — Phase 3

This folder records the load-bearing design decisions for feature
`003-idea-listing-management`. Each ADR follows the MADR template
adopted by the constitution (Principle IX).

| ID | Title | Status |
|---|---|---|
| [0013](./0013-edit-delete-cutoff.md) | Edit/Delete cutoff for ideas is `status = SUBMITTED` | Accepted |
| [0014](./0014-listing-query-design.md) | Listing query is server-side, URL-bound, AND-semantic | Accepted |
| [0015](./0015-edited-audit-row.md) | Encode `EDITED` audit events inside `status_transitions` | Accepted |
| [0016](./0016-csv-export-streaming.md) | CSV export streams over the listing query | Accepted |
