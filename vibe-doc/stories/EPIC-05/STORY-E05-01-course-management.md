# Story: Course Management

## Metadata
- **Story ID**: STORY-E05-01
- **Epic**: EPIC-05 — E-Learning Core
- **Priority**: High
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As an instructor, I want to create and structure courses with sections and lessons so that students have a clear curriculum to follow from enrollment through completion.

## Context
Course management is the foundation of the E-Learning module. Content upload (E05-02), enrollment (E05-03), assignments (E05-04), and grading (E05-05) all reference the Course entity. The data model must support hierarchical curriculum: Course → Section → Lesson. Prerequisites between courses are needed for structured learning paths.

## Requirements

### Functional Requirements
- [ ] Instructor can create a course with: title, description, thumbnail, price, category, tags, difficulty level
- [ ] Course structure: Course → Sections → Lessons (drag-to-reorder within sections)
- [ ] Course states: `DRAFT`, `PUBLISHED`, `ARCHIVED` — only `PUBLISHED` courses visible to students
- [ ] Course prerequisites: a course can require completion of other courses before enrollment
- [ ] Course pricing: free or paid (price in tenant currency); discount percentage configurable
- [ ] Tenant admin can set category taxonomy; instructors assign their course to a category
- [ ] Course clone: duplicate a course as a new draft for iteration

### Non-Functional Requirements
- [ ] Course list query uses standard pagination (E01-07) with filters: category, difficulty, price range, status
- [ ] `course:create`, `course:publish`, `course:archive` permissions enforced (E02-02)
- [ ] Feature flag `elearning` must be enabled (E02-04)
- [ ] All course data is tenant-scoped

## Acceptance Criteria
- [ ] Instructor creates a course "English Grammar A1" with 3 sections and 10 lessons (draft)
- [ ] Publishing the course makes it visible in the student catalog
- [ ] A student cannot enroll in "English Grammar A2" without completing "A1" (prerequisite)
- [ ] Reordering sections persists the new order
- [ ] Tenant B cannot see tenant A's courses

## Technical Specifications

### Architecture Impact
- **Prisma**: New `Course`, `CourseSection`, `Lesson`, `CoursePrerequisite`, `CourseCategory` models
- **Backend**: `ElearningModule` (feature-flagged); `CourseModule` inside it
- **GraphQL**: Course CRUD, curriculum management, catalog query

### Prisma Schema
```prisma
model Course {
  id             String          @id @default(uuid())
  tenantId       String
  instructorId   String
  categoryId     String?
  title          String
  description    String?
  thumbnailUrl   String?
  price          Decimal         @default(0)
  discountPct    Int             @default(0)
  difficulty     CourseDifficulty @default(BEGINNER)
  status         CourseStatus    @default(DRAFT)
  tags           String[]
  sections       CourseSection[]
  prerequisites  CoursePrerequisite[] @relation("RequiresCourse")
  requiredBy     CoursePrerequisite[] @relation("RequiredByCourse")
  enrollments    Enrollment[]
  tenant         Tenant          @relation(fields: [tenantId], references: [id])
  instructor     User            @relation(fields: [instructorId], references: [id])
  @@index([tenantId, status, categoryId])
}

model CourseSection {
  id       String   @id @default(uuid())
  courseId String
  title    String
  order    Int
  lessons  Lesson[]
  course   Course   @relation(fields: [courseId], references: [id])
  @@index([courseId, order])
}

model Lesson {
  id        String        @id @default(uuid())
  sectionId String
  title     String
  order     Int
  type      LessonType    // VIDEO | DOCUMENT | TEXT | QUIZ
  contentId String?       // reference to Content entity (E05-02)
  duration  Int?          // minutes
  isFree    Boolean       @default(false)
  section   CourseSection @relation(fields: [sectionId], references: [id])
  @@index([sectionId, order])
}

model CoursePrerequisite {
  courseId       String
  prerequisiteId String
  course         Course @relation("RequiresCourse", fields: [courseId], references: [id])
  prerequisite   Course @relation("RequiredByCourse", fields: [prerequisiteId], references: [id])
  @@id([courseId, prerequisiteId])
}

model CourseCategory {
  id       String   @id @default(uuid())
  tenantId String
  name     String
  courses  Course[]
  @@unique([tenantId, name])
}

enum CourseStatus   { DRAFT PUBLISHED ARCHIVED }
enum CourseDifficulty { BEGINNER INTERMEDIATE ADVANCED }
enum LessonType     { VIDEO DOCUMENT TEXT QUIZ }
```

## Implementation Plan

### Step 1: Prisma Models
- Create all models; seed 2 sample courses with sections and lessons in dev

### Step 2: Course CRUD API
- Mutations: `createCourse`, `updateCourse`, `publishCourse`, `archiveCourse`, `cloneCourse`
- Query: `course(id)` (full curriculum), `courses(filter, pagination)` (catalog view)
- Apply `@RequirePermission('course:create')`, `@RequireFeature('elearning')`

### Step 3: Curriculum Management
- Mutations: `createSection`, `updateSection`, `deleteSection`, `reorderSections`
- Mutations: `createLesson`, `updateLesson`, `deleteLesson`, `reorderLessons`
- `reorder` mutations accept an ordered array of IDs and update `order` field in a transaction

### Step 4: Prerequisites
- `addPrerequisite(courseId, prerequisiteId)`, `removePrerequisite`
- Prerequisite check in enrollment (STORY-E05-03): verify all prerequisite courses completed

### Step 5: Category Management
- Admin mutations: `createCategory`, `updateCategory`, `deleteCategory`
- `deleteCategory` rejected if courses are assigned to it

## Testing Strategy

### Unit Tests
- [ ] `reorderSections` updates `order` field for all sections in a transaction

### Integration Tests
- [ ] Publishing a DRAFT course changes status to PUBLISHED and it appears in catalog
- [ ] Tenant B cannot read tenant A's course
- [ ] Clone creates an exact copy in DRAFT status

## Dependencies

### Blocked By
- STORY-E02-01 (tenant scoping)
- STORY-E02-02 (RBAC: `course:*` permissions)
- STORY-E02-04 (feature flag: `elearning`)
- STORY-E01-07 (pagination for course catalog)

### Blocks
- STORY-E05-02 (content upload references Lesson)
- STORY-E05-03 (enrollment references Course)
- STORY-E05-04 (assignments belong to Lesson)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Circular prerequisites | High | Validate DAG (no cycles) when adding prerequisites |
| Large course catalogs slow to load | Medium | Index on `(tenantId, status, categoryId)`; paginate at 20 |
