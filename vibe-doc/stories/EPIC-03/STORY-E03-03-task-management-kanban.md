# Story: Task Management & Kanban Board

## Metadata
- **Story ID**: STORY-E03-03
- **Epic**: EPIC-03 — CRM & Sales Management
- **Priority**: High
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a sales staff member, I want to create and manage tasks — linked to leads or standalone — and view them on a Kanban board so that nothing falls through the cracks and I can see my team's workload at a glance.

## Context
Sales workflows involve many follow-up actions: call back this lead Tuesday, send a proposal by Friday. Tasks are the operational engine behind those actions. This story delivers standalone task CRUD + a Kanban view before workflow automation (E03-04) automates task creation.

## Requirements

### Functional Requirements
- [ ] Create tasks with: title, description, due date, priority (LOW/MEDIUM/HIGH/URGENT), assignee, linked entity (lead or customer), recurrence (none/daily/weekly/monthly)
- [ ] Task statuses: `TODO`, `IN_PROGRESS`, `DONE`, `CANCELLED`
- [ ] Kanban board view: tasks grouped by status with drag-to-move (status update mutation)
- [ ] Filter tasks by: assignee, priority, linked entity, due date range, status
- [ ] Overdue tasks (past due date, not DONE) are highlighted
- [ ] Recurring tasks auto-create the next occurrence when marked DONE

### Non-Functional Requirements
- [ ] Task list query uses standard pagination (E01-07)
- [ ] Tasks are tenant-scoped; assignee must be a tenant member
- [ ] `task:create`, `task:update`, `task:delete` permissions enforced (E02-02)

## Acceptance Criteria
- [ ] Staff creates a task "Call John" due tomorrow, linked to Lead #123, assigned to self
- [ ] Moving the task to "IN_PROGRESS" on the Kanban board updates its status immediately
- [ ] A weekly recurring task auto-creates the next occurrence 7 days later when marked DONE
- [ ] Overdue tasks appear with `isOverdue: true` in query results
- [ ] STAFF user cannot view tasks from another tenant

## Technical Specifications

### Architecture Impact
- **Prisma**: New `Task` model with polymorphic `entityType`/`entityId` for linked entity
- **Backend**: `TaskModule` (inside `CrmModule`)
- **Frontend**: Kanban board component with optimistic status update

### Prisma Schema
```prisma
model Task {
  id          String       @id @default(uuid())
  tenantId    String
  title       String
  description String?
  status      TaskStatus   @default(TODO)
  priority    TaskPriority @default(MEDIUM)
  dueDate     DateTime?
  assignedToId String?
  entityType  String?      // "Lead" | "Customer" | null
  entityId    String?
  recurrence  String?      // "NONE" | "DAILY" | "WEEKLY" | "MONTHLY"
  parentTaskId String?     // for recurring chain
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  tenant      Tenant       @relation(fields: [tenantId], references: [id])
  assignedTo  User?        @relation(fields: [assignedToId], references: [id])
  @@index([tenantId, status])
  @@index([tenantId, assignedToId, dueDate])
}

enum TaskStatus   { TODO IN_PROGRESS DONE CANCELLED }
enum TaskPriority { LOW MEDIUM HIGH URGENT }
```

### Kanban Query
```graphql
type KanbanBoard {
  todo:       [Task!]!
  inProgress: [Task!]!
  done:       [Task!]!
  cancelled:  [Task!]!
}

query taskKanban(filter: TaskFilter): KanbanBoard
```

### Recurrence Logic
- On `completeTask(id)`: if `recurrence != NONE`, create next `Task` with `dueDate += interval`, `parentTaskId = id`
- Runs synchronously in the mutation resolver (not a background job — simple enough)

## Implementation Plan

### Step 1: Prisma Model & CRUD API
- Create `Task` model
- Mutations: `createTask`, `updateTask`, `deleteTask`, `completeTask`
- Query: `tasks(filter, pagination, orderBy)`, `taskKanban(filter)`

### Step 2: Recurrence
- `completeTask` resolver: after marking DONE, check `recurrence` → create next task

### Step 3: Overdue Flag
- Computed field `isOverdue: Boolean` in GraphQL — not stored in DB
- Resolver: `task.dueDate < now() && task.status != DONE && task.status != CANCELLED`

### Step 4: Frontend Kanban
- Kanban board component: 4 columns (TODO, IN_PROGRESS, DONE, CANCELLED)
- Drag-and-drop → `updateTask(id, { status })` mutation with optimistic update
- Highlight overdue cards in red

## Testing Strategy

### Unit Tests
- [ ] `completeTask` on a weekly recurring task creates next task with `dueDate + 7 days`
- [ ] `isOverdue` computed correctly for past-due non-complete tasks

### Integration Tests
- [ ] Task created for lead in tenant A is not visible to tenant B
- [ ] Kanban board returns correct count per column
- [ ] STAFF user without `task:delete` cannot call `deleteTask`

## Dependencies

### Blocked By
- STORY-E02-01 (tenant scoping)
- STORY-E02-02 (RBAC: `task:*` permissions)
- STORY-E03-01 (Lead entity for task linking — can stub with `entityType: "Lead"` string)

### Blocks
- STORY-E03-04 (workflow automation creates tasks automatically)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Kanban query loads too many tasks | Medium | Limit each column to 50 tasks; pagination within column |
| Recurring task chain creates orphaned tasks | Low | `parentTaskId` allows tracing; cancelled parent stops chain |
