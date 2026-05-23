# Story: Landing Page Builder

## Metadata
- **Story ID**: STORY-E03-06
- **Epic**: EPIC-03 — CRM & Sales Management
- **Priority**: Low
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a marketing staff member, I want to build landing pages from templates and publish them under our domain so that I can capture leads from campaigns without involving engineering.

## Context
This is a quality-of-life feature for marketing teams. The CRM is already functional without it — leads can be created manually or via API. The landing page builder is lower priority because it requires significant frontend work (drag-and-drop editor) and the value is only realized when the sales pipeline (E03-02) and notification engine (E04-01) are already working. A/B testing is explicitly deferred to a later story to keep scope manageable.

## Requirements

### Functional Requirements
- [ ] Marketing staff can create a landing page from a predefined template library (min 3 templates)
- [ ] Page content editable: headline, subheadline, body text, CTA button text, background image
- [ ] Form block: captures name, email, phone → creates a `Lead` in the CRM on submission
- [ ] Published page is accessible at `/{tenantSlug}/pages/{pageSlug}` (no custom domain in v1)
- [ ] Page can be published (live) or draft (not publicly accessible)
- [ ] Basic analytics: page view count and form submission count per page

### Non-Functional Requirements
- [ ] Published pages are server-side rendered or statically cached (< 200ms TTFB)
- [ ] Form submission rate-limited to 5 per minute per IP to prevent spam
- [ ] Landing pages are tenant-scoped — accessible only under the tenant's slug
- [ ] A/B testing is out of scope for this story

## Acceptance Criteria
- [ ] Staff creates a page from the "Course Enrollment" template, edits headline, publishes it
- [ ] Submitting the form on the published page creates a Lead in the tenant's CRM
- [ ] Draft page returns 404 when accessed publicly
- [ ] Page analytics show correct view and submission counts

## Technical Specifications

### Architecture Impact
- **Prisma**: New `LandingPage`, `PageTemplate` models
- **Backend**: `LandingPageModule`; public REST endpoint for page rendering + form submission
- **Frontend**: Page builder UI (simplified — form-based, not drag-and-drop in v1); public page renderer

### Prisma Schema
```prisma
model LandingPage {
  id          String   @id @default(uuid())
  tenantId    String
  templateId  String
  slug        String
  title       String
  content     Json     // { headline, subheadline, body, ctaText, backgroundImageUrl }
  status      PageStatus @default(DRAFT)
  viewCount   Int      @default(0)
  submitCount Int      @default(0)
  publishedAt DateTime?
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  @@unique([tenantId, slug])
}

model PageTemplate {
  id          String @id @default(uuid())
  name        String
  description String
  previewUrl  String
  defaultContent Json
}

enum PageStatus { DRAFT PUBLISHED ARCHIVED }
```

### Public Endpoints (REST, no auth)
```
GET  /p/:tenantSlug/:pageSlug        → render published page
POST /p/:tenantSlug/:pageSlug/submit → submit lead form → create Lead
```

## Implementation Plan

### Step 1: Templates & Page CRUD
- Seed 3 page templates (Course Enrollment, Free Trial, Contact Us)
- Mutations: `createLandingPage(templateId, slug)`, `updateLandingPage`, `publishPage`, `archivePage`

### Step 2: Public Renderer
- `GET /p/:tenantSlug/:pageSlug` — fetch page from DB (cache 60s in Redis), return HTML
- Validates page is `PUBLISHED` and tenant is active

### Step 3: Form Submission
- `POST /p/:tenantSlug/:pageSlug/submit` — rate-limited, validates input, calls `LeadService.create`
- Increments `submitCount`; increments `viewCount` on GET

### Step 4: Builder UI
- Form-based editor (not drag-and-drop): text fields for each content block
- Template picker with preview cards
- Publish/unpublish toggle

## Testing Strategy

### Unit Tests
- [ ] Rate limiter blocks 6th submission from same IP within 60s

### Integration Tests
- [ ] Submitting form on published page creates Lead in CRM
- [ ] Accessing draft page returns 404
- [ ] View count increments on each page GET

## Dependencies

### Blocked By
- STORY-E03-01 (Lead creation on form submit)
- STORY-E02-01 (tenant slug for URL routing)
- STORY-E02-04 (feature flag: `crm`)

### Blocks
- Nothing

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Spam submissions create junk leads | Medium | Rate limit per IP + CAPTCHA in future iteration |
| Drag-and-drop editor scope creep | High | Explicitly out of scope — form-based editor only in v1 |
