# 2026-05-26 - Merge Conflict Resolution (RBAC)

## Summary
Resolved active merge conflict in RBAC permission cache invalidation logic.

## Files Updated
- `back-end/src/rbac/permission.service.ts`

## What Was Resolved
- Removed conflict markers in `invalidateRolePermissions`.
- Kept membership-based invalidation via `UserTenantRole` users.
- Kept legacy fallback invalidation for users with legacy `User.role` mapping.
- Normalized `roleName` handling to typed `RoleName` in service method.
- Removed duplicated `ROLE_NAME_TO_USER_ROLE` constant declaration.

## Verification
- Confirmed no remaining unmerged files with `git diff --name-only --diff-filter=U`.
- Ran RBAC unit tests:
  - `src/rbac/permission.service.spec.ts`
  - `src/rbac/permission.guard.spec.ts`
- Result: all passing.

## Current Git State
- All conflicts fixed.
- Merge is in progress and ready for final merge commit.
