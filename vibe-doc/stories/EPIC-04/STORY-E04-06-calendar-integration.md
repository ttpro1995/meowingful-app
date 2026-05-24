# Story: Calendar Integration — Scheduling & Appointment Foundation

## Metadata
- **Story ID**: STORY-E04-06
- **Epic**: EPIC-04 — Notification & Communication Infrastructure
- **Priority**: Low
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a sales or education staff member, I want to schedule appointments and see them in a calendar view so that I can manage class schedules, sales calls, and meetings in one place.

## Context
Calendar is foundational for both the CRM (scheduling sales calls) and E-Learning (scheduling live classes, EPIC-06). This story establishes the `CalendarEvent` entity and a basic calendar view — it intentionally stops short of external calendar sync (Google Calendar / Outlook) which requires OAuth flows better suited to a future story. Conflict detection for live class scheduling (EPIC-06) will build on this.

## Requirements

### Functional Requirements
- [ ] Create calendar events with: title, description, start time, end time, attendees (tenant members), event type (SALES_CALL, CLASS, MEETING, OTHER)
- [ ] View events in a calendar UI: month, week, and day views
- [ ] Events can be linked to a lead or course (optional)
- [ ] Attendees receive an in-app notification on invite (via E04-01)
- [ ] Conflict detection: warn (not block) when creating an event that overlaps with attendee's existing events
- [ ] Recurring events: repeat daily/weekly/monthly with end date

### Non-Functional Requirements
- [ ] Calendar query returns events for a date range efficiently (indexed on `startTime`)
- [ ] All times stored in UTC; displayed in tenant timezone (E02-04)
- [ ] External calendar sync (Google/Outlook) is out of scope

## Acceptance Criteria
- [ ] Sales staff creates a "Demo Call" event for lead John, attendees: self + manager
- [ ] Both self and manager receive an in-app notification about the event
- [ ] A conflict warning appears if a new event overlaps an attendee's existing event (not blocking)
- [ ] Monthly recurring event auto-creates occurrences for the next 3 months

## Technical Specifications

### Architecture Impact
- **Prisma**: New `CalendarEvent`, `EventAttendee` models
- **Backend**: `CalendarModule`
- **Frontend**: Calendar UI component (FullCalendar library)

### Prisma Schema
```prisma
model CalendarEvent {
  id           String         @id @default(uuid())
  tenantId     String
  title        String
  description  String?
  startTime    DateTime
  endTime      DateTime
  eventType    CalendarEventType
  entityType   String?        // "Lead" | "Course" | null
  entityId     String?
  recurrence   String?        // "NONE" | "DAILY" | "WEEKLY" | "MONTHLY"
  recurrenceEnd DateTime?
  parentEventId String?
  attendees    EventAttendee[]
  tenant       Tenant         @relation(fields: [tenantId], references: [id])
  @@index([tenantId, startTime, endTime])
}

model EventAttendee {
  eventId  String
  userId   String
  status   AttendeeStatus @default(PENDING)
  event    CalendarEvent  @relation(fields: [eventId], references: [id])
  user     User           @relation(fields: [userId], references: [id])
  @@id([eventId, userId])
}

enum CalendarEventType { SALES_CALL CLASS MEETING OTHER }
enum AttendeeStatus    { PENDING ACCEPTED DECLINED }
```

### Conflict Detection Query
```typescript
// Before creating event, check:
const conflicts = await prisma.calendarEvent.findMany({
  where: {
    tenantId,
    attendees: { some: { userId: { in: attendeeIds } } },
    startTime: { lt: endTime },
    endTime: { gt: startTime },
  }
});
// Return conflicts as warnings, not errors
```

## Implementation Plan

### Step 1: Prisma Models & CRUD API
- Create `CalendarEvent` and `EventAttendee` models
- Mutations: `createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent`
- Query: `calendarEvents(dateRange, attendeeId?)` — returns events in date range

### Step 2: Conflict Detection
- Check for overlapping events on create/update; return warnings in mutation response

### Step 3: Attendee Notifications
- On event create: call `NotificationService.send(CALENDAR_INVITE, attendee, eventData)` for each attendee

### Step 4: Recurring Events
- On create with recurrence: generate next 3 months of occurrences (stored as separate rows with `parentEventId`)
- Cron job: monthly, generate next month's occurrences for ongoing recurrences

### Step 5: Frontend Calendar
- FullCalendar React component with month/week/day views
- Create event modal with attendee search

## Testing Strategy

### Unit Tests
- [ ] Conflict detection returns overlapping events for given attendees and time range

### Integration Tests
- [ ] Creating event with 2 attendees sends 2 `CALENDAR_INVITE` notifications
- [ ] Recurring weekly event generates correct occurrences for next 3 months

## Dependencies

### Blocked By
- STORY-E04-01 (notification for attendee invites)
- STORY-E02-01 (tenant scoping)
- STORY-E02-03 (validate attendees are tenant members)

### Blocks
- STORY-E06 (live class scheduling builds on `CalendarEvent.eventType = CLASS`)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Generating too many recurring event rows | Medium | Cap at 12 months ahead; regenerate lazily as time passes |
| FullCalendar library license | Low | FullCalendar community edition (MIT) is sufficient for this scope |
