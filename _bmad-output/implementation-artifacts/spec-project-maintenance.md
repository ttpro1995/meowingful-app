---
title: 'Project Maintenance'
type: 'chore'
created: '2026-09-05'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings:
  - multiple-goals
deferred:
  - summary: >-
      Backend has 4 high-severity advisories (deepmerge-ts, mysql2) that require
      `npm audit fix --force`, which would upgrade `prisma` to v6.19.3 — a breaking change.
    evidence: |-
      `cd back-end && npm audit --audit-level=high` after `npm audit fix` still reports 4 high vulnerabilities; fix available only via `--force`.
    severity: high
    blocking: true
    reason: Block If constraint in spec prohibits force-upgrading without human decision.
baseline_revision: '3ff48e3b67075e2fff2172521cb54e5d777920e6'
---

## Intent

**Problem:** The project has accumulated technical debt: vulnerable dependencies, a failing backend unit test, and ambiguous directory-path guidance in `AGENTS.md` that leads agents to run npm commands from the repo root instead of the correct subproject.

**Approach:** Audit dependencies, fix the failing test and lint errors, and clarify the documented command paths in `AGENTS.md`.

## Boundaries & Constraints

**Always:** Preserve existing architecture and test behavior; do not change runtime semantics beyond the targeted fixes.

**Block If:** Dependency upgrades require breaking changes (`npm audit fix --force` would upgrade `prisma`); halt for human decision rather than force-upgrade.

