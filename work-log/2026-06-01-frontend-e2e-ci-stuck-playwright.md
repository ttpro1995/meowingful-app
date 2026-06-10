# 2026-06-01 Frontend E2E CI stuck at Playwright install

## Context
Frontend GitHub Action E2E job appeared stuck during the Playwright browser installation phase.
The logs showed long dependency installation and browser download output.

## Changes made
- Updated `.github/workflows/e2e-frontend.yml`.
- Removed unused backend service setup from this frontend-only E2E workflow:
  - Removed PostgreSQL and Redis service containers.
  - Removed backend install/build/start steps.
- Added Playwright browser cache:
  - Cached `~/.cache/ms-playwright` via `actions/cache@v4`.
- Reduced Playwright install scope:
  - Changed install command to `npx playwright install --with-deps chromium`.
- Improved non-interactive and timeout behavior:
  - Set `DEBIAN_FRONTEND=noninteractive` for install step.
  - Added `timeout-minutes: 15` to browser install and E2E test steps.
- Kept test execution as `npm run test:e2e` in `front-end`.

## Why this should help
- Frontend E2E tests in this repo mock GraphQL, so backend startup is unnecessary overhead.
- Installing only Chromium aligns with Playwright config (single Chromium project) and avoids extra browser downloads.
- Browser cache reduces repeated download time on later runs.
- Step timeouts prevent indefinite waiting behavior.

## Validation
- Checked updated workflow YAML for errors in editor tooling: no errors found.
