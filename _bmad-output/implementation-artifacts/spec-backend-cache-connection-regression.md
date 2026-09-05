---
title: 'Fix backend regression caused by Redis cache shutdown'
type: 'bugfix'
created: '2026-09-05'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - back-end/src/redis/cache.service.ts
  - back-end/src/redis/cache.service.spec.ts
warnings: []
deferred: []
baseline_revision: '7abefd11b090e97d0d852ae41fc12c746cbc9348'
---

<intent-contract>

## Intent

**Problem:** Backend regression tests report `CacheService` failures such as `Failed to set cache key ... Connection is closed` while Nest application modules are being torn down in CI. `CacheService` currently disconnects a lazy Redis client without accounting for cache operations still in flight.

**Approach:** Track cache operations started by `CacheService` and drain them before Redis teardown. Preserve current error logging, rethrow behavior, and the existing fast shutdown for clients with no pending work.

## Boundaries & Constraints

**Always:** Keep public cache method signatures and runtime error behavior unchanged; make teardown safe for concurrent `set`, `get`, `del`, `exists`, and `ping` calls; add focused unit coverage for the lifecycle race.

**Block If:** The fix requires changing Redis package versions, database schema, CI service definitions, or unrelated audit behavior.

**Never:** Suppress cache errors, weaken existing assertions, add arbitrary delays, or modify generated artifacts and coverage output.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | A cache operation is pending when `onModuleDestroy` runs | Teardown waits for the operation before quitting or disconnecting Redis | No error is introduced |
| HAPPY_PATH | Redis client is in `wait` state with no pending operations | Client is disconnected without attempting an unusable quit handshake | Existing behavior is preserved |
| ERROR_CASE | A tracked cache operation rejects during teardown | Teardown still completes and the operation retains its existing logged/rejected result | Do not mask the original operation error |

</intent-contract>

## Code Map

- `back-end/src/redis/cache.service.ts` -- owns all CacheService Redis calls and `onModuleDestroy`; add in-flight operation tracking at this lifecycle boundary.
- `back-end/src/redis/cache.service.spec.ts` -- focused unit suite; extend the existing Redis mock to verify teardown waits and handles rejected operations.
- `back-end/src/redis/redis.module.ts` -- creates the lazy ioredis client and is relevant context; no configuration change is expected.
- `back-end/test/redis.e2e-spec.ts` -- repeatedly closes Nest modules after cache calls; this is the regression surface used for integration validation.

## Tasks & Acceptance

**Execution:**
- `back-end/src/redis/cache.service.ts` -- track promises for every cache operation and await their settlement before teardown -- prevent Redis clients from being closed while commands are pending.
- `back-end/src/redis/cache.service.spec.ts` -- add lifecycle tests for pending and rejected operations -- prove the race fix without relying on a live Redis service.

**Acceptance Criteria:**
- Given a cache command is pending, when `onModuleDestroy` runs, then the Redis client is not disconnected until that command settles.
- Given a tracked command rejects, when `onModuleDestroy` runs, then teardown resolves without replacing the command's existing rejection behavior.
- Given the focused backend test suite, when `npm test -- --runInBand src/redis/cache.service.spec.ts` runs from `back-end/`, then all tests pass.
- Given the backend project, when `npm run lint` and `npm run build` run from `back-end/`, then they complete without new errors.

## Spec Change Log

## Review Triage Log

### 2026-09-05 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2: (medium 2)
- defer: 0
- reject: 0
- addressed_findings:
  - `[medium]` `[patch]` Teardown drained only one snapshot of pending operations; changed shutdown to drain repeated snapshots and added a late-tracked operation test.
  - `[medium]` `[patch]` Lifecycle coverage exercised only `set`; added pending-operation tests for `get`, `del`, `exists`, and `ping`, plus idle `wait` shutdown coverage.

## Design Notes

Use promise settlement tracking rather than timers or Redis status polling. This keeps teardown deterministic and covers every CacheService operation through one local mechanism while leaving Redis connection configuration unchanged.

## Verification

**Commands:**
- `cd back-end && npm test -- --runInBand src/redis/cache.service.spec.ts` -- expected: focused suite passes.
- `cd back-end && npm run lint` -- expected: zero errors and warnings attributable to this change.
- `cd back-end && npm run build` -- expected: TypeScript/Nest build succeeds.
- `cd back-end && npm run test -- --runInBand` -- expected: backend unit regression suite passes.

## Auto Run Result

Status: done

Summary of implemented change:
- CacheService now tracks all Redis operations and drains them before Redis shutdown, preventing teardown from closing the client while cache work is pending.
- Review fixes cover late-tracked operations and every cache method in the lifecycle tests.

Files changed with one-line descriptions:
- `back-end/src/redis/cache.service.ts` -- tracks Redis promises and drains pending operations before teardown.
- `back-end/src/redis/cache.service.spec.ts` -- adds lifecycle coverage for pending, rejected, late-tracked, and idle shutdown paths.
- `work-log/2026-09-05-backend-cache-connection-regression.md` -- records the regression cause and verification.
- `_bmad-output/implementation-artifacts/spec-backend-cache-connection-regression.md` -- records the implementation and review result.

Review findings breakdown:
- Patches applied: 2 (2 medium)
- Items deferred: 0
- Items rejected: 0

Follow-up review recommendation: true
- Patched counts: 0 high, 2 medium, 0 low
- Score: 6 (`3 x medium count`)

Verification performed:
- Focused CacheService tests: 17 passed.
- Backend unit suite: 35 suites and 266 tests passed.
- Backend lint passed.
- Backend build passed.
- Matrix audit passed: pending `set`, `get`, `del`, `exists`, and `ping`, rejected operation, late-tracked operation, and idle wait-state shutdown were all covered by passing tests.
- E2E tests were not run because live PostgreSQL and Redis services were unavailable.

Residual risks:
- Real Redis/PostgreSQL integration behavior was not exercised locally; CI e2e remains the final confirmation for the original dashboard-key symptom.