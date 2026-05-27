# Frontend Lint Fix - Profile Tenant Selection

**Date:** 2026-05-26
**Scope:** `front-end/src/pages/Profile.tsx`

## Problem
Frontend lint failed with `react-hooks/set-state-in-effect` due to calling `setSelectedTenantId` synchronously inside a `useEffect`.

## Changes Made
- Removed tenant-selection synchronization `useEffect` that called `setState`.
- Replaced it with derived selection logic using `useMemo`:
  - Introduced `tenantSelectionOverride` state for explicit user dropdown choice.
  - Computed `selectedTenantId` from:
    1. `tenantSelectionOverride` (if still valid in memberships),
    2. `authUser.tenantId`,
    3. first membership tenant id,
    4. fallback empty string.
- Updated tenant dropdown `onChange` to set `tenantSelectionOverride`.

## Validation
- Ran: `cd front-end && npm run lint`
- Result: pass (no lint errors)
