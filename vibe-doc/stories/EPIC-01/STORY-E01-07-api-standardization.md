# Story: API Pagination, Filtering & Error Standardization

## Metadata
- **Story ID**: STORY-E01-07
- **Epic**: EPIC-01 — Foundation & Infrastructure Enhancement
- **Priority**: Medium
- **Status**: Todo
- **Created**: 2026-05-09
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a frontend developer and API consumer, I want consistent pagination, filtering, and error responses across all list endpoints so that I can build UIs predictably without learning per-endpoint quirks.

## Context
The MVP has only a handful of queries and no list endpoints yet. Before CRM leads, courses, and students are added (hundreds to thousands of records each), we must establish standard patterns. Retrofitting pagination later is costly. This story defines and protects those patterns before new modules build on them.

## Requirements

### Functional Requirements
- [ ] All list GraphQL queries accept `pagination: { page, limit }` and return `PaginatedResult<T>`
- [ ] All list queries accept an `orderBy: { field, direction }` argument
- [ ] Common filter types established: `StringFilter`, `DateFilter`, `EnumFilter`
- [ ] All GraphQL errors follow a standard `UserError` shape (code, message, field)
- [ ] Validation errors return field-level `UserError` list instead of generic 400
- [ ] Unhandled exceptions return a generic `INTERNAL_ERROR` code without leaking stack traces in production

### Non-Functional Requirements
- [ ] Max `limit` enforced at 100 to prevent unbounded queries
- [ ] Default `limit` is 20
- [ ] Pagination metadata included: `{ total, page, limit, totalPages }`

## Acceptance Criteria
- [ ] A list query with `pagination: { page: 2, limit: 10 }` returns the correct slice and metadata
- [ ] Submitting invalid input to a mutation returns `{ errors: [{ code: "VALIDATION_ERROR", field: "email", message: "..." }] }`
- [ ] An unhandled exception in production returns `{ errors: [{ code: "INTERNAL_ERROR", message: "Something went wrong" }] }` — no stack trace
- [ ] Requesting `limit: 200` is clamped or rejected with a clear error

## Technical Specifications

### Architecture Impact
- **Backend**: New shared `PaginationModule`, `PaginationArgs`, `PaginatedResult<T>` generic type
- **Backend**: New `ErrorFormattingPlugin` for GraphQL exception formatting
- **Backend**: `UserError` GraphQL object type added to schema

### GraphQL Types (Shared)
```graphql
input PaginationArgs {
  page: Int = 1
  limit: Int = 20
}

input OrderByArgs {
  field: String!
  direction: SortDirection!
}

enum SortDirection { ASC DESC }

type PageInfo {
  total: Int!
  page: Int!
  limit: Int!
  totalPages: Int!
}

# Generic pattern — implement per type, e.g.:
type PaginatedUsers {
  data: [User!]!
  pageInfo: PageInfo!
}
```

### Error Shape
```graphql
type UserError {
  code: String!       # VALIDATION_ERROR | NOT_FOUND | UNAUTHORIZED | INTERNAL_ERROR
  message: String!
  field: String       # present for field-level validation errors
}
```

### Prisma Pagination Helper
```typescript
function paginate(page: number, limit: number) {
  const safeLimit = Math.min(limit, 100);
  return {
    skip: (page - 1) * safeLimit,
    take: safeLimit,
  };
}
```

### Error Formatting Plugin
- Catch `ValidationError` (class-validator) → map to `UserError[]` with `field` set
- Catch `NotFoundException` → `{ code: "NOT_FOUND" }`
- Catch unknown → log at ERROR level → return `{ code: "INTERNAL_ERROR" }` in production, full error in development

## Implementation Plan

### Step 1: Pagination Primitives
- Create `src/shared/pagination/pagination.args.ts` with `PaginationArgs` and `OrderByArgs`
- Create `src/shared/pagination/paginate.ts` utility and `PaginatedResult<T>` generic class
- Write unit tests for `paginate()` edge cases (limit clamping, page 0 edge)

### Step 2: Error Standardization
- Create `src/shared/errors/user-error.type.ts` GraphQL type
- Create `src/shared/errors/error-format.plugin.ts` NestJS GraphQL plugin
- Register plugin in `GraphQLModule.forRoot({ plugins: [ErrorFormatPlugin] })`
- Add integration test: trigger validation error → assert `UserError` shape

### Step 3: Apply to Existing Queries
- `getUser` already returns single object — no change needed
- Document the pattern in `vibe-doc/development-guide.md` for future module authors

## Testing Strategy

### Unit Tests
- [ ] `paginate(2, 10)` returns `{ skip: 10, take: 10 }`
- [ ] `paginate(1, 200)` clamps to `{ skip: 0, take: 100 }`
- [ ] `ErrorFormatPlugin` maps `ValidationError` to `UserError[]` with field names

### Integration Tests
- [ ] List query with pagination returns correct `pageInfo` values
- [ ] Invalid mutation input returns `UserError` with `field` set

## Dependencies

### Blocked By
- Nothing — pure shared infrastructure

### Blocks
- EPIC-02 through EPIC-11 — all list endpoints must use this standard

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Future modules bypass the standard | Medium | Add ESLint rule or PR checklist item requiring `PaginationArgs` on list resolvers |
| `totalPages` computation is expensive (COUNT query) | Low | Use Prisma `$transaction([findMany, count])` to batch; optimize later with cursor-based pagination |
