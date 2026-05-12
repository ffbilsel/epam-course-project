#!/usr/bin/env pwsh
# Configures the repo to use ./.githooks as the hooks directory.
# Idempotent: safe to run multiple times. Run from repo root.
$ErrorActionPreference = 'Stop'

if (-not (Test-Path .git)) {
    Write-Error "Run this script from the repo root (no .git directory here)."
    exit 1
}

git config core.hooksPath .githooks
Write-Host "[install-hooks] core.hooksPath set to .githooks"

# On POSIX, mark hooks executable. On Windows, Git executes them via sh.
if ($IsLinux -or $IsMacOS) {
    Get-ChildItem .githooks -File | ForEach-Object {
        chmod +x $_.FullName
    }
    Write-Host "[install-hooks] marked hooks executable"
}

Write-Host "[install-hooks] done. Hooks now active for this clone."

