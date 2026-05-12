---
description: Commit & push discipline (Constitution VIII) — auto-commit
  and auto-push policy for every meaningful unit of work.
applyTo: "**"
---

# Commit & Push Discipline

This file binds the agent to **[Constitution Principle VIII][principle]**
and **Quality Gate #10**. It applies to all work in this repository.

[principle]: ../../.specify/memory/constitution.md

## Rules the agent MUST follow

1. **Commit autonomously.** As soon as a meaningful unit of work
   reaches a coherent state — a finished SpecKit step, a refactor that
   leaves the tree compiling, a green test for a new behaviour — the
   agent MUST stage the relevant files and create a commit. The user
   does not need to ask.

2. **Use Conventional Commits.** Every commit message MUST follow
   `<type>(<scope>): <subject>` with one of `feat`, `fix`, `docs`,
   `chore`, `refactor`, `test`, `build`, `ci`, `perf`. Subject is
   imperative, ≤ 72 chars, no trailing period. Body explains *why*
   when the *what* is non-obvious. SpecKit-driven commits MUST name
   the slash command they correspond to (e.g. `/speckit.plan`).

3. **Push immediately.** The repo's `post-commit` hook
   (`.githooks/post-commit`) auto-pushes to the tracked upstream. If
   the hook is not installed, the agent MUST run
   `pwsh -File scripts/install-hooks.ps1` once, or `git push` after
   the commit. Operating with no upstream set is a Quality-Gate-#10
   failure.

4. **One unit, one commit.** Do not bundle unrelated changes. If a
   work session produces a spec edit AND a code change, that's two
   commits.

5. **Never force-push** to `main` or to any branch with an open PR.

6. **Never commit secrets.** `.env*` is gitignored; `gitleaks` may run
   in CI. If the agent notices a secret in a staged hunk, it MUST
   abort the commit and surface the issue.

7. **Branch hygiene.** Feature work happens on the SpecKit-named
   branch (e.g. `001-innovatepam-portal-mvp`). The agent does not
   commit feature work to `main`.

## Escape hatches

- `SPECIFY_NO_AUTO_PUSH=1` — the post-commit hook will skip the push
  (useful for a deliberate batch of commits the agent will push at
  the end). The agent MUST still push before its turn ends.
- A user can override these rules in any single message ("don't push
  yet"); the override applies only to that turn.

## SpecKit integration

The SpecKit `git` extension's `auto_commit` map in
[`.specify/extensions/git/git-config.yml`](../../.specify/extensions/git/git-config.yml)
is enabled for every `before_*` and `after_*` event. This means each
slash command (`/speckit.specify`, `/speckit.plan`, `/speckit.tasks`,
`/speckit.implement`, …) records a commit automatically. The agent
MUST keep these entries enabled.
