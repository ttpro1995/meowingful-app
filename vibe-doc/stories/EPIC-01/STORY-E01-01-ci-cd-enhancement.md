# Story: CI/CD Pipeline Enhancement

## Metadata
- **Story ID**: STORY-E01-01
- **Epic**: EPIC-01 — Foundation & Infrastructure Enhancement
- **Priority**: High
- **Status**: Todo
- **Created**: 2026-05-09
- **Related**: vibe-doc/epic-plan.md, .github/workflows/pr-validation.yml

## User Story
As a developer, I want a full CI/CD pipeline that automatically builds, tests, and deploys the application so that releases are reliable and require no manual steps.

## Context
PR validation already covers lint, unit tests, and coverage. What is missing:
- No CD (deployment) pipeline — releases are manual
- Backend E2E runs with `continue-on-error: true` (non-blocking)
- No frontend E2E tests in CI
- No build verification step (the Docker image is never built in CI)
- No staging environment deployment

## Requirements

### Functional Requirements
- [ ] CI builds Docker images for backend and frontend on every PR merge to master
- [ ] Backend integration tests run against a real PostgreSQL container in CI (not mocked)
- [ ] Frontend E2E tests (Playwright) run in CI against a built frontend + running backend
- [ ] CD pipeline deploys to staging automatically after merge to master
- [ ] CD pipeline deploys to production manually (workflow_dispatch or tag-triggered)
- [ ] Backend E2E job is required (not `continue-on-error`) once a stable test DB is wired in

### Non-Functional Requirements
- [ ] Total CI time stays under 10 minutes for the PR validation pipeline
- [ ] Failed deployment automatically notifies the team (GitHub Actions summary + optional Slack)
- [ ] All secrets managed via GitHub Actions secrets — no credentials in code

## Acceptance Criteria
- [ ] Merging to master triggers a Docker build; a broken Dockerfile fails the pipeline
- [ ] Integration tests exercise real DB queries (Prisma migrations applied against postgres service container)
- [ ] Playwright E2E tests cover login and profile update happy path
- [ ] Staging environment reflects master within 5 minutes of merge
- [ ] Production deployment requires explicit manual trigger

## Technical Specifications

### Architecture Impact
- New GitHub Actions workflow: `deploy-staging.yml` (auto on merge to master)
- New GitHub Actions workflow: `deploy-production.yml` (manual trigger / tag)
- New GitHub Actions workflow: `e2e-frontend.yml` (Playwright, runs on PR)
- Update `pr-validation.yml`: add Docker build job, promote backend E2E to required

### New Workflow: deploy-staging.yml
```yaml
on:
  push:
    branches: [master]

jobs:
  build-and-push:       # Build and push Docker images to registry
  run-migrations:       # Apply Prisma migrations on staging DB
  deploy:               # Docker Compose pull + up on staging server
  smoke-test:           # Health check endpoint returns 200
```

### Backend Integration Test Setup
```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_DB: test_db
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    options: >-
      --health-cmd pg_isready --health-interval 5s
```

## Implementation Plan

### Step 1: Docker Build Job
- Add `docker-build` job to `pr-validation.yml` that runs `docker build` for both images
- Fail the PR if either Dockerfile has errors

### Step 2: Backend Integration Tests in CI
- Add a `postgres` service container to the backend test job
- Run `npx prisma migrate deploy` before tests
- Move backend E2E from `continue-on-error: true` to required

### Step 3: Frontend E2E with Playwright
- Add Playwright to the frontend project
- Write E2E tests: register, login, update profile (golden paths)
- Add `e2e-frontend.yml` workflow that spins up the full stack and runs Playwright

### Step 4: Staging CD Workflow
- Create `deploy-staging.yml` triggered on push to master
- Use SSH action to pull and restart Docker Compose on staging server
- Add a smoke test job (curl health endpoint)

### Step 5: Production CD Workflow
- Create `deploy-production.yml` triggered by `workflow_dispatch` or `v*` tag
- Same steps as staging but targeting production server

## Testing Strategy

### Validation
- Break a Dockerfile deliberately and confirm CI fails
- Break an integration test and confirm PR is blocked
- Merge to master and confirm staging deployment completes

## Dependencies

### Prerequisites
- Staging server provisioned with Docker + Docker Compose
- GitHub Actions secrets: `STAGING_SSH_KEY`, `STAGING_HOST`, `DOCKER_REGISTRY_TOKEN`
- Playwright added to front-end package.json

### Blocked By
- Nothing — can start immediately

### Blocks
- STORY-E01-08 (staging environment is the deployment target)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| E2E tests are flaky | Medium | Use Playwright retries; fix before marking required |
| Staging server unavailable | Low | Smoke test alerts; keep staging simple |

## Notes
- Keep PR validation pipeline fast: Docker build can be a separate non-blocking job initially, promoted to required once stable.
- Use layer caching (`cache-from`) for Docker builds to keep build times reasonable.
