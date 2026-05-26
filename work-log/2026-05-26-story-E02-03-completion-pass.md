# Work Log - 2026-05-26 - STORY-E02-03 Completion Pass

## Objective
Close the remaining STORY-E02-03 scope by finishing integration coverage and shipping frontend tenant switch/invitation UX.

## Completed

### 1) Backend revocation and membership correctness hardening
- Updated `back-end/src/auth/auth.service.ts`:
  - Removed automatic membership re-bootstrap in login/refresh paths.
  - Enforced explicit tenant membership checks for session issuance and login.
  - Updated `switchTenant` user lookup to work with membership-based context.
- Updated `back-end/src/tenant/tenant.guard.ts`:
  - Added mandatory membership validation for token tenant on all protected GraphQL operations.
  - Prevents removed members from continuing with stale tenant tokens.
- Updated `back-end/src/prisma/prisma.service.ts`:
  - Adjusted user model tenant scoping to be membership-aware for non-public operations.
  - Preserved safe `findUnique` handling for valid Prisma unique where constraints.

### 2) Membership and RBAC backend improvements
- Updated `back-end/src/membership/membership.service.ts`:
  - `updateMemberRoles` now validates tenant membership from `UserTenantRole` directly.
- Updated `back-end/src/rbac/rbac.resolver.ts`:
  - Added `myPermissions` query for current active tenant context.

### 3) Integration test coverage added for remaining acceptance criteria
- Added new e2e suite:
  - `back-end/test/membership.e2e-spec.ts`
- Covered flow end-to-end:
  - invite → accept invitation
  - multi-tenant listing (`myTenants`)
  - tenant switch and JWT tenant claim verification
  - role reassignment to `SALES_MANAGER` and immediate permission effect
  - member removal and next-request `UNAUTHORIZED`
- Updated existing e2e fixtures for stricter membership enforcement:
  - `back-end/test/rbac.e2e-spec.ts`
  - `back-end/test/tenant.e2e-spec.ts`

### 4) Frontend completion for story UX
- Added invitation response page:
  - `front-end/src/pages/InviteResponse.tsx`
  - route: `/invite?token=...`
  - supports authenticated accept/decline and unauthenticated login redirect.
- Added invitation page tests:
  - `front-end/src/pages/InviteResponse.spec.tsx`
- Added tenant switcher in profile:
  - `front-end/src/pages/Profile.tsx`
  - wired to `myTenants` query and `switchTenant` mutation.
- Updated auth payload/query typing and operations:
  - `front-end/src/graphql/queries.ts`
  - includes new operations: `MY_TENANTS`, `SWITCH_TENANT`, `ACCEPT_INVITATION`, `DECLINE_INVITATION`.
- Added/updated frontend tests:
  - `front-end/src/pages/Profile.spec.tsx` (includes tenant switch scenario)
  - `front-end/src/pages/Login.spec.tsx`
  - `front-end/src/pages/Register.spec.tsx`
- Updated routing and styling support:
  - `front-end/src/App.tsx`
  - `front-end/src/App.css`

## Validation

### Backend
- `npm run test -- --runInBand src/tenant/tenant.guard.spec.ts src/auth/auth.service.spec.ts src/membership/membership.service.spec.ts` ✅
- `npm run test:e2e -- --runInBand test/membership.e2e-spec.ts` ✅
- `npm run test:e2e -- --runInBand test/rbac.e2e-spec.ts test/tenant.e2e-spec.ts` ✅
- `npm run build` ✅

### Frontend
- `npm run test:run -- src/pages/Profile.spec.tsx src/pages/InviteResponse.spec.tsx src/pages/Login.spec.tsx src/pages/Register.spec.tsx src/context/AuthContext.spec.tsx src/context/AuthContext.test.tsx` ✅
- `npm run build` ✅

## Story Documentation Updates
- Updated story checklist/progress and status:
  - `vibe-doc/stories/EPIC-02/STORY-E02-03-user-tenant-membership.md`
  - marked remaining acceptance/integration items complete and added completion-pass details.
