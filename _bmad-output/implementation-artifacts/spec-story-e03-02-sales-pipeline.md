---
title: 'Sales Pipeline — Stages, Transitions & SLA Tracking'
type: 'feature'
created: '2026-09-13'
status: 'done'
baseline_commit: '7d0c3101bd711d9563acf7400a8fb4908d3f9379'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '/home/tt-pc/workplace/hobby-project/meowingful-app.worktrees/featurestory-e03-02-implementation/_bmad-output/implementation-artifacts/epic-3-context.md'
  - '/home/tt-pc/workplace/hobby-project/meowingful-app.worktrees/featurestory-e03-02-implementation/vibe-doc/stories/EPIC-03/STORY-E03-02-sales-pipeline.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Leads have a `pipelineStageId` placeholder but no configurable pipeline, stage transition history, Kanban board query, or SLA breach tracking.

**Approach:** Add tenant-scoped Prisma pipeline entities and expose protected GraphQL management, lead movement, board, and SLA-check operations using the existing CRM, RBAC, audit, Prisma, and BullMQ patterns.

## Boundaries & Constraints

**Always:** preserve tenant isolation; require `pipeline:manage` for pipeline/stage mutations and `lead:update` for stage movement; preserve every transition; reject deleting stages with active leads; keep generated Prisma migration/schema artifacts tool-generated.

**Block If:** the existing Lead relation shape or queue/bootstrap pattern cannot support the required behavior without changing an unrelated contract; a required permission or event contract is ambiguous.

**Never:** cross-tenant lookups or writes; overwrite transition history; silently ignore queue or persistence errors; implement SLA detection only as an untestable in-memory shortcut.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Create pipeline | Authenticated manager, ordered stages | Tenant-scoped pipeline and stages are created | Validation/permission error |
| Move lead | Lead and destination stage in caller tenant | Lead stage changes and immutable transition records timestamp/user | Clear error for missing or cross-tenant records |
| Board query | Pipeline with staged and unstaged leads | Columns contain stage leads, counts, and `slaBreached` state | Permission/tenant error |
| SLA check | Stage SLA elapsed and not already breached | Lead is flagged once and `SLA_BREACHED` event is emitted | Surface persistence/queue failures |
| Delete stage | Stage has active leads | Mutation is rejected and leads remain unchanged | Clear conflict error |

</intent-contract>

## Code Map

- `back-end/prisma/schema.prisma` — add Pipeline, PipelineStage, StageTransition and Lead relations/flags/indexes; keep all models tenant-scoped.
- `back-end/src/crm/crm.types.ts` — existing GraphQL lead types and validation conventions; add pipeline, board, input, and transition types.
- `back-end/src/crm/crm.service.ts` — existing tenant context and Prisma service patterns; extend with transactional pipeline/stage/move/board/SLA logic.
- `back-end/src/crm/crm.resolver.ts` — existing permission, audit, and resolver wiring; add protected pipeline operations.
- `back-end/src/crm/crm.module.ts` and `back-end/src/app.module.ts` — existing CRM module registration and global guards; wire any new queue provider/worker without duplicate module registration.
- `back-end/src/audit/audit.service.ts` and `back-end/src/audit/audit.module.ts` — BullMQ connection, worker lifecycle, and error propagation patterns to reuse for SLA events.
- `back-end/src/crm/*.spec.ts` — current unit/resolver test seams and mocks; extend with matrix coverage.
- `back-end/prisma/seed-rbac.ts` — add pipeline permission codes to the existing role matrix where appropriate.
- `vibe-doc/stories/EPIC-03/STORY-E03-02-sales-pipeline.md` — mark implementation status and append a concise validation note for ticket handoff.
- `world-log/2026-09-13-story-e03-02-sales-pipeline.md` — record changed surfaces, verification, and remaining follow-up work.

## Tasks & Acceptance

**Execution:**
- [x] `back-end/prisma/schema.prisma` — add pipeline/stage/transition models, Lead current-stage/SLA fields, relations, indexes, and migration via Prisma tooling.
- [x] `back-end/src/crm/crm.types.ts`, `crm.service.ts`, `crm.resolver.ts` — implement validated tenant-scoped CRUD, stage moves with history, board grouping/counts, and SLA state.
- [x] `back-end/src/crm/crm.module.ts` plus queue/bootstrap files — schedule the SLA check every 15 minutes and emit a durable `SLA_BREACHED` event using existing BullMQ conventions.
- [x] `back-end/src/crm/*.spec.ts` — test stage creation, transition history/timestamp, board counts/SLA flag, cross-tenant rejection, and active-stage deletion rejection.
- [x] `back-end/prisma/seed-rbac.ts` — seed pipeline permissions and manager role access consistently with existing lead permissions.
- [x] `vibe-doc/stories/EPIC-03/STORY-E03-02-sales-pipeline.md`, `world-log/2026-09-13-story-e03-02-sales-pipeline.md` — mark the ticket with completed work, validation, and explicit leftovers.

**Acceptance Criteria:**
- Given a sales manager, when creating “Inbound” with New, Called, Demo, and Won, then the pipeline and ordered tenant-scoped stages are returned.
- Given a lead in New, when moved to Called, then the lead points to Called and a timestamped StageTransition preserves the move.
- Given a lead beyond its stage SLA, when the scheduled checker runs, then the board returns `slaBreached: true` and one `SLA_BREACHED` event is emitted.
- Given a stage with active leads, when deletion is requested, then a clear conflict is returned and the stage and leads remain intact.
- Given tenant A data, when tenant B invokes any pipeline or board operation, then no tenant A data is returned or changed.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `cd back-end && npx prisma generate` — expected: Prisma client generation succeeds.
- `cd back-end && npx jest --testPathPatterns=crm` — expected: all CRM and pipeline specs pass.
- `cd back-end && npm run build` — expected: NestJS TypeScript build succeeds.
- `cd back-end && npm run lint` — expected: zero lint errors.

## Suggested Review Order

**Pipeline persistence and domain logic**

- Lead/stage state and tenant-scoped models establish the pipeline invariants.
  [`schema.prisma:213`](../../back-end/prisma/schema.prisma#L213)

- Service methods enforce tenant boundaries, immutable transitions, board grouping, and SLA event emission.
  [`crm.service.ts:478`](../../back-end/src/crm/crm.service.ts#L478)

**GraphQL and scheduling**

- Protected mutations and board query expose the management contract.
  [`crm.resolver.ts:181`](../../back-end/src/crm/crm.resolver.ts#L181)

- The scheduler runs SLA checks every fifteen minutes while queue jobs remain durable.
  [`crm.queue.ts:24`](../../back-end/src/crm/crm.queue.ts#L24)

**Supporting contracts**

- GraphQL inputs and outputs define validation and board payload shapes.
  [`crm.types.ts:232`](../../back-end/src/crm/crm.types.ts#L232)

- RBAC seed grants pipeline management to the intended manager roles.
  [`seed-rbac.ts:15`](../../back-end/prisma/seed-rbac.ts#L15)
