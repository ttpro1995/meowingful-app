# Story: Notification Templates & User Preferences

## Metadata
- **Story ID**: STORY-E04-03
- **Epic**: EPIC-04 — Notification & Communication Infrastructure
- **Priority**: Medium
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a tenant admin, I want to customize the email templates for notifications so that they match our brand, and as a user, I want to control which notifications I receive so that I'm not overwhelmed.

## Context
E04-01 sends plain-text emails from hardcoded templates. Once the notification engine is working, the next improvement is giving admins a branded template and letting users opt out of non-critical notifications. This is a quality-of-life improvement — the system works without it, but user experience is much better with it.

## Requirements

### Functional Requirements
- [ ] Admin can edit notification templates per type: subject, HTML body (with Handlebars variables)
- [ ] Template variables automatically injected: `{{user.name}}`, `{{tenant.name}}`, `{{lead.name}}`, etc.
- [ ] Template preview with sample data shown before saving
- [ ] User preferences: per notification type, user can toggle email on/off, SMS on/off (in-app always on)
- [ ] User preferences UI in profile settings page
- [ ] Default preferences: email on for all types; SMS off by default

### Non-Functional Requirements
- [ ] Template rendering uses Handlebars (server-side, safe — no code execution)
- [ ] Invalid Handlebars syntax in template is caught on save with a clear error
- [ ] User preference lookup adds < 1ms overhead (loaded from JWT claim or Redis cache)

## Acceptance Criteria
- [ ] Admin edits `LEAD_ASSIGNED` email template with custom logo and text
- [ ] User assigned a lead receives the customized email (not the default)
- [ ] User disables email for `TASK_OVERDUE`; subsequent task overdue events do not send email to that user
- [ ] Template with invalid Handlebars syntax returns validation error on save

## Technical Specifications

### Architecture Impact
- **Prisma**: New `NotificationTemplate`, `UserNotificationPreference` models
- **Backend**: `TemplateService` (renders Handlebars); preference-aware `NotificationService` update
- **GraphQL**: Template CRUD + user preference update

### Prisma Schema
```prisma
model NotificationTemplate {
  id       String           @id @default(uuid())
  tenantId String
  type     NotificationType
  subject  String
  htmlBody String           // Handlebars template
  tenant   Tenant           @relation(fields: [tenantId], references: [id])
  @@unique([tenantId, type])
}

model UserNotificationPreference {
  id       String           @id @default(uuid())
  userId   String
  tenantId String
  type     NotificationType
  emailEnabled Boolean      @default(true)
  smsEnabled   Boolean      @default(false)
  @@unique([userId, tenantId, type])
}
```

### NotificationService Update
```typescript
// Before sending email, check:
// 1. Does a custom template exist for this type+tenant? Use it, else use default.
// 2. Does user have email disabled for this type? Skip email channel.
async send(payload) {
  const prefs = await this.getPreferences(payload.recipientId, payload.tenantId, payload.type);
  if (!prefs.emailEnabled) payload.channels = payload.channels.filter(c => c !== 'email');
  const template = await this.getTemplate(payload.tenantId, payload.type);
  const rendered = this.renderTemplate(template, payload.data);
  // ... proceed with delivery
}
```

## Implementation Plan

### Step 1: Prisma Models & Defaults
- Create `NotificationTemplate` and `UserNotificationPreference` models
- Seed default templates for all `NotificationType` values in each tenant (on tenant creation)

### Step 2: Template Management API
- Mutations: `updateNotificationTemplate(type, subject, htmlBody)` — admin only
- Query: `notificationTemplates` — list all templates for current tenant
- Validation: render template with empty data; catch Handlebars syntax errors

### Step 3: User Preference API
- Mutation: `updateNotificationPreference(type, emailEnabled, smsEnabled)`
- Query: `myNotificationPreferences` — list all preferences for current user

### Step 4: Wire into NotificationService
- Load preferences before dispatching (cache in Redis with 5-min TTL)
- Use custom template if exists; fall back to hardcoded default

## Testing Strategy

### Unit Tests
- [ ] `renderTemplate` correctly substitutes `{{user.name}}` with provided value
- [ ] Invalid Handlebars template throws validation error on save

### Integration Tests
- [ ] User with email disabled for `TASK_OVERDUE` does not receive email when task is overdue
- [ ] Custom tenant template is used instead of default when present

## Dependencies

### Blocked By
- STORY-E04-01 (notification engine — templates are an enhancement layer on top)
- STORY-E02-02 (admin-only permission for template management)

### Blocks
- STORY-E04-04 (scheduled notifications use these templates)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Handlebars XSS via admin-crafted template | Medium | Use `Handlebars.compile` with `escapeExpression` (default); no `{{{ }}}` triple-stash in allowed template vars |
| Preference cache stale | Low | 5-min TTL; explicit invalidation on preference update |
