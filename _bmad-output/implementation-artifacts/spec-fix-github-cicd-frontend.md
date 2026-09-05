---
title: 'Fix GitHub CI frontend Playwright container version'
type: 'bugfix'
created: '2026-09-05'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
baseline_revision: 'af54c6d28a1955920e577963dc80648cffc46046'
---

## Intent

**Problem:** The frontend GitHub Actions E2E job uses the Playwright `v1.52.0-noble` container, while the frontend lockfile installs Playwright `1.59.1`. Playwright therefore cannot find its browser executable in CI and the E2E job fails before tests run.

**Approach:** Align the frontend E2E job's Playwright container tag with the lockfile's resolved Playwright version so the bundled browser executable matches the test runner.

## Boundaries & Constraints

**Always:** Keep the workflow frontend-only, preserve the existing test command and CI triggers, and keep the container on the Noble image family.

**Block If:** The installed Playwright version changes or cannot be determined from the lockfile without changing dependencies; do not choose a version speculatively.

**Never:** Do not add runtime browser downloads to the E2E job, change application code, alter Playwright tests, or modify generated artifacts.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| HAPPY_PATH | CI installs frontend dependencies from `front-end/package-lock.json` | The E2E container and test runner use Playwright `1.59.1`; Chromium launches and tests execute | No error expected |
| VERSION_DRIFT | Workflow image tag differs from the lockfile's resolved Playwright version | The implementation must not silently proceed with a mismatched tag | Stop and re-check the resolved version before editing |

## Code Map

- `.github/workflows/e2e-frontend.yml` -- `frontend-e2e.container.image` controls the browser runtime used by the failing pull-request E2E job; this is the only production configuration change required.
- `front-end/package.json` -- declares `@playwright/test` with a caret range; read-only evidence for the dependency family and test script.
- `front-end/package-lock.json` -- resolves `@playwright/test`, `playwright`, and `playwright-core` to `1.59.1`; authoritative version evidence for the container tag.
- `front-end/playwright.config.ts` -- defines the Chromium project and `npm run test:e2e` web server behavior; read-only evidence that no browser configuration change is needed.

## Tasks & Acceptance

**Execution:**
- `.github/workflows/e2e-frontend.yml` -- update the `frontend-e2e` container image from `v1.52.0-noble` to `v1.59.1-noble` -- align the bundled Chromium executable with the lockfile-resolved Playwright runtime.

**Acceptance Criteria:**
- Given the frontend lockfile resolves Playwright packages to `1.59.1`, when the pull-request E2E workflow starts, then its Playwright container is `mcr.microsoft.com/playwright:v1.59.1-noble`.
- Given the aligned container and installed dependencies, when `npm run test:e2e` runs in the frontend job, then Playwright can launch Chromium without an executable-missing error.
- Given the workflow update, when its YAML is inspected, then existing triggers, dependency installation, test command, and frontend-only scope remain unchanged.

## Verification

**Commands:**
- `grep -n "image: mcr.microsoft.com/playwright" .github/workflows/e2e-frontend.yml` -- expected: exactly `mcr.microsoft.com/playwright:v1.59.1-noble` for the frontend E2E job.
- `grep -A2 'node_modules/@playwright/test' front-end/package-lock.json` -- expected: resolved version remains `1.59.1`.
- `cd front-end && npm run test:e2e` -- expected: Chromium launches and the frontend E2E suite completes without a missing executable error.

## Review Triage Log

### 2026-09-05 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 0
- reject: 17 (high 0, medium 0, low 17)
- addressed_findings:
	- none

## Auto Run Result

Status: done

Summary of implemented change:
- Updated the frontend pull-request E2E job to use the Playwright `v1.59.1-noble` container, matching the lockfile-resolved Playwright runtime and bundled browser.

Files changed with one-line descriptions:
- `.github/workflows/e2e-frontend.yml` -- aligned the frontend E2E container image with Playwright `1.59.1`.
- `_bmad-output/implementation-artifacts/spec-fix-github-cicd-frontend.md` -- recorded the implementation contract, review, and verification results.

Review findings breakdown: patches applied 0, items deferred 0, items rejected 17.

Follow-up review recommendation: false
- Patched counts by severity: high 0, medium 0, low 0
- Score: 0

Verification performed:
- Workflow inspection confirmed `mcr.microsoft.com/playwright:v1.59.1-noble`.
- Lockfile inspection confirmed `@playwright/test` resolves to `1.59.1`.
- `cd front-end && npm run test:e2e` passed all 6 tests in 7.9 seconds; Chromium launched successfully. Existing `myTenant` console warnings did not fail the suite.
- The required review layers found no actionable edge-case or verification-gap issues.

Residual risks:
- GitHub Actions itself was not rerun from this local session, so the final confirmation is based on the aligned image declaration and the passing frontend E2E suite.