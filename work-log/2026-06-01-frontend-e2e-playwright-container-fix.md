# 2026-06-01 Frontend E2E CI fix: use Playwright container image

## Problem
The frontend E2E workflow still timed out during Playwright browser installation:
- `npx playwright install chromium --no-shell`
- timeout after 30 minutes on cold runs

Even with browser cache configured correctly, first successful cache population depends on one full install finishing. In this case, cold download/extract remained unstable and repeatedly hit step timeout.

## Change made
Updated `.github/workflows/e2e-frontend.yml` to run the job inside the official Playwright image:
- Added job container:
  - `mcr.microsoft.com/playwright:v1.52.0-noble`
- Removed browser cache and browser/deps install steps:
  - `actions/cache` for Playwright binaries
  - `npx playwright install-deps chromium`
  - `npx playwright install chromium --no-shell`
- Kept frontend-only flow:
  - checkout
  - setup node
  - `npm ci`
  - `npm run test:e2e`
- Changed Node version in workflow from `24` to `22` for stable LTS parity in CI.

## Why this should fix timeout
The Playwright container includes browser binaries and required OS dependencies out of the box, so CI no longer performs the large browser download step that was timing out.

## Validation
- Checked workflow diagnostics in editor tooling: no YAML errors.
