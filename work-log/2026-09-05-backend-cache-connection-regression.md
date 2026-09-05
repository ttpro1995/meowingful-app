# 2026-09-05 Backend cache connection regression fix

## Problem
Nest teardown could disconnect the lazy Redis client while CacheService commands were still pending, causing cache operations to fail with `Connection is closed`.

## Root cause
CacheService shut down Redis without tracking in-flight cache promises.

## Changes made
- Track `set`, `get`, `del`, `exists`, and `ping` promises until settlement.
- Await all tracked operations before applying the existing Redis shutdown behavior.
- Add focused tests for pending, rejected, late-tracked, and idle operations during teardown.

## Validation
- Focused CacheService tests: 17 passed.
- Backend unit suite: 35 suites and 266 tests passed.
- Backend lint passed.
- Backend build passed.
- Editor diagnostics and `git diff --check` passed for the changed source and test files.
