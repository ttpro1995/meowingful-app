# Story: Sales Analytics & Reporting

## Metadata
- **Story ID**: STORY-E03-05
- **Epic**: EPIC-03 — CRM & Sales Management
- **Priority**: Medium
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a sales director, I want dashboards and exportable reports showing conversion rates, pipeline velocity, and revenue forecasts so that I can coach my team and make data-driven decisions.

## Context
Sales analytics are a reporting layer on top of the lead/pipeline data from E03-01 and E03-02. The key reports are conversion funnel (by stage), lead source breakdown, and staff performance. This story does not require a custom report builder — predefined report types are sufficient at this stage.

## Requirements

### Functional Requirements
- [ ] Conversion funnel report: lead count at each pipeline stage, conversion rate stage-to-stage
- [ ] Lead source report: lead counts grouped by source with conversion rate per source
- [ ] Staff performance report: leads assigned per staff member, conversion rate, avg time to close
- [ ] Revenue forecast: count of `QUALIFIED` leads × average deal value (configurable per tenant)
- [ ] All reports filterable by date range and pipeline
- [ ] Export report data as CSV

### Non-Functional Requirements
- [ ] Reports are pre-aggregated by a background job (not on-demand DB scan) — refreshed every hour
- [ ] Direct DB queries allowed only for small date ranges (< 30 days); larger ranges use cache
- [ ] Export CSV generation is async — returns a download URL when ready

## Acceptance Criteria
- [ ] Conversion funnel shows correct lead counts when queried against known test data
- [ ] Staff performance report shows correct conversion rate for each team member
- [ ] Export CSV for the past 30 days is downloadable within 10 seconds
- [ ] Director-only report endpoints return FORBIDDEN for STAFF role

## Technical Specifications

### Architecture Impact
- **Backend**: `AnalyticsModule` (inside `CrmModule`); `ReportAggregationJob` (Bull)
- **Prisma**: `ReportCache` model to store pre-aggregated results
- **GraphQL**: Report queries; REST endpoint for CSV download

### Report Query API
```graphql
type FunnelStage {
  stage: PipelineStage!
  count: Int!
  conversionRate: Float!  # % moving to next stage
}

type ConversionFunnelReport {
  pipeline: Pipeline!
  stages: [FunnelStage!]!
  totalLeads: Int!
  overallConversionRate: Float!
}

type StaffPerformance {
  user: User!
  totalLeads: Int!
  convertedLeads: Int!
  conversionRate: Float!
  avgDaysToClose: Float!
}

type Query {
  conversionFunnelReport(pipelineId: ID!, dateRange: DateRangeInput): ConversionFunnelReport!
  leadSourceReport(dateRange: DateRangeInput): [LeadSourceStat!]!
  staffPerformanceReport(dateRange: DateRangeInput): [StaffPerformance!]!
  revenueForecast(dateRange: DateRangeInput): Float!
}
```

### CSV Export
- `POST /reports/export { type, filter }` → enqueues job → returns `{ jobId }`
- `GET /reports/export/:jobId` → returns `{ status, downloadUrl? }`
- CSV generated in background, uploaded to S3/MinIO, signed URL returned

## Implementation Plan

### Step 1: Report Queries (Direct DB, small ranges)
- Implement all 4 report queries with direct Prisma queries and date range filtering
- Apply `@RequirePermission('report:view')` (DIRECTOR and above)

### Step 2: Background Aggregation
- `ReportAggregationJob` runs every hour: pre-computes funnel + source stats → writes to `ReportCache`
- Large date range queries read from `ReportCache` instead of DB

### Step 3: CSV Export
- Bull job: run report query → format as CSV → upload to storage → return signed URL
- Poll endpoint or WebSocket notification when export is ready

### Step 4: Revenue Forecast Setting
- Tenant admin sets `averageDealValue` in `TenantConfig` (E02-04)
- Forecast = `QUALIFIED lead count × averageDealValue`

## Testing Strategy

### Unit Tests
- [ ] `conversionRate` calculation is correct for known input counts
- [ ] CSV formatter produces correct headers and rows

### Integration Tests
- [ ] Funnel report with known seed data returns expected stage counts and conversion rates
- [ ] STAFF role receives FORBIDDEN on report queries

## Dependencies

### Blocked By
- STORY-E03-01 (Lead data)
- STORY-E03-02 (Pipeline stages and transitions)
- STORY-E02-02 (RBAC: `report:view`)

### Blocks
- Nothing directly — reporting layer

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Aggregation job slow for large tenants | Medium | Run per-tenant with concurrency limit; index `(tenantId, createdAt)` on Lead |
| CSV export times out for large datasets | Medium | Limit export to 10K rows per request; paginate if needed |
