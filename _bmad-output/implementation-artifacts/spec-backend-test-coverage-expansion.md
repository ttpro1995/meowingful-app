---
title: 'Backend Test Coverage Expansion — Completed EPIC-01 and EPIC-02 Stories'
type: 'chore'
created: '2026-09-05'
status: 'ready-for-dev'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - vibe-doc/stories/EPIC-01/STORY-E01-01-ci-cd-enhancement.md
  - vibe-doc/stories/EPIC-01/STORY-E01-04-jwt-refresh-sessions.md
  - vibe-doc/stories/EPIC-01/STORY-E01-07-api-standardization.md
  - vibe-doc/stories/EPIC-02/STORY-E02-01-tenant-management.md
  - vibe-doc/stories/EPIC-02/STORY-E02-02-rbac-framework.md
  - vibe-doc/stories/EPIC-02/STORY-E02-03-user-tenant-membership.md
  - vibe-doc/stories/EPIC-02/STORY-E02-04-tenant-configuration.md
warnings:
  - multiple-goals
deferred: []
baseline_revision: '3ff48e3b67075e2fff2172521cb54e5d777920e6'
---

## Intent

**Problem:** Several backend modules implemented for completed EPIC-01 and EPIC-02 stories have unit-test coverage gaps, especially in error-formatting edge cases, pagination boundary conditions, tenant service flows, tenant-config cache invalidation, feature-guard inference, JWT refresh/session flows, RBAC resolver branches, and membership service flows. Coverage report shows `tenant.service.ts` at 46% lines / 28% branches, `error-format.plugin.ts` at 48% branches, and several other stories have explicit "Remaining" or unchecked acceptance criteria tied to untested paths.

**Approach:** Expand existing `*.spec.ts` files (no new test infrastructure, no source changes) with focused unit-test cases that target:
- Acceptance criteria marked unchecked in completed stories
- Branches in `lcov.info` that are uncovered (`branchesTrue` = 0%)
- Edge cases explicitly called out in story testing-strategy sections

## Boundaries & Constraints

**Always:** Preserve existing test behavior (no test deletions, no signature changes); only add new test cases or `describe` blocks; preserve existing architecture and runtime semantics.

**Block If:** Adding a test would require changes to source code beyond fixing a typo in production code paths the test exercises. Refactor or extend test fixtures instead.

**Never:**
- Modify generated artifacts (`schema.gql`, `dist/`, `coverage/`, `node_modules/`, `prisma/migrations/*`).
- Change existing production code in `back-end/src/` — only test files (`*.spec.ts`) may be modified.
- Remove or weaken existing assertions to make tests pass.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | New tests target documented ACs of completed EPIC-01 / EPIC-02 stories | All new tests pass; existing 198 tests remain passing | None |
| HAPPY_PATH | Coverage run after expansion | Line coverage on target files increases; overall coverage ≥ 70% (current 70.17%) | None |
| ERROR_CASE | A new test reproduces an uncovered branch from `lcov.info` | The branch is executed and asserted | None |
| ERROR_CASE | A test fails because source behavior differs from doc | Test failure points to a real gap; do not delete the test, leave a TODO comment |

## Code Map

Files to expand (existing spec files; only additive changes):

