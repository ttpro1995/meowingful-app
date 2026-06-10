# Backend Lint Fix - Tenant Spec Mocks

**Date:** 2026-05-28
**Scope:** `back-end/src/tenant/feature.guard.spec.ts`, `back-end/src/tenant/tenant-config.service.spec.ts`

## Problem
Backend lint failed with:
- `@typescript-eslint/no-unsafe-function-type`
- `@typescript-eslint/unbound-method`

The errors were triggered by using `Function` as a handler type in tests and by asserting against class-cast mock methods directly.

## Changes Made
- Replaced `handler: Function` with `handler: () => unknown` in `FeatureGuard` unit tests.
- Refactored Jest mocks in both tenant spec files to use standalone function references (for example `const cacheDel = jest.fn()`), then asserted against those references.
- Kept test behavior unchanged while aligning with strict TypeScript ESLint rules.

## Validation
- Ran: `cd back-end && npm run lint`
- Result: pass (no lint errors)
- Ran: `cd back-end && npm test -- src/tenant/feature.guard.spec.ts src/tenant/tenant-config.service.spec.ts`
- Result: pass (2/2 suites, 10/10 tests)
