# Story: Scheduled & Triggered Notifications

## Metadata
- **Story ID**: STORY-E04-04
- **Epic**: EPIC-04 — Notification & Communication Infrastructure
- **Priority**: Medium
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a platform admin, I want to schedule notifications to be sent at a specific time (e.g., "remind students 24h before class") and trigger them on business events (e.g., "notify when assignment deadline passes") so that communication happens automatically at the right moment.

## Context
E04-01 delivers notifications immediately when called. This story adds time-based scheduling on top — a reminder that fires in the future and recurring reminders (e.g., daily attendance reminder). It also formalizes the event-to-notification mapping that other epics rely on (SLA breach → notify, assignment graded → notify student).

## Requirements

### Functional Requirements
- [ ] Admin can create a scheduled notification rule: trigger time (absolute or relative to an event), recipient(s), notification type, channel
- [ ] Relative scheduling: "X hours before event date" or "X hours after event date" (e.g., class reminder 24h before)
- [ ] Recurring schedule: daily/weekly at a configured time in the tenant's timezone (from E02-04)
- [ ] Event-to-notification mappings are configurable per tenant (which events send which notifications)
- [ ] Scheduled notifications can be cancelled before they fire
- [ ] Notification delivery log: each scheduled notification logged with fired-at and status

### Non-Functional Requirements
- [ ] Scheduled notifications fire within 1-minute tolerance of their target time
- [ ] Scheduler uses Bull delayed jobs — not a cron loop polling the DB every minute
- [ ] Timezone-aware: all scheduled times converted to UTC using the tenant's timezone setting

## Acceptance Criteria
- [ ] Admin creates a rule: "Send class reminder email 24h before class.startTime"
- [ ] A class is scheduled for tomorrow at 10am; the reminder fires at 10am today (tenant timezone)
- [ ] Admin cancels the scheduled notification; it does not fire even if the time arrives
- [ ] Delivery log shows `FIRED` with the actual sent-at timestamp

## Technical Specifications

### Architecture Impact
- **Prisma**: New `ScheduledNotification` model
- **Backend**: `SchedulerModule`; Bull delayed jobs for each scheduled notification

### Prisma Schema
```prisma
model ScheduledNotification {
  id              String                @id @default(uuid())
  tenantId        String
  type            NotificationType
  recipientId     String
  channel         String[]              // ["email", "in_app"]
  data            Json
  scheduledFor    DateTime              // UTC
  status          ScheduledStatus       @default(PENDING)
  firedAt         DateTime?
  cancelledAt     DateTime?
  bullJobId       String?
  tenant          Tenant                @relation(fields: [tenantId], references: [id])
  @@index([tenantId, scheduledFor, status])
}

enum ScheduledStatus { PENDING FIRED FAILED CANCELLED }
```

### Scheduling Flow
```typescript
// When a class is created with startTime:
await schedulerService.scheduleNotification({
  type: 'CLASS_REMINDER',
  recipientId: studentId,
  scheduledFor: subHours(class.startTime, 24), // converted to UTC
  data: { className, teacherName },
  channels: ['email', 'in_app'],
});
// → creates ScheduledNotification row
// → adds Bull delayed job: delay = scheduledFor - now()
// → stores Bull jobId for cancellation
```

### Cancellation
```typescript
await schedulerService.cancelNotification(scheduledNotificationId);
// → marks ScheduledNotification.status = CANCELLED
// → calls queue.getJob(bullJobId).remove()
```

## Implementation Plan

### Step 1: Prisma Model & SchedulerModule
- Create `ScheduledNotification` model
- `SchedulerService.scheduleNotification(params)` — creates row + Bull delayed job
- `SchedulerService.cancelNotification(id)` — cancels row + removes Bull job

### Step 2: Bull Worker
- Worker processes the job at fire time: calls `NotificationService.send(...)`, updates status to `FIRED`
- On failure: retries 3 times; marks `FAILED` with error

### Step 3: Configurable Event Mappings
- `NotificationRuleConfig` JSON in `TenantConfig`: maps events to notification rules
- Example: `{ "CLASS_STARTING": { "enabled": true, "offsetHours": -24, "channels": ["email"] } }`
- Admin UI to toggle event notification mappings

### Step 4: Recurring Notifications
- Separate cron job (NestJS `@Cron`): fires daily at midnight UTC, creates next occurrence of recurring rules
- Example: daily attendance reminder at 9am tenant timezone

## Testing Strategy

### Unit Tests
- [ ] Bull delayed job created with correct delay when `scheduleNotification` is called
- [ ] `cancelNotification` removes Bull job and sets status to CANCELLED

### Integration Tests
- [ ] Scheduled notification fires within 1 minute of `scheduledFor` time (test with short delay)
- [ ] Cancelled notification does not fire

## Dependencies

### Blocked By
- STORY-E04-01 (notification engine — scheduled notifications call `NotificationService.send`)
- STORY-E04-03 (templates — scheduled notifications use tenant templates)
- STORY-E02-04 (tenant timezone for scheduling)
- STORY-E01-02 (Bull queue infrastructure)

### Blocks
- STORY-E05-04 (assignment deadline reminders use this scheduler)
- STORY-E06 (class reminders)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Bull job lost on Redis restart | Medium | Enable Bull job persistence (`removeOnComplete: false`); monitor queue on startup for missed jobs |
| Timezone DST edge cases | Low | Store all times as UTC; convert only for display |
| Too many scheduled jobs for large tenants | Medium | Cap at 10,000 pending notifications per tenant; alert when approaching limit |
