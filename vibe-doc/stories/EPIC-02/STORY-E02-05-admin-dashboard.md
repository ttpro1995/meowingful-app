# Story: Admin Dashboard — Real-Time Metrics

## Metadata
- **Story ID**: STORY-E02-05
- **Epic**: EPIC-02 — Multi-Tenant Admin & RBAC
- **Priority**: Medium
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a tenant admin or director, I want a dashboard showing key operational metrics (active students, revenue, teacher activity) that updates without a page refresh so that I can make real-time decisions.

## Context
Before CRM and E-Learning modules ship, this dashboard will be mostly empty. The value of this story is establishing the dashboard shell, the WebSocket subscription pattern, and the metric aggregation infrastructure that later modules populate. Building the shell now prevents a large integration effort when EPIC-03 and EPIC-05 land.

## Requirements

### Functional Requirements
- [ ] Dashboard shows: total active users, total students, total courses published, monthly revenue (placeholder $0 until payments ship)
- [ ] Metrics update in real-time via GraphQL subscriptions (WebSocket) when underlying data changes
- [ ] Admin can filter dashboard by date range (last 7d, 30d, 90d)
- [ ] Dashboard includes a "recent activity" feed: last 10 significant events (user joined, course published, etc.)

### Non-Functional Requirements
- [ ] Dashboard queries complete in < 500ms (aggregated by background job, not on-demand DB scan)
- [ ] WebSocket subscription is authenticated — unauthenticated clients cannot subscribe
- [ ] Metric aggregates are pre-computed and stored in Redis; DB is never hit on dashboard load

## Acceptance Criteria
- [ ] Dashboard loads in < 500ms with current metric values
- [ ] Adding a new user to the tenant increments the "active users" counter on the dashboard without refresh
- [ ] Date range filter correctly scopes all metrics to the selected period
- [ ] Non-admin role (e.g., STAFF) cannot access the admin dashboard — returns `FORBIDDEN`

## Technical Specifications

### Architecture Impact
- **Backend**: `DashboardModule`; metric aggregation job (Bull queue or cron); GraphQL subscription for metric updates
- **Frontend**: Dashboard page with metric cards + activity feed; WebSocket subscription hook
- **Redis**: Pre-aggregated metrics stored as JSON under `dashboard:{tenantId}` key

### Metric Aggregation
- Scheduled job runs every 60s: queries DB, writes to Redis, publishes a WebSocket event
- Event-driven updates: when a user joins or a course is published, an event is emitted to update the relevant metric immediately (no waiting for the 60s cycle)

### GraphQL API
```graphql
type DashboardMetrics {
  activeUsers: Int!
  totalStudents: Int!
  publishedCourses: Int!
  monthlyRevenue: Float!
  recentActivity: [ActivityEvent!]!
}

type ActivityEvent {
  id: ID!
  type: String!    # USER_JOINED | COURSE_PUBLISHED | LEAD_CONVERTED
  actor: String!
  timestamp: DateTime!
}

type Query {
  dashboardMetrics(dateRange: DateRangeInput): DashboardMetrics!
}

type Subscription {
  dashboardMetricsUpdated: DashboardMetrics!
}
```

## Implementation Plan

### Step 1: Dashboard Backend Shell
- `DashboardModule` with `DashboardService` (reads from Redis)
- `dashboardMetrics` query returning hardcoded/empty data initially
- Scheduled aggregation job (runs every 60s, writes to Redis)

### Step 2: WebSocket Subscriptions
- Depends on STORY-E04-02 (WebSocket infrastructure)
- Publish `DASHBOARD_UPDATED` event to tenant-scoped channel on any domain event
- GraphQL subscription resolves latest metrics from Redis

### Step 3: Real-Time Updates
- Domain events: `UserJoined`, `CoursePublished`, `LeadConverted` — emitted by EPIC-03/05 modules
- Dashboard aggregation service subscribes to these events and updates Redis + publishes WebSocket event

### Step 4: Frontend Dashboard Page
- Metric cards layout (4 KPIs)
- Activity feed list
- Date range selector
- WebSocket subscription hook (auto-reconnect)

## Testing Strategy

### Unit Tests
- [ ] `DashboardService.getMetrics()` reads from Redis (mocked)
- [ ] Aggregation job writes correct counts to Redis

### Integration Tests
- [ ] WebSocket subscription receives update within 2s after user is added to tenant
- [ ] STAFF role receives FORBIDDEN on dashboard query

## Dependencies

### Blocked By
- STORY-E02-01 (tenant context)
- STORY-E02-02 (RBAC guard — admin-only)
- STORY-E04-02 (WebSocket infrastructure for real-time subscriptions)

### Blocks
- Nothing directly — future epics populate the metrics

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Aggregation job overloads DB | Medium | Run aggregation in background; use indexed queries only |
| WebSocket not yet available when dashboard ships | Low | Fall back to polling (60s interval) until E04-02 is merged |
| Revenue metric is always $0 until payments ship | Low | Show placeholder with "coming soon" label |
