# Story: Assignment Management

## Metadata
- **Story ID**: STORY-E05-04
- **Epic**: EPIC-05 — E-Learning Core
- **Priority**: High
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As an instructor, I want to create assignments for lessons and set deadlines so that students have structured deliverables, and as a student, I want to submit my work and receive a deadline reminder so that I stay on track.

## Context
Assignments are the interaction layer of the course — they turn passive video watching into active learning. This story covers the full lifecycle: instructor creates assignment → student submits → system acknowledges submission → instructor grades (E05-05). Deadline reminders rely on the scheduled notification engine (E04-04).

## Requirements

### Functional Requirements
- [ ] Instructor creates an assignment for a lesson with: title, description, due date, max score, max attempts, allowed file types
- [ ] Student submits by uploading a file or writing a text response
- [ ] Student can resubmit up to `maxAttempts` times before the deadline (or if instructor allows late)
- [ ] Deadline reminders: 24h and 1h before deadline (via E04-04 scheduled notifications)
- [ ] Assignment shows submission status: `NOT_SUBMITTED`, `SUBMITTED`, `GRADED`, `LATE`
- [ ] Instructor can allow late submission per assignment with optional penalty

### Non-Functional Requirements
- [ ] Assignment submissions stored in S3 (using `FileStorageService` from E05-02)
- [ ] Only enrolled students can submit (enrollment check via E05-03)
- [ ] Submission file size limit: 50MB per file, 200MB total per submission

## Acceptance Criteria
- [ ] Student submits a PDF for assignment before deadline → status becomes `SUBMITTED`
- [ ] Student attempts to submit after deadline with late submission disabled → gets `DEADLINE_PASSED` error
- [ ] Student receives email reminder 24h before deadline
- [ ] Instructor sees all submissions for an assignment with student names and submitted-at timestamps
- [ ] Student submitting a 4th time on a 3-attempt assignment receives `MAX_ATTEMPTS_REACHED` error

## Technical Specifications

### Architecture Impact
- **Prisma**: New `Assignment`, `AssignmentSubmission` models
- **Backend**: `AssignmentModule` inside `ElearningModule`
- **GraphQL**: Assignment CRUD + submission mutations
- **Storage**: Submission files stored via `FileStorageService`

### Prisma Schema
```prisma
model Assignment {
  id              String       @id @default(uuid())
  tenantId        String
  lessonId        String
  title           String
  description     String?
  dueDate         DateTime?
  maxScore        Int          @default(100)
  maxAttempts     Int          @default(1)
  allowLateSubmit Boolean      @default(false)
  latePenaltyPct  Int          @default(0)
  allowedFileTypes String[]    // ["pdf", "docx", "zip"]
  submissions     AssignmentSubmission[]
  lesson          Lesson       @relation(fields: [lessonId], references: [id])
  tenant          Tenant       @relation(fields: [tenantId], references: [id])
}

model AssignmentSubmission {
  id             String           @id @default(uuid())
  tenantId       String
  assignmentId   String
  studentId      String
  attemptNumber  Int
  content        String?          // text response
  fileKeys       String[]         // S3 object keys
  status         SubmissionStatus @default(SUBMITTED)
  isLate         Boolean          @default(false)
  submittedAt    DateTime         @default(now())
  grade          Grade?           // set by E05-05
  assignment     Assignment       @relation(fields: [assignmentId], references: [id])
  student        User             @relation(fields: [studentId], references: [id])
  tenant         Tenant           @relation(fields: [tenantId], references: [id])
  @@unique([assignmentId, studentId, attemptNumber])
  @@index([tenantId, assignmentId])
}

enum SubmissionStatus { SUBMITTED GRADED LATE }
```

### Deadline Reminder Scheduling
```typescript
// When assignment is created with a dueDate:
if (assignment.dueDate) {
  await schedulerService.scheduleNotification({
    type: 'ASSIGNMENT_DUE',
    scheduledFor: subHours(assignment.dueDate, 24),
    // ... notify all enrolled students
  });
  await schedulerService.scheduleNotification({
    type: 'ASSIGNMENT_DUE',
    scheduledFor: subHours(assignment.dueDate, 1),
  });
}
```

### Submission Validation
1. Student must be enrolled (E05-03 access check)
2. `attemptNumber = previous attempts + 1 <= maxAttempts`
3. If `now() > dueDate && !allowLateSubmit` → reject with `DEADLINE_PASSED`
4. If late and allowed → `isLate = true`

## Implementation Plan

### Step 1: Prisma Models
- Create `Assignment` and `AssignmentSubmission` models

### Step 2: Assignment CRUD
- Mutations: `createAssignment`, `updateAssignment`, `deleteAssignment` (instructor/admin only)
- Query: `assignment(id)`, `assignments(lessonId)`, `courseAssignments(courseId)`
- On create with `dueDate`: schedule deadline reminders (call E04-04)

### Step 3: Submission Flow
- Mutation: `submitAssignment(assignmentId, { content?, files? })` — validates, increments attempt, saves
- For file submissions: client uploads via pre-signed URL (same pattern as E05-02), then calls `submitAssignment` with the file keys
- Query: `mySubmissions(assignmentId)` — student views own submissions
- Query: `allSubmissions(assignmentId, pagination)` — instructor views all

### Step 4: Late Submission Handling
- `isLate` flag set automatically based on `submittedAt > dueDate`
- Late penalty applied during grading (E05-05 reads `isLate` and `latePenaltyPct`)

## Testing Strategy

### Unit Tests
- [ ] Attempt number validation rejects submission beyond `maxAttempts`
- [ ] `isLate` is set correctly when `submittedAt > dueDate`
- [ ] Deadline reminder scheduling called with correct timestamps on assignment creation

### Integration Tests
- [ ] Unenrolled student cannot submit → `UNAUTHORIZED`
- [ ] Student submits file → submission record created with correct `fileKeys`
- [ ] Late submission with `allowLateSubmit = false` returns `DEADLINE_PASSED`

## Dependencies

### Blocked By
- STORY-E05-01 (Lesson entity — assignment belongs to lesson)
- STORY-E05-03 (enrollment check before submission)
- STORY-E05-02 (FileStorageService for submission file upload)
- STORY-E04-04 (scheduled notifications for deadline reminders)

### Blocks
- STORY-E05-05 (grading reads submissions)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Deadline reminder fired for already-submitted students | Medium | Check submission status before sending; cancel reminder if submitted |
| Submission file with malicious content | High | Validate file extension + MIME type; do not execute uploaded files |
| Race condition: two submissions in same second | Low | DB unique constraint on `(assignmentId, studentId, attemptNumber)` |
