# Story: Notification Engine Core — Email, SMS & In-App

## Metadata
- **Story ID**: STORY-E04-01
- **Epic**: EPIC-04 — Notification & Communication Infrastructure
- **Priority**: High
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a platform user, I want to receive email, SMS, and in-app notifications for important events (invitation received, assignment graded, SLA breached) so that I stay informed without checking the app constantly.

## Context
The notification engine is shared infrastructure consumed by nearly every other epic. EPIC-02 needs it for tenant invitations, EPIC-03 needs it for SLA alerts and workflow automation, and EPIC-05 needs it for assignment deadlines. Building the core delivery layer and in-app notification inbox now allows other epics to simply call `NotificationService.send(...)` without building their own delivery mechanism.

## Requirements

### Functional Requirements
- [ ] `NotificationService.send(type, recipient, payload)` — single entry point for all notification delivery
- [ ] Channels: email (via SMTP/SendGrid), in-app (stored in DB, polled or WebSocket-pushed)
- [ ] SMS channel wired (via Twilio stub) — actual delivery behind feature flag, off by default
- [ ] In-app notification inbox: list unread/read notifications, mark as read, mark all as read
- [ ] Notification types: `INVITATION`, `TASK_OVERDUE`, `SLA_BREACHED`, `ASSIGNMENT_GRADED`, `LEAD_ASSIGNED`
- [ ] Notifications are tenant-scoped and user-scoped

### Non-Functional Requirements
- [ ] Email delivery is async (Bull queue) — does not block the calling mutation
- [ ] Failed email delivery retried up to 3 times with exponential backoff
- [ ] In-app notifications are fetched via GraphQL query; real-time push via WebSocket (E04-02) is additive
- [ ] No notification is sent to deactivated users

## Acceptance Criteria
- [ ] Calling `NotificationService.send('INVITATION', user, payload)` delivers an email to the user
- [ ] In-app notification appears in the user's inbox after `LEAD_ASSIGNED` event
- [ ] User marks a notification as read; `isRead` becomes `true`
- [ ] Email delivery failure is retried and logged; does not throw in the calling service
- [ ] Deactivated user receives no email

## Technical Specifications

### Architecture Impact
- **Prisma**: New `Notification` model (in-app store)
- **Backend**: `NotificationModule` (global); `EmailService`; `SmsService` (stubbed); Bull queue `notifications`
- **GraphQL**: In-app inbox query + read mutation

### Prisma Schema
```prisma
model Notification {
  id         String           @id @default(uuid())
  tenantId   String
  userId     String
  type       NotificationType
  title      String
  body       String
  data       Json?            // extra context (leadId, taskId, etc.)
  isRead     Boolean          @default(false)
  readAt     DateTime?
  createdAt  DateTime         @default(now())
  tenant     Tenant           @relation(fields: [tenantId], references: [id])
  user       User             @relation(fields: [userId], references: [id])
  @@index([tenantId, userId, isRead])
}

enum NotificationType {
  INVITATION TASK_OVERDUE SLA_BREACHED
  ASSIGNMENT_GRADED LEAD_ASSIGNED GENERAL
}
```

### NotificationService Interface
```typescript
interface NotificationPayload {
  recipientId: string;
  tenantId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels: ('email' | 'in_app' | 'sms')[];
}

@Injectable()
export class NotificationService {
  async send(payload: NotificationPayload): Promise<void>
  // → saves in-app Notification to DB
  // → enqueues email/SMS jobs to Bull queue
}
```

### Email Delivery (Bull Worker)
- Job: `{ recipientEmail, subject, htmlBody }`
- Uses Nodemailer with SMTP or SendGrid depending on env var `EMAIL_PROVIDER`
- Retry: 3 attempts, exponential backoff 1s → 4s → 16s

## Implementation Plan

### Step 1: Prisma Model & Module
- Create `Notification` model
- Create `NotificationModule` (global) with `NotificationService`

### Step 2: In-App Delivery
- Save `Notification` to DB immediately (synchronous, fast)
- GraphQL queries: `myNotifications(filter: { isRead }, pagination)`, `unreadCount`
- Mutations: `markAsRead(id)`, `markAllAsRead`

### Step 3: Email Delivery
- `EmailService` with Nodemailer
- Bull queue `notifications` with worker that sends email and handles retries
- Simple HTML email template (text + title, no design system yet — E04-03 adds templates)

### Step 4: SMS Stub
- `SmsService` that logs to console when `SMS_ENABLED=false` (default)
- Twilio integration wired but inactive; activated via env var

### Step 5: Integration Points
- Wire `NotificationService.send` calls into: `InvitationService` (STORY-E02-03), `AutomationEngine` (STORY-E03-04)

## Testing Strategy

### Unit Tests
- [ ] `NotificationService.send` saves in-app notification and enqueues email job
- [ ] Email worker retries 3 times on SMTP failure before marking failed

### Integration Tests
- [ ] After `LEAD_ASSIGNED`, user has new in-app notification with correct type
- [ ] `markAllAsRead` sets all user's notifications to `isRead: true`
- [ ] Deactivated user does not receive email (checked before enqueue)

## Dependencies

### Blocked By
- STORY-E02-01 (tenant scoping for notifications)
- STORY-E01-02 (Redis/Bull for async email queue)

### Blocks
- STORY-E02-03 (invitation email)
- STORY-E03-04 (SEND_NOTIFICATION automation action)
- STORY-E04-03 (notification templates override base email format)
- STORY-E04-04 (scheduled notifications use this engine)
- STORY-E05-04 (assignment deadline notifications)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SMTP credentials missing in dev | Low | Fall back to Ethereal (fake SMTP) when `EMAIL_PROVIDER=dev` |
| Notification spam if automation rules are misconfigured | Medium | Rate-limit: max 20 notifications per user per hour per type |
| In-app inbox grows unbounded | Low | Archive notifications older than 90 days (background job) |
