# Story: Audit Logging

## Metadata
- **Story ID**: STORY-E02-06
- **Epic**: EPIC-02 — Multi-Tenant Admin & RBAC
- **Priority**: Medium
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a tenant admin, I want a searchable audit log of all user actions, data changes, and login events so that I can investigate incidents, track changes, and satisfy compliance requirements.

## Context
Audit trails become critical when multiple staff members edit shared records (leads, courses, student data). Without an audit log, there is no way to answer "who changed this?". This story adds an automatic, tamper-evident log that records every create/update/delete with the actor, timestamp, and a diff of what changed.

## Requirements

### Functional Requirements
- [ ] Every create, update, delete mutation automatically writes an `AuditLog` entry
- [ ] Each entry records: `tenantId`, `actorId`, `actorEmail`, `action` (CREATE/UPDATE/DELETE), `resource`, `resourceId`, `diff` (JSON before/after for updates), `timestamp`, `ipAddress`
- [ ] Login events (success and failure) are also logged
- [ ] Admin can query audit logs with filters: `actorId`, `resource`, `action`, date range
- [ ] Audit log entries are immutable — no update or delete mutations exposed

### Non-Functional Requirements
- [ ] Audit logging must not increase mutation response time by > 10ms — write to queue, persist asynchronously
- [ ] Audit logs are retained for 90 days by default; older records are archived (not deleted)
- [ ] `diff` field is stored as sanitized JSON — no passwords, tokens, or PII beyond email

## Acceptance Criteria
- [ ] Updating a lead's status creates an audit log entry with `{ before: { status: "NEW" }, after: { status: "CONTACTED" } }`
- [ ] Admin can filter logs by `actorId` and see all actions that user performed in the last 30 days
- [ ] A failed login attempt appears in audit logs with `action: LOGIN_FAILED`
- [ ] Attempting to mutate an audit log entry returns `FORBIDDEN`

## Technical Specifications

### Architecture Impact
- **Prisma**: New `AuditLog` model (append-only)
- **Backend**: `AuditModule`; `@Auditable()` decorator; async write via Bull queue
- **GraphQL**: `auditLogs(filter, pagination)` query (admin-only)

### Prisma Schema
```prisma
model AuditLog {
  id         String   @id @default(uuid())
  tenantId   String
  actorId    String?
  actorEmail String?
  action     AuditAction
  resource   String    // e.g. "Lead", "Course", "User"
  resourceId String
  diff       Json?     // { before: {}, after: {} }
  ipAddress  String?
  createdAt  DateTime  @default(now())
  tenant     Tenant    @relation(fields: [tenantId], references: [id])
  @@index([tenantId, resource, createdAt])
  @@index([tenantId, actorId, createdAt])
}

enum AuditAction {
  CREATE UPDATE DELETE
  LOGIN_SUCCESS LOGIN_FAILED
  PERMISSION_GRANTED PERMISSION_REVOKED
}
```

### Auditable Decorator
```typescript
@Auditable('Lead')   // applied to resolver method
// → interceptor captures input, calls service, captures output
// → emits { action, resource, resourceId, diff } to Bull queue
// → Bull worker writes AuditLog row asynchronously
```

## Implementation Plan

### Step 1: Prisma Model & Module
- Create `AuditLog` model with indexes
- Create `AuditModule` with `AuditService.log(entry)` that enqueues to Bull

### Step 2: Async Write Worker
- Bull queue `audit-log`; worker writes to DB; handles retries on DB failure
- Keeps mutation response time unaffected

### Step 3: Decorator & Interceptor
- `@Auditable(resource)` sets metadata
- `AuditInterceptor` wraps resolver calls, extracts before/after diff, enqueues log entry
- Login events logged directly in `AuthService`

### Step 4: Admin Query API
- `auditLogs(filter: AuditLogFilter, pagination: PaginationArgs)` query
- Filter: `actorId?`, `resource?`, `action?`, `from?`, `to?`
- Uses standard pagination from STORY-E01-07

## Testing Strategy

### Unit Tests
- [ ] `AuditInterceptor` captures correct diff for an update mutation
- [ ] Login failure in `AuthService` emits correct audit event

### Integration Tests
- [ ] Updating a user profile creates an `AuditLog` row with correct `diff`
- [ ] Audit log query with date filter returns only entries in range
- [ ] Mutation against `AuditLog` returns `FORBIDDEN`

## Dependencies

### Blocked By
- STORY-E02-01 (tenant context for `tenantId` field)
- STORY-E02-02 (admin-only permission guard)
- STORY-E01-07 (pagination for audit log query)

### Blocks
- Nothing directly — other modules add `@Auditable()` to their mutations as they are built

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bull queue drops events if Redis restarts | Low | Enable Bull `removeOnComplete: false`; add dead-letter queue |
| Diff contains sensitive data | Medium | Diff sanitizer strips known sensitive field names before enqueue |
| High-volume tenants generate too many log rows | Medium | Partition by month; archive after 90 days via scheduled job |
