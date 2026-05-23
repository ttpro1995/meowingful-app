# Story: Student Enrollment & Course Access Control

## Metadata
- **Story ID**: STORY-E05-03
- **Epic**: EPIC-05 — E-Learning Core
- **Priority**: High
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a student, I want to enroll in a course and access its lessons so that I can begin learning, and as an instructor, I want to control who has access to my course content.

## Context
Without enrollment, the course catalog is just a listing. This story gates access — only enrolled students can view lesson content. It also tracks lesson progress (watched, completed) which feeds into the grading system (E05-05) and certificates (EPIC-07). Enrollment can be self-service (free courses) or admin-initiated (paid or restricted courses).

## Requirements

### Functional Requirements
- [ ] Student can self-enroll in free (`price = 0`) published courses
- [ ] Admin/instructor can enroll or unenroll any student in any course (manual enrollment)
- [ ] Enrollment blocked if prerequisite courses not completed
- [ ] After enrollment, student can view all lesson content for that course
- [ ] Student lesson progress tracked: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`
- [ ] Course completion: all required lessons completed → enrollment status `COMPLETED`
- [ ] Enrollment has an expiry date (optional) — after expiry, access revoked

### Non-Functional Requirements
- [ ] Lesson access check adds < 5ms overhead (enrollment status cached in Redis)
- [ ] `course:enroll` permission required for self-enrollment (default: STUDENT role)
- [ ] Enrollment and progress data is tenant-scoped

## Acceptance Criteria
- [ ] Student self-enrolls in free course → can immediately access all lessons
- [ ] Student attempts to enroll in a course with unmet prerequisite → gets clear error
- [ ] Student completes all lessons → enrollment status becomes `COMPLETED`
- [ ] Admin unenrolls a student → student can no longer access lesson content
- [ ] Expired enrollment returns `ACCESS_EXPIRED` error on lesson access

## Technical Specifications

### Architecture Impact
- **Prisma**: New `Enrollment`, `LessonProgress` models
- **Backend**: `EnrollmentModule` inside `ElearningModule`
- **GraphQL**: Enrollment mutations + progress queries

### Prisma Schema
```prisma
model Enrollment {
  id           String           @id @default(uuid())
  tenantId     String
  studentId    String
  courseId     String
  status       EnrollmentStatus @default(ACTIVE)
  enrolledAt   DateTime         @default(now())
  completedAt  DateTime?
  expiresAt    DateTime?
  progress     LessonProgress[]
  tenant       Tenant           @relation(fields: [tenantId], references: [id])
  student      User             @relation(fields: [studentId], references: [id])
  course       Course           @relation(fields: [courseId], references: [id])
  @@unique([tenantId, studentId, courseId])
  @@index([tenantId, studentId])
  @@index([tenantId, courseId])
}

model LessonProgress {
  id           String          @id @default(uuid())
  enrollmentId String
  lessonId     String
  status       ProgressStatus  @default(NOT_STARTED)
  completedAt  DateTime?
  lastAccessedAt DateTime?
  enrollment   Enrollment      @relation(fields: [enrollmentId], references: [id])
  lesson       Lesson          @relation(fields: [lessonId], references: [id])
  @@unique([enrollmentId, lessonId])
}

enum EnrollmentStatus { ACTIVE COMPLETED EXPIRED UNENROLLED }
enum ProgressStatus   { NOT_STARTED IN_PROGRESS COMPLETED }
```

### Course Completion Logic
- Triggered when a lesson is marked `COMPLETED`
- If all required lessons (non-optional) are `COMPLETED` → set `Enrollment.status = COMPLETED`, set `completedAt`
- Emit `COURSE_COMPLETED` event (for certificate generation in EPIC-07)

### Lesson Access Check
```typescript
async canAccessLesson(userId, lessonId, tenantId): Promise<boolean> {
  // 1. Check Redis: `access:{tenantId}:{userId}:{courseId}`
  // 2. If miss: query Enrollment where studentId=userId, courseId=lesson.courseId
  //    status=ACTIVE, expiresAt > now()
  // 3. Cache result for 5 min
}
```

## Implementation Plan

### Step 1: Prisma Models
- Create `Enrollment` and `LessonProgress` models

### Step 2: Enrollment API
- Mutation: `enrollInCourse(courseId)` — self-enroll (STUDENT role, free courses)
- Mutation: `adminEnrollStudent(studentId, courseId, expiresAt?)` — admin enrollment
- Mutation: `unenrollStudent(studentId, courseId)` — admin only
- Query: `myEnrollments(filter, pagination)`, `courseEnrollments(courseId, pagination)`

### Step 3: Lesson Access Guard
- `LessonAccessGuard` — wraps lesson content queries; calls `canAccessLesson`
- Cache enrollment status in Redis (5-min TTL)

### Step 4: Progress Tracking
- Mutation: `updateLessonProgress(lessonId, status)` — student marks lesson complete
- On `COMPLETED`: check if all lessons done → trigger course completion

### Step 5: Prerequisite Validation
- In `enrollInCourse`: query prerequisite course enrollments, check all are `COMPLETED`
- Return `PREREQUISITE_NOT_MET` error with list of incomplete prerequisites

## Testing Strategy

### Unit Tests
- [ ] Course completion trigger fires when all lessons are COMPLETED
- [ ] Prerequisite check blocks enrollment when prerequisite not completed

### Integration Tests
- [ ] Student enrolls in free course → `LessonProgress` rows created for all lessons
- [ ] Accessing lesson without enrollment returns `UNAUTHORIZED`
- [ ] Admin unenrolls student → subsequent lesson access returns `UNAUTHORIZED`

## Dependencies

### Blocked By
- STORY-E05-01 (Course and Lesson entities)
- STORY-E02-02 (RBAC: `course:enroll`)
- STORY-E01-02 (Redis for access cache)

### Blocks
- STORY-E05-04 (assignments require enrollment)
- STORY-E05-05 (grading reads enrollment)
- EPIC-07 (student portal reads enrollment and progress; certificates triggered on completion)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Access cache stale after unenrollment | Medium | Explicit cache invalidation on unenroll; TTL 5 min as safety net |
| Concurrent enrollment creates duplicates | Low | `@@unique([tenantId, studentId, courseId])` + upsert |
