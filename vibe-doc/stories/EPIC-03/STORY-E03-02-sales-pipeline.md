# Story: Sales Pipeline — Stages, Transitions & SLA Tracking

## Metadata
- **Story ID**: STORY-E03-02
- **Epic**: EPIC-03 — CRM & Sales Management
- **Priority**: High
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a sales manager, I want to define pipeline stages and move leads through them so that I can visualize where each prospect is in our sales process and track how long leads sit in each stage.

## Context
Without a pipeline, leads are just a flat list with a status field. The pipeline gives a visual Kanban-style board view of all leads by stage, lets managers define their own stage sequence, and enforces SLA alerts when a lead sits too long in a stage.

## Requirements

### Functional Requirements
- [ ] Sales manager can create a named pipeline with ordered stages (e.g., New → Called → Demo Scheduled → Proposal → Won/Lost)
- [ ] Each stage has: name, order, color, optional SLA duration (hours)
- [ ] Each tenant can have multiple pipelines (e.g., one for inbound, one for outbound)
- [ ] A lead can be placed in a stage; moving a lead records a stage transition with timestamp
- [ ] SLA alert: if a lead has been in a stage longer than the SLA, it is flagged as `SLA_BREACHED`
- [ ] Pipeline board view: grouped list of leads by stage with count

### Non-Functional Requirements
- [ ] Stage transitions are stored for history (not overwritten)
- [ ] SLA breach check runs as a scheduled job every 15 minutes
- [ ] Pipelines and stages are tenant-scoped

## Acceptance Criteria
- [ ] Sales manager creates a pipeline "Inbound" with stages: New → Called → Demo → Won
- [ ] Moving lead X from "New" to "Called" records a `StageTransition` with timestamp
- [ ] A lead that has been in "New" for > SLA hours appears with `slaBreached: true` in the board query
- [ ] Deleting a stage that has active leads is rejected with a clear error

## Technical Specifications

### Architecture Impact
- **Prisma**: New `Pipeline`, `PipelineStage`, `StageTransition` models
- **Backend**: `PipelineModule` (inside `CrmModule`)
- **GraphQL**: Pipeline CRUD + board view query

### Prisma Schema
```prisma
model Pipeline {
  id       String          @id @default(uuid())
  tenantId String
  name     String
  stages   PipelineStage[]
  leads    Lead[]          // through pipelineStageId
  tenant   Tenant          @relation(fields: [tenantId], references: [id])
}

model PipelineStage {
  id           String            @id @default(uuid())
  pipelineId   String
  name         String
  order        Int
  color        String            @default("#6B7280")
  slaDurationH Int?              // SLA in hours; null = no SLA
  pipeline     Pipeline          @relation(fields: [pipelineId], references: [id])
  transitions  StageTransition[] @relation("ToStage")
  leads        Lead[]
}

model StageTransition {
  id           String        @id @default(uuid())
  leadId       String
  fromStageId  String?
  toStageId    String
  movedByUserId String
  movedAt      DateTime      @default(now())
  lead         Lead          @relation(fields: [leadId], references: [id])
  toStage      PipelineStage @relation("ToStage", fields: [toStageId], references: [id])
}
```

### Board Query
```graphql
type PipelineBoard {
  pipeline: Pipeline!
  columns: [BoardColumn!]!
}

type BoardColumn {
  stage: PipelineStage!
  leads: [Lead!]!
  totalCount: Int!
}

query pipelineBoard(pipelineId: ID!, filter: LeadsFilter): PipelineBoard
```

### SLA Breach Detection
- Scheduled job (every 15 min): for each tenant, find leads where `movedAt < now - slaDurationH` and `slaBreached = false` → set flag and emit `SLA_BREACHED` event (for notifications in STORY-E04-04)

## Implementation Plan

### Step 1: Prisma Models
- Create `Pipeline`, `PipelineStage`, `StageTransition` models
- Update `Lead` to reference `pipelineStageId`

### Step 2: Pipeline Management API
- Mutations: `createPipeline`, `updatePipeline`, `deletePipeline`
- Mutations: `createStage`, `updateStage`, `deleteStage` (reject if stage has leads)
- Mutation: `moveLeadToStage(leadId, stageId)` → creates `StageTransition`

### Step 3: Board View API
- `pipelineBoard(pipelineId, filter)` query → returns grouped leads per stage

### Step 4: SLA Job
- Bull queue job (every 15 min): scan for SLA breaches, emit events

## Testing Strategy

### Unit Tests
- [ ] `moveLeadToStage` creates `StageTransition` with correct `movedAt`
- [ ] SLA job correctly identifies breached leads

### Integration Tests
- [ ] Pipeline board returns correct lead counts per stage
- [ ] Deleting a stage with active leads returns error
- [ ] Stage transition history is preserved after multiple moves

## Dependencies

### Blocked By
- STORY-E03-01 (Lead entity — `pipelineStageId` on Lead)
- STORY-E02-02 (RBAC: `pipeline:manage` permission for sales manager)

### Blocks
- STORY-E03-04 (automation can trigger on stage transitions)
- STORY-E03-05 (analytics track stage conversion rates)
- STORY-E04-04 (SLA breach events trigger notifications)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Board query is slow with many leads | Medium | Paginate within each column; add composite index `(pipelineStageId, tenantId)` |
| SLA job misses tenants at scale | Low | Job is tenant-aware; use Bull's repeat job with proper error logging |
