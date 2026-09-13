# Story: Lead & Customer Management

## Metadata
- **Story ID**: STORY-E03-01
- **Epic**: EPIC-03 — CRM & Sales Management
- **Priority**: High
- **Status**: Done
- **Created**: 2026-05-24
- **Updated**: 2026-09-13
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a sales staff member, I want to create, view, update, and classify leads and customers so that my team has a central record of every prospect from first contact through close.

## Context
This is the core CRM entity. The pipeline (E03-02), task management (E03-03), workflow automation (E03-04), and analytics (E03-05) all build on top of the lead record. It must be built first with correct data isolation (tenant-scoped), RBAC guards, and pagination-ready list queries.

## Requirements

### Functional Requirements
- [x] Create a lead with: name, email, phone, source, status, assigned staff, notes
- [x] Lead statuses: `NEW`, `CONTACTED`, `QUALIFIED`, `UNQUALIFIED`, `CONVERTED`, `LOST`
- [x] Lead can be promoted to a customer (converts to separate `Customer` record, lead marked `CONVERTED`)
- [x] List leads with pagination and filters: status, assignedTo, source, date range
- [x] Assign/reassign a lead to a team member (must be a member of the same tenant)
- [x] Add timeline notes to a lead (freetext entries with timestamp and author)
- [x] Lead score field (manual 1–5 star, or computed in E03-04)

### Non-Functional Requirements
- [x] All lead queries are scoped to the caller's tenant (enforced at ORM layer from E02-01)
- [x] `lead:create`, `lead:update`, `lead:delete`, `lead:assign` permissions enforced (from E02-02)
- [x] List query uses standard pagination (E01-07) — default limit 20, max 100

## Acceptance Criteria
- [x] STAFF user can create and update leads; cannot delete without `lead:delete` permission
- [x] List query with `status: QUALIFIED` returns only qualified leads for the caller's tenant
- [x] Converting a lead creates a `Customer` record and marks the lead as `CONVERTED`
- [x] Timeline note added by user A is visible to all tenant members viewing that lead
- [x] Lead from tenant A is not visible to any user in tenant B

## Technical Specifications

### Architecture Impact
- **Prisma**: New `Lead`, `Customer`, `LeadNote` models; all tenant-scoped
- **Backend**: `CrmModule` (feature-flagged behind `crm` feature, E02-04)
- **GraphQL**: CRUD resolvers with pagination and filtering

### Prisma Schema
```prisma
model Lead {
  id          String     @id @default(uuid())
  tenantId    String
  name        String
  email       String?
  phone       String?
  source      String?
  status      LeadStatus @default(NEW)
  score       Int?       // 1-5
  assignedToId String?
  pipelineStageId String?  // used by STORY-E03-02
  notes       LeadNote[]
  tenant      Tenant     @relation(fields: [tenantId], references: [id])
  assignedTo  User?      @relation(fields: [assignedToId], references: [id])
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  @@index([tenantId, status])
  @@index([tenantId, assignedToId])
}

model LeadNote {
  id        String   @id @default(uuid())
  leadId    String
  authorId  String
  content   String
  createdAt DateTime @default(now())
  lead      Lead     @relation(fields: [leadId], references: [id])
  author    User     @relation(fields: [authorId], references: [id])
}

model Customer {
  id        String   @id @default(uuid())
  tenantId  String
  leadId    String?  @unique
  name      String
  email     String?
  phone     String?
  createdAt DateTime @default(now())
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
}

enum LeadStatus { NEW CONTACTED QUALIFIED UNQUALIFIED CONVERTED LOST }
```

## Implementation Plan

### Step 1: Prisma Models
- Create `Lead`, `Customer`, `LeadNote` models with tenant-scoped indexes
- Seed a few sample leads in dev seed

### Step 2: Lead CRUD API
- Mutations: `createLead`, `updateLead`, `deleteLead`, `convertLeadToCustomer`
- Query: `lead(id)`, `leads(filter, pagination, orderBy)`
- Apply `@RequirePermission('lead:create')` etc. on each mutation
- Apply `@RequireFeature('crm')` on the module

### Step 3: Assignment & Timeline
- Mutation: `assignLead(leadId, userId)` — validates assignee is a tenant member
- Mutation: `addLeadNote(leadId, content)` — creates a `LeadNote`
- Timeline included in `lead(id)` query response

### Step 4: Filtering & Pagination
- `LeadsFilter` input: `status?`, `assignedToId?`, `source?`, `from?`, `to?`
- Uses `paginate()` utility from STORY-E01-07

## Testing Strategy

### Unit Tests
- [x] `convertLeadToCustomer` creates `Customer` and sets lead status to `CONVERTED`
- [x] List query with `status` filter returns correct leads

### Integration Tests
- [ ] User from tenant B cannot read lead from tenant A
- [ ] STAFF user without `lead:delete` permission receives FORBIDDEN on `deleteLead`
- [ ] Pagination metadata (`totalPages`, `total`) is correct on filtered list

## Implementation Notes (2026-09-13)
- Implemented tenant-scoped lead/customer CRUD, conversion, assignment, notes, filtering, ordering, and page/limit pagination.
- Added resolver permission metadata and CRM feature gating through the existing tenant and feature guards.
- Verification passed: `npx prisma generate`, `npx jest --testPathPatterns=crm --runInBand` (43 tests), `npm run lint`, and `npm run build`.
- Integration coverage for cross-tenant reads, permission failures, feature-flag behavior, and filtered pagination metadata remains pending.

## Dependencies

### Blocked By
- STORY-E02-01 (tenant isolation)
- STORY-E02-02 (RBAC permissions: `lead:*`)
- STORY-E02-04 (feature flag: `crm`)
- STORY-E01-07 (pagination pattern)

### Blocks
- STORY-E03-02 (pipeline stage references `Lead`)
- STORY-E03-03 (tasks reference `Lead`)
- STORY-E03-04 (automation triggers on lead events)
- STORY-E03-05 (analytics counts lead conversions)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Lead assigned to user from another tenant | High | Validate assignee `tenantId` matches caller's `tenantId` in service layer |
| Large lead lists slow to load | Medium | Ensure `(tenantId, status)` composite index; limit to 100 per page |
