# PR Validation Setup

This document describes the GitHub Actions workflow set up for Pull Request validation.

## Workflow: `.github/workflows/pr-validation.yml`

### Trigger
The workflow runs automatically when:
- A new PR is opened against the `master` branch
- New commits are pushed to an existing PR (synchronize)
- A PR is reopened

### Jobs Overview

#### Required Jobs (must pass for PR to be mergeable):

1. **Backend Lint** (`backend-lint`)
   - Runs ESLint on backend code
   - **No warnings allowed** (uses `--max-warnings 0`)
   - Must pass for PR to be mergeable

2. **Frontend Lint** (`frontend-lint`)
   - Runs ESLint on frontend code
   - **No warnings allowed** (uses `--max-warnings 0`)
   - Must pass for PR to be mergeable

3. **Backend Unit Tests** (`backend-unit-tests`)
   - Runs all Jest unit tests in backend
   - **All tests must pass**
   - Must pass for PR to be mergeable

4. **Frontend Unit Tests** (`frontend-unit-tests`)
   - Runs all Vitest unit tests in frontend
   - **All tests must pass**
   - Must pass for PR to be mergeable

5. **Backend Coverage** (`backend-coverage`)
   - Runs Jest tests with coverage
   - **Coverage must be ≥70%**
   - Must pass for PR to be mergeable

6. **Frontend Coverage** (`frontend-coverage`)
   - Runs Vitest tests with coverage
   - **Coverage must be ≥70%**
   - Must pass for PR to be mergeable

#### Optional Jobs (will not block PR):

7. **Backend Regression Tests** (`backend-regression-tests`)
   - Runs E2E tests using `npm run test:e2e`
   - Uses `continue-on-error: true`
   - **Will NOT block PR merging** if tests fail
   - Results are for informational purposes only

### Dependencies Added

**Frontend:**
- Added `@vitest/coverage-v8` for coverage reporting
- Updated `vite.config.ts` to configure coverage settings

### Commands Used

**Backend:**
- Lint: `npm run lint -- --max-warnings 0`
- Unit Tests: `npm run test`
- Coverage: `npm run test:cov`
- E2E Tests: `npm run test:e2e`

**Frontend:**
- Lint: `npm run lint -- --max-warnings 0`
- Unit Tests: `npm run test:run`
- Coverage: `npx vitest run --coverage`

### Branch Protection

To enforce these requirements, configure branch protection rules for the `master` branch in GitHub:
1. Go to Settings → Branches
2. Add rule for `master`
3. Enable "Require status checks to pass before merging"
4. Select these required status checks:
   - Backend Lint
   - Frontend Lint
   - Backend Unit Tests
   - Frontend Unit Tests
   - Backend Coverage Check
   - Frontend Coverage Check
   - PR Validation Complete

### Next Steps

1. Install the new frontend dependency: `cd front-end && npm install`
2. Configure branch protection rules (see above)
3. Test the workflow by creating a test PR