**Never:** Modify generated artifacts (`schema.gql`, `dist/`, `coverage/`, `node_modules/`, `prisma/migrations/*`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Run backend tests | 198/198 pass | None |
| ERROR_CASE | Login resolver test without req | TypeError on undefined headers | Fixed by supplying req with headers and ip |

## Code Map

- `back-end/package.json` -- backend dependencies; 4 high-severity advisories remain after `npm audit fix` (require breaking `prisma` upgrade to resolve)
- `front-end/package.json` -- frontend dependencies; 0 high-severity advisories after `npm audit fix`
- `back-end/src/auth/auth.resolver.ts:86` -- `getClientIp` reads `req.headers['x-forwarded-for']`; requires `req` to be passed in login test
- `back-end/src/auth/auth.resolver.spec.ts:84` -- login test was missing `req` arg; fixed by adding mock req and updating expectation to include `ipAddress`
- `back-end/src/audit/audit.helpers.ts:47` -- `String(value)` triggered `@typescript-eslint/no-base-to-string`; replaced with `JSON.stringify(value)` for JSON-safe output
- `back-end/src/audit/audit.service.ts:378,394` -- test-provider `close` methods were `async` with no `await`; removed unnecessary `async`
- `back-end/src/dashboard/dashboard.resolver.ts:55` -- subscription arg `_dateRange` intentionally unused; block-disabled lint rule locally
- `back-end/src/dashboard/dashboard.service.spec.ts:190` -- unsafe `any` member access on jest mock call; typed as `[string, string] | undefined`
- `AGENTS.md` -- clarified that backend/frontend commands run from `back-end/` and `front-end/`, and updated path prefixes from `src/` to `back-end/src/` and `front-end/src/`

## Tasks & Acceptance

**Execution:**
- `back-end` -- run `npm audit fix` and review remaining advisories -- resolve non-breaking vulnerabilities
- `front-end` -- run `npm audit fix` and review remaining advisories -- resolve non-breaking vulnerabilities
- `back-end` -- run `npm run lint` -- expect zero errors
- `back-end` -- run `npm run test` -- expect 198/198 pass
- `front-end` -- run `npm run lint` -- expect zero errors
- `front-end` -- run `npm run test:run` -- expect 38/38 pass
- `AGENTS.md` -- clarify subproject command paths and src directory prefixes -- prevent agents from running npm commands at repo root

**Acceptance Criteria:**
- Given clean working tree, when `npm audit` runs in each subproject, then no high-severity advisories remain without explicit decision to defer.
- Given test suite, when `npm run test` runs in `back-end/`, then all suites pass.
- Given test suite, when `npm run test:run` runs in `front-end/`, then all suites pass.
- Given lint config, when `npm run lint` runs in each subproject, then ESLint reports zero errors.

## Spec Change Log

## Review Triage Log

### 2026-09-05 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 6: (high 2, medium 2, low 2)
- defer: 3: (high 1, medium 1, low 1)
- reject: 3
- addressed_findings:
  - `[high]` `[patch]` Restored `async` on `audit.service.ts` test-provider `close` methods to satisfy `Promise<void>` interface contract; added targeted `eslint-disable` comments for `require-await`.
  - `[high]` `[patch]` Wrapped `JSON.stringify(value)` in `audit.helpers.ts` with `try/catch` fallback to `String(value)` to prevent throws on circular references and BigInt.
  - `[medium]` `[patch]` Narrowed `eslint-disable` scope in `dashboard.resolver.ts` from file-level block to single-line comment on the unused `_dateRange` parameter.
  - `[medium]` `[patch]` Restored explicit mock-call assertion in `dashboard.service.spec.ts` to avoid silently parsing an empty object when `cacheSet` is not called.
  - `[medium]` `[patch]` Restored explicit `(result as { id: unknown }).id` casts in `tenant.resolver.ts` and `tenant-config.resolver.ts` to preserve type-narrowing safety after Prettier reformat.
  - `[low]` `[patch]` Added `eslint-disable` comment for `no-base-to-string` in `audit.helpers.ts` fallback branch where `String()` is intentionally used as a safe fallback.

## Design Notes

## Verification

**Commands:**
- `cd back-end && npm audit` -- expect 4 high-severity advisories remain (deferred: requires breaking prisma upgrade)
- `cd back-end && npm audit fix` -- expect non-breaking fixes applied; 4 high remain
- `cd back-end && npm run lint` -- expect zero errors
- `cd back-end && npm run test` -- expect 198/198 pass
- `cd front-end && npm audit` -- expect zero high-severity advisories
- `cd front-end && npm audit fix` -- expect zero high-severity advisories after fix
- `cd front-end && npm run lint` -- expect zero errors
- `cd front-end && npm run test:run` -- expect 38/38 pass

## Auto Run Result

Status: done
Blocking condition: 4 high-severity backend advisories remain deferred pending human decision on breaking `prisma` upgrade.

Summary of implemented change:
- Fixed failing backend unit test in `auth.resolver.spec.ts` by supplying missing `req` mock with `headers` and `ip`.
- Fixed 5 back-end ESLint errors (`audit.helpers.ts`, `audit.service.ts`, `dashboard.resolver.ts`, `dashboard.service.spec.ts`, `tenant.resolver.ts`, `tenant-config.resolver.ts`).
- Clarified subproject command paths and `src/` directory prefixes in `AGENTS.md` to prevent agents from running npm commands at repo root.
- Ran `npm audit fix` in both subprojects; front-end is clean, back-end has 4 high advisories requiring breaking upgrade.

Files changed with one-line descriptions:
- `AGENTS.md` -- clarified `back-end/` and `front-end/` command paths and `src/` prefixes
- `back-end/src/auth/auth.resolver.spec.ts` -- added mock `req` to login test and updated expectation to include `ipAddress`
- `back-end/src/audit/audit.helpers.ts` -- replaced `String(value)` with `JSON.stringify(value)` plus `try/catch` fallback; suppressed lint rule in fallback branch
- `back-end/src/audit/audit.service.ts` -- restored `async` on test-provider `close` methods with targeted `eslint-disable` comments
- `back-end/src/dashboard/dashboard.resolver.ts` -- narrowed `eslint-disable` scope to unused `_dateRange` parameter only
- `back-end/src/dashboard/dashboard.service.spec.ts` -- restored explicit mock-call assertion to avoid silent empty-object fallback
- `back-end/src/tenant/tenant.resolver.ts` -- restored explicit type cast for `result.id` check
- `back-end/src/tenant/tenant-config.resolver.ts` -- restored explicit type cast for `result.tenantId` check
- `back-end/package-lock.json` -- updated by `npm audit fix`
- `front-end/package-lock.json` -- updated by `npm audit fix`

Review findings breakdown:
- Patches applied: 6 (2 high, 2 medium, 2 low)
- Items deferred: 3 (backend 4 high advisories requiring breaking prisma upgrade; lockfile/package.json mismatches; graphql-ws peer dependency expansion without adoption)
- Items rejected: 3 (cosmetic import formatting, unnecessary parentheses, formatting noise)

Follow-up review recommendation: true
- Patched counts by severity: high 2, medium 2, low 2
- Score: 2*1 + 2*3 + 2*1 = 10, which is >= 5

Verification performed:
- `cd back-end && npm run lint` -- zero errors
- `cd back-end && npm run test` -- 198/198 pass
- `cd front-end && npm run lint` -- zero errors
- `cd front-end && npm run test:run` -- 38/38 pass
- `cd back-end && npm audit` -- 4 high-severity advisories remain (deferred)
- `cd front-end && npm audit` -- 0 vulnerabilities

Residual risks:
- Backend dependency tree contains 4 high-severity advisories that cannot be resolved without upgrading `prisma` from v7.x to v6.19.3, which is a breaking change requiring human approval.
- `npm audit fix` introduced lockfile changes that are not reflected in `package.json`; future `npm install` may re-resolve to different versions.
