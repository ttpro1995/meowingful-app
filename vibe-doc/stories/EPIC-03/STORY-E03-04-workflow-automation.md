# Story: Workflow Automation — Trigger-Based Actions & Auto-Assignment

## Metadata
- **Story ID**: STORY-E03-04
- **Epic**: EPIC-03 — CRM & Sales Management
- **Priority**: Medium
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a sales manager, I want to define automation rules that fire when specific events occur (lead created, stage changed, SLA breached) so that routine tasks like assigning new leads and sending follow-up reminders happen automatically without manual intervention.

## Context
The manual workflow is: lead comes in → manager assigns it → staff follows up. Automation rules remove the manager from that chain. This story adds a simple rule engine (trigger → condition → actions) on top of the event infrastructure. It intentionally avoids a full visual workflow builder (that would be overengineering at this stage); a structured form is sufficient.

## Requirements

### Functional Requirements
- [ ] Sales manager can create automation rules with: trigger event, optional conditions, one or more actions
- [ ] Trigger events: `LEAD_CREATED`, `LEAD_STAGE_CHANGED`, `SLA_BREACHED`, `TASK_OVERDUE`
- [ ] Conditions (optional): `lead.source == "website"`, `lead.score >= 4`
- [ ] Actions: `ASSIGN_LEAD` (to a user or round-robin from a group), `CREATE_TASK` (with title template), `SEND_NOTIFICATION` (email/in-app via E04-01), `UPDATE_LEAD_FIELD`
- [ ] Automation rules are tenant-scoped and togglable (enabled/disabled)
- [ ] Execution log: each rule run is logged with result (success/failure) and timestamp

### Non-Functional Requirements
- [ ] Rule execution is asynchronous — does not slow down the triggering mutation
- [ ] If a rule action fails, it is retried up to 3 times before marking as failed
- [ ] Maximum 50 active rules per tenant (prevent performance abuse)

## Acceptance Criteria
- [ ] Rule: "When LEAD_CREATED AND source == 'website' → ASSIGN_LEAD to next in round-robin from group Sales" — fires correctly on new website lead
- [ ] Rule: "When SLA_BREACHED → CREATE_TASK 'Follow up on {{lead.name}}'" — creates task on SLA breach
- [ ] Disabling a rule prevents it from executing even when the trigger fires
- [ ] Execution log shows success/failure for each rule run
- [ ] Creating a 51st rule returns a clear validation error

## Technical Specifications

### Architecture Impact
- **Prisma**: New `AutomationRule`, `AutomationAction`, `AutomationLog` models
- **Backend**: `AutomationModule`; event listeners on domain events; Bull queue for async execution
- **GraphQL**: Rule CRUD + execution log query

### Prisma Schema
```prisma
model AutomationRule {
  id         String            @id @default(uuid())
  tenantId   String
  name       String
  trigger    AutomationTrigger
  conditions Json?             // [{ field, operator, value }]
  actions    AutomationAction[]
  isEnabled  Boolean           @default(true)
  logs       AutomationLog[]
  tenant     Tenant            @relation(fields: [tenantId], references: [id])
}

model AutomationAction {
  id       String           @id @default(uuid())
  ruleId   String
  type     ActionType
  config   Json             // varies by action type
  order    Int
  rule     AutomationRule   @relation(fields: [ruleId], references: [id])
}

model AutomationLog {
  id        String         @id @default(uuid())
  ruleId    String
  entityId  String         // lead/task ID that triggered it
  status    String         // SUCCESS | FAILED | SKIPPED
  error     String?
  executedAt DateTime      @default(now())
  rule      AutomationRule @relation(fields: [ruleId], references: [id])
}

enum AutomationTrigger { LEAD_CREATED LEAD_STAGE_CHANGED SLA_BREACHED TASK_OVERDUE }
enum ActionType { ASSIGN_LEAD CREATE_TASK SEND_NOTIFICATION UPDATE_LEAD_FIELD }
```

### Event-Driven Execution
```typescript
// AutomationEngine listens to domain events
@OnEvent('lead.created')
async onLeadCreated(event: LeadCreatedEvent) {
  const rules = await this.getRulesForTrigger('LEAD_CREATED', event.tenantId);
  for (const rule of rules) {
    if (this.evaluateConditions(rule.conditions, event.lead)) {
      await this.automationQueue.add('execute', { ruleId: rule.id, payload: event });
    }
  }
}
```

## Implementation Plan

### Step 1: Prisma Models
- Create `AutomationRule`, `AutomationAction`, `AutomationLog`

### Step 2: Rule CRUD API
- Mutations: `createAutomationRule`, `updateAutomationRule`, `deleteAutomationRule`, `toggleRule`
- Query: `automationRules(pagination)`, `automationLogs(ruleId, pagination)`

### Step 3: Automation Engine
- `AutomationEngine` service: subscribes to domain events using NestJS `EventEmitter2`
- Condition evaluator: simple expression evaluator for `field operator value` conditions
- Bull queue worker: executes action list for a rule; writes `AutomationLog`

### Step 4: Action Implementations
- `ASSIGN_LEAD`: round-robin or direct assignment (uses `LeadService.assign`)
- `CREATE_TASK`: uses `TaskService.create` with template interpolation (e.g., `{{lead.name}}`)
- `SEND_NOTIFICATION`: calls `NotificationService` from STORY-E04-01
- `UPDATE_LEAD_FIELD`: direct field update via `LeadService.update`

## Testing Strategy

### Unit Tests
- [ ] Condition evaluator correctly evaluates `source == "website"` for matching/non-matching leads
- [ ] Round-robin assignment cycles through assignees correctly

### Integration Tests
- [ ] Creating a lead with `source: "website"` fires matching rule and assigns lead
- [ ] Disabled rule does not fire when trigger occurs
- [ ] Failed action retries 3 times before logging as FAILED

## Dependencies

### Blocked By
- STORY-E03-01 (Lead entity and domain events)
- STORY-E03-02 (LEAD_STAGE_CHANGED and SLA_BREACHED events)
- STORY-E03-03 (CREATE_TASK action needs TaskService)
- STORY-E04-01 (SEND_NOTIFICATION action needs NotificationService — can be stubbed initially)

### Blocks
- Nothing — end of chain for CRM automation

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Infinite rule loops (rule action triggers another rule) | High | Mark event as automation-originated; automation engine skips re-triggering |
| Complex condition expressions | Medium | Keep conditions to simple field comparisons; no nested logic in v1 |
| Rule fires too slowly | Low | Bull queue with concurrency 5 per tenant; monitor queue lag |
