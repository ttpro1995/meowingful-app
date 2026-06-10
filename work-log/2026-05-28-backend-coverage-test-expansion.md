# 2026-05-28: Backend Coverage Test Expansion

## Summary
- Added multiple backend unit test suites to increase overall backend test coverage.
- Focused on low-coverage modules and high-impact service branches.

## Test Files Added
- `back-end/src/file-storage/file-storage.service.spec.ts`
- `back-end/src/metrics/metrics.interceptor.spec.ts`
- `back-end/src/tenant/tenant-logo-auth.guard.spec.ts`
- `back-end/src/tenant/tenant.context.spec.ts`
- `back-end/src/tenant/tenant.resolver.spec.ts`
- `back-end/src/tenant/tenant-config.resolver.spec.ts`
- `back-end/src/membership/membership.resolver.spec.ts`
- `back-end/src/tenant/tenant-logo.controller.spec.ts`
- `back-end/src/main.spec.ts`
- `back-end/src/tenant/tenant-context.interceptor.spec.ts`

## Test Files Updated
- `back-end/src/membership/membership.service.spec.ts`
  - Added cases for:
    - invalid tenant role during invite
    - decline invitation success flow
    - update member roles success flow
    - update member roles invalid role mismatch
    - myTenants role aggregation with duplicate rows

## Validation
- New and updated tests pass locally.
- Lint for new/updated spec files passes with `--max-warnings 0`.
- Coverage command with CI-compatible reporters passes locally.

## Coverage Result
- Backend line coverage reached **70.17%** (`1487/2119`).
- This satisfies the backend coverage threshold check (`>= 70%`).
