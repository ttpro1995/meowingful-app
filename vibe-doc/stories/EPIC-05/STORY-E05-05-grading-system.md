# Story: Grading System

## Metadata
- **Story ID**: STORY-E05-05
- **Epic**: EPIC-05 — E-Learning Core
- **Priority**: High
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As an instructor, I want to grade student assignment submissions — manually with feedback or automatically for multiple-choice questions — so that students receive scored results and know how they performed.

## Context
Grading closes the assignment lifecycle loop started in E05-04. Without grades, assignments are submitted into a void. This story adds manual grading with rubric support and auto-grading for quiz-type lessons. The grade is stored on the submission and triggers a `ASSIGNMENT_GRADED` notification to the student. The grade feeds into course completion tracking (E05-03) and future certificate generation (EPIC-07).

## Requirements

### Functional Requirements
- [ ] Instructor can manually grade a submission: score (0–maxScore), written feedback, optional rubric evaluation
- [ ] Auto-grading: for quiz/multiple-choice assignments, scores computed on submission automatically
- [ ] Rubric: instructor can attach a rubric to an assignment (list of criteria with max points)
- [ ] Partial scoring: each rubric criterion scored individually; total auto-summed
- [ ] Late penalty applied automatically: `finalScore = score × (1 - latePenaltyPct / 100)`
- [ ] Student notified of grade via in-app and email notification (E04-01)
- [ ] Instructor can re-grade (override) a previous grade
- [ ] Grade book view: all students × all assignments for a course with scores

### Non-Functional Requirements
- [ ] `assignment:grade` permission enforced (E02-02) — INSTRUCTOR and TENANT_ADMIN
- [ ] Auto-grading runs synchronously on submission for quiz types (fast)
- [ ] Grade is immutable once set — re-grading creates a new `Grade` record and marks previous as superseded

## Acceptance Criteria
- [ ] Instructor grades submission with score 85/100 and feedback "Good work"; student sees grade in their submission view
- [ ] Student receives `ASSIGNMENT_GRADED` email and in-app notification
- [ ] Quiz submission auto-graded: 8/10 correct → score 80 (if maxScore=100)
- [ ] Late submission with 10% penalty: raw score 90 → final score 81
- [ ] Grade book shows all enrolled students, each with their latest score per assignment

## Technical Specifications

### Architecture Impact
- **Prisma**: New `Grade`, `Rubric`, `RubricCriterion`, `RubricEvaluation` models
- **Backend**: `GradingModule` inside `ElearningModule`; auto-grading service for quizzes
- **GraphQL**: Grade mutations + grade book query

### Prisma Schema
```prisma
model Grade {
  id              String             @id @default(uuid())
  tenantId        String
  submissionId    String
  gradedById      String
  rawScore        Float
  finalScore      Float              // after late penalty
  feedback        String?
  isSuperseded    Boolean            @default(false)
  gradedAt        DateTime           @default(now())
  rubricEvals     RubricEvaluation[]
  submission      AssignmentSubmission @relation(fields: [submissionId], references: [id])
  gradedBy        User               @relation(fields: [gradedById], references: [id])
  tenant          Tenant             @relation(fields: [tenantId], references: [id])
  @@index([tenantId, submissionId])
}

model Rubric {
  id           String           @id @default(uuid())
  assignmentId String           @unique
  criteria     RubricCriterion[]
  assignment   Assignment       @relation(fields: [assignmentId], references: [id])
}

model RubricCriterion {
  id        String             @id @default(uuid())
  rubricId  String
  name      String
  maxPoints Int
  rubric    Rubric             @relation(fields: [rubricId], references: [id])
  evals     RubricEvaluation[]
}

model RubricEvaluation {
  id          String          @id @default(uuid())
  gradeId     String
  criterionId String
  points      Float
  comment     String?
  grade       Grade           @relation(fields: [gradeId], references: [id])
  criterion   RubricCriterion @relation(fields: [criterionId], references: [id])
  @@unique([gradeId, criterionId])
}
```

### Auto-Grading (Quiz)
```typescript
// Quiz lesson has content with questions + correct answers (stored in Content.data JSON)
// On submitAssignment for LessonType.QUIZ:
async autoGrade(submission: AssignmentSubmission, quizAnswers: QuizContent) {
  const correct = submission.answers.filter(
    (a, i) => a === quizAnswers.correctAnswers[i]
  ).length;
  const rawScore = (correct / quizAnswers.questions.length) * assignment.maxScore;
  const finalScore = applyLatePenalty(rawScore, submission.isLate, assignment.latePenaltyPct);
  await this.saveGrade({ submissionId, rawScore, finalScore, gradedById: 'system' });
}
```

### Grade Notification
```typescript
// After grade saved:
await notificationService.send({
  type: 'ASSIGNMENT_GRADED',
  recipientId: submission.studentId,
  data: { assignmentTitle, score: grade.finalScore, feedback: grade.feedback },
  channels: ['in_app', 'email'],
});
```

## Implementation Plan

### Step 1: Prisma Models
- Create `Grade`, `Rubric`, `RubricCriterion`, `RubricEvaluation` models

### Step 2: Manual Grading API
- Mutation: `gradeSubmission(submissionId, { score, feedback, rubricEvals? })` — instructor only
- On grade save: apply late penalty, mark previous grade as superseded, send notification
- Mutation: `createRubric(assignmentId, criteria)`, `updateRubric`

### Step 3: Auto-Grading
- On `submitAssignment` for quiz-type: call `GradingService.autoGrade(submission)` synchronously
- Quiz content schema: stored as JSON in `Content.data` field

### Step 4: Grade Book View
- Query: `gradeBook(courseId)` — returns matrix: enrolled students × assignments × latest grade
- Optimized with a single JOIN query; limited to 200 students × 50 assignments per call

### Step 5: Notification
- Wire `NotificationService.send('ASSIGNMENT_GRADED', ...)` after each grade

## Testing Strategy

### Unit Tests
- [ ] Auto-grading calculates correct score for 8/10 correct answers
- [ ] Late penalty applied correctly: `90 × 0.9 = 81`
- [ ] Re-grading marks previous grade as `isSuperseded = true`

### Integration Tests
- [ ] Manual grade triggers `ASSIGNMENT_GRADED` in-app notification
- [ ] Grade book returns correct scores for 3 students × 2 assignments

## Dependencies

### Blocked By
- STORY-E05-04 (Assignment and Submission entities)
- STORY-E04-01 (notification: `ASSIGNMENT_GRADED`)
- STORY-E02-02 (RBAC: `assignment:grade`)

### Blocks
- EPIC-07 (student portal grade history; certificate generation requires course completion + grade)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Grade book query slow for large courses | Medium | Limit to 200 students; add `(tenantId, submissionId)` index on Grade |
| Auto-grading answer key stored unsafely | High | Quiz answer key stored server-side only; never sent to client before submission |
