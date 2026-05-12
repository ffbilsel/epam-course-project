# Repository Git hooks

This folder is the project's tracked `core.hooksPath`. Enable it once
per clone with:

```powershell
# PowerShell
git config core.hooksPath .githooks
```

```bash
# bash / zsh
git config core.hooksPath .githooks
chmod +x .githooks/*
```

Or run the cross-platform installer:

```powershell
pwsh -File scripts/install-hooks.ps1
```

## Hooks

- **post-commit** — implements Constitution Principle VIII (Commit &
  Push Discipline) by pushing every new commit to the upstream of the
  current branch immediately after it lands locally. Set
  `SPECIFY_NO_AUTO_PUSH=1` to skip during batch operations.
- **post-merge** — same auto-push behaviour for merge commits, so
  end-of-feature `git merge --no-ff` (Principle X) lands on `origin`
  immediately. Honours the same `SPECIFY_NO_AUTO_PUSH=1` escape hatch.
