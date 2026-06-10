# 2026-06-01 Add verbose Playwright install diagnostics workflow

## Request
Investigate GitHub Actions hang where Playwright chromium download reaches 100% but step times out.

## What was added
Updated `.github/workflows/e2e-frontend.yml` with a manual debug path:

1. Added `workflow_dispatch` trigger with input `run_install_debug`.
2. Kept PR E2E job stable (Playwright container-based path).
3. Added new job `playwright-install-debug` (manual only) that reproduces host-runner install and prints high-detail diagnostics:
   - `DEBUG=pw:install,pw:download,pw:browser*`
   - environment + disk/memory context before install
   - `playwright install chromium --no-shell --dry-run` plan output
   - command-level timeout wrapping install to preserve post-failure logs
   - cache listing and zip/tmp file scan on failure
   - tail of install log
4. Added artifact upload step (always):
   - `/tmp/playwright-install.log`
   - `/tmp/playwright-install-context.log`

## Why this helps
If install hangs after download, this captures whether the process is stuck in extract, post-download hooks, cache writes, or cleanup, with timestamps and state snapshots.

## Validation
- YAML diagnostics checked in editor tooling: no errors.
