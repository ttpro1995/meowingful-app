# Front-end Build Fix - Profile Test Typing

Date: 2026-05-26

## Summary
- Fixed front-end production build failure caused by TypeScript typing issues in `src/pages/Profile.spec.tsx`.

## Changes Made
- Added Apollo mock type import:
  - `import type { MockedResponse } from '@apollo/client/testing';`
- Replaced loose test helper signature:
  - From: `renderProfile(mocks: unknown[])`
  - To: `renderProfile(mocks: ReadonlyArray<MockedResponse>)`
- Made profile test user shape explicit with nullable bio:
  - Added `ProfileUser` type with `bio: string | null`
  - Typed `baseUser` as `ProfileUser`

## Why
- `MockedProvider` expects `ReadonlyArray<MockedResponse>` and rejected `unknown[]` during `tsc -b`.
- Test case `makeGetUserMock({ bio: null })` required a nullable `bio` type.

## Validation
- Ran `npm run build` in `front-end/`.
- Result: successful build (`tsc -b && vite build` passed).
