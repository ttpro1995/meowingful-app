# 2026-06-01 Frontend E2E CI Playwright timeout fix (follow-up)

## Problem
Frontend E2E GitHub Action timed out in the Playwright browser install step.
The workflow used `PLAYWRIGHT_BROWSERS_PATH: ~/.cache/ms-playwright`, which Playwright treats as a literal path string (not shell-expanded), causing browser binaries to be installed in a non-cached location.

## Root cause validated
Running Playwright dry-run with `PLAYWRIGHT_BROWSERS_PATH='~/.cache/ms-playwright'` showed install location resolved to:
`front-end/~/.cache/ms-playwright/...`
instead of the expected home cache path.

This caused cache mismatch and repeated heavy installs. The command also installed extra Chromium headless shell assets, increasing cold-start time.

## Changes made
Updated `.github/workflows/e2e-frontend.yml`:

1. Set absolute browser cache path:
   - `PLAYWRIGHT_BROWSERS_PATH: /home/runner/.cache/ms-playwright`
2. Updated cache path to match absolute location.
3. Added cache step id:
   - `id: playwright-cache`
4. Split dependency and browser install:
   - Added `npx playwright install-deps chromium` (always run)
   - Browser install only on cache miss:
     - `if: steps.playwright-cache.outputs.cache-hit != 'true'`
5. Reduced browser payload size on cold install:
   - `npx playwright install chromium --no-shell`
6. Increased cold install timeout from 15 to 30 minutes.

## Why this should fix CI
- Cache now points to the exact directory Playwright uses in CI.
- Cache hits skip browser download/extract entirely.
- Cold installs are lighter (`--no-shell`) and have a safer timeout budget.
- System dependencies remain installed every run for reliability on fresh runners.

## Validation
- YAML diagnostics checked in editor tooling: no errors.
- Command semantics verified locally with Playwright CLI help and dry-run output.