- `back-end/src/shared/errors/error-format.plugin.spec.ts` — STORY-E01-07. Add: serialized HttpException mapping, `UNAUTHORIZED`/`FORBIDDEN` mapping, dev-mode passthrough, GRAPHQL_VALIDATION_FAILED extension handling, `INTERNAL_SERVER_ERROR` masking, non-string validation messages.
- `back-end/src/shared/pagination/paginate.spec.ts` — STORY-E01-07. Add: `NaN`, `Infinity`, `undefined` page/limit, negative page, fractional limit, default-when-undefined.
- `back-end/src/tenant/tenant.service.spec.ts` — STORY-E02-01. Add: `createTenant`, `updateTenant`, `deactivateTenant` happy paths; pagination / filter / orderBy applied to Prisma; super-admin `tenants` query; `myTenant` resolution.
- `back-end/src/tenant/tenant-config.service.spec.ts` — STORY-E02-04. Add: `updateTenantConfig` permission denial, `setFeatureFlag` super-admin path for non-CRM features, `uploadTenantLogo` invalid file type, `getTenantConfigByTenantId` cache miss fallthrough, business-hours normalization, `tenantConfig` accessor paths.
- `back-end/src/tenant/feature.guard.spec.ts` — STORY-E02-04. Add: explicit non-lead permission metadata is ignored (no feature enforcement), HTTP context variant, both handler+class metadata, undefined `features` row.
- `back-end/src/tenant/tenant.guard.spec.ts` — STORY-E02-01. Add: refresh-token mutation path, HTTP context variant, expired token rejection, malformed `Authorization` header, public `login` mutation allow.
- `back-end/src/auth/auth.service.spec.ts` — STORY-E01-04. Add: refresh-token rotation, refresh-token revoked from Redis returns null, logout deletes refresh-token jti, login rate-limit, password verification paths.
- `back-end/src/auth/auth.resolver.spec.ts` — STORY-E01-04. Add: `refreshToken` resolver happy path, logout resolver, expired/invalid refresh cookie returns `UserError`.
- `back-end/src/rbac/rbac.resolver.spec.ts` — STORY-E02-02. Add: assign/remove role paths, permission grant/revoke paths, list branches.
- `back-end/src/membership/membership.service.spec.ts` — STORY-E02-03. Add: invitation accept/reject branches, role update paths, member listing pagination.

## Tasks & Acceptance

**Execution:**
- Expand `error-format.plugin.spec.ts` — add cases for serialized HttpException, dev/prod mode switch, FORBIDDEN/UNAUTHORIZED mapping, INTERNAL_SERVER_ERROR masking
- Expand `paginate.spec.ts` — add cases for undefined/NaN/Infinity/negative/fractional inputs
- Expand `tenant.service.spec.ts` — add cases for create/update/deactivate tenants and super-admin `tenants` query
- Expand `tenant-config.service.spec.ts` — add cases for permission denial, cache invalidation, business-hours normalization, logo upload edge cases
- Expand `feature.guard.spec.ts` — add cases for inferred feature branches and HTTP context
- Expand `tenant.guard.spec.ts` — add cases for refresh mutation, HTTP context, malformed header
- Expand `auth.service.spec.ts` — add cases for refresh-token rotation, revocation, logout cleanup
- Expand `auth.resolver.spec.ts` — add cases for refresh and logout resolvers
- Expand `rbac.resolver.spec.ts` — add cases for role assignment, permission grant/revoke
- Expand `membership.service.spec.ts` — add cases for invitation accept/reject and member listing pagination

**Acceptance Criteria:**
- Given expanded test suites, when `cd back-end && npm run test` runs, then all suites pass and the test count strictly increases from 198.
- Given expanded test suites, when `cd back-end && npm run test:cov` runs, then overall line coverage ≥ 70% and per-file coverage on expanded files strictly increases for at least 5 files.
- Given ESLint config, when `cd back-end && npm run lint` runs, then zero errors and zero warnings.
- Given `git status`, the working tree contains only changes to `*.spec.ts` files (no source code changes).

## Spec Change Log

## Review Triage Log

## Design Notes

- The `*.spec.ts` files in this project follow a unit-test pattern using mock service dependencies and `jest.fn()` for Prisma, CacheService, etc. New tests should follow the same pattern.
- Tests should target uncovered branches from the lcov report, but new tests that target documented ACs take priority when branches and ACs overlap.
- When expanding a `describe` block, prefer to add new `it` cases rather than restructure the existing suite. This minimizes diff size and review surface.

## Verification

**Commands:**
- `cd back-end && npm run lint` — expect zero errors, zero warnings
- `cd back-end && npm run test` — expect all suites pass; test count > 198
- `cd back-end && npm run test:cov` — expect coverage ≥ 70%; per-file coverage on expanded files strictly increases for at least 5 files
- `cd back-end && npx jest --config ./test/jest-e2e.json --listTests` — expect e2e test list unchanged