# Story: File Storage System — Folder Management, Sharing & Version Control

## Metadata
- **Story ID**: STORY-E05-06
- **Epic**: EPIC-05 — E-Learning Core
- **Priority**: Medium
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As a tenant user (instructor, admin, or staff), I want a shared file drive where I can organize, share, and version-control documents so that course materials, templates, and company files are accessible to the right people without emailing attachments.

## Context
STORY-E05-02 added a `FileStorageService` for uploading course content. This story builds a user-facing file manager on top of that infrastructure: folders, metadata, sharing, and version history. This is a shared resource for the whole tenant — course materials, HR documents, sales templates all live here. Storage quotas established in E05-02 continue to apply.

## Requirements

### Functional Requirements
- [ ] Users can create folders and upload files (any type)
- [ ] Folder hierarchy: unlimited nesting depth
- [ ] Sharing: share a file or folder with specific users or roles within the tenant (read or write access)
- [ ] Version control: uploading a new version of a file creates a version history; previous versions accessible and restorable
- [ ] File search: search by filename within the tenant's drive
- [ ] Soft delete: deleted files go to Trash; recoverable for 30 days; then permanently deleted

### Non-Functional Requirements
- [ ] File operations scoped to tenant; no cross-tenant file access
- [ ] File metadata stored in DB; actual file bytes in S3/MinIO (using `FileStorageService`)
- [ ] File download uses pre-signed S3 URLs (1-hour expiry)
- [ ] Storage quota from `TenantConfig` applies across all file uploads (course content + file drive)

## Acceptance Criteria
- [ ] User uploads a file to a folder; file appears in folder listing
- [ ] User shares a folder with "Sales Manager" role; all sales managers can read files in that folder
- [ ] User uploads a new version of an existing file; previous version is preserved and listable
- [ ] Deleted file moved to Trash; restored before 30 days; absent after 30-day auto-purge
- [ ] Search for "template" returns all files with "template" in the name

## Technical Specifications

### Architecture Impact
- **Prisma**: New `DriveFile`, `DriveFolder`, `FileVersion`, `FileShare` models
- **Backend**: `DriveModule` inside `ElearningModule` (but accessible to all modules)
- **GraphQL**: Folder/file CRUD + share + version management

### Prisma Schema
```prisma
model DriveFolder {
  id        String        @id @default(uuid())
  tenantId  String
  name      String
  parentId  String?
  ownerId   String
  parent    DriveFolder?  @relation("FolderTree", fields: [parentId], references: [id])
  children  DriveFolder[] @relation("FolderTree")
  files     DriveFile[]
  shares    FileShare[]
  tenant    Tenant        @relation(fields: [tenantId], references: [id])
  owner     User          @relation(fields: [ownerId], references: [id])
  @@index([tenantId, parentId])
}

model DriveFile {
  id          String        @id @default(uuid())
  tenantId    String
  folderId    String?
  name        String
  mimeType    String
  sizeBytes   Int
  isDeleted   Boolean       @default(false)
  deletedAt   DateTime?
  ownerId     String
  versions    FileVersion[]
  shares      FileShare[]
  folder      DriveFolder?  @relation(fields: [folderId], references: [id])
  tenant      Tenant        @relation(fields: [tenantId], references: [id])
  owner       User          @relation(fields: [ownerId], references: [id])
  @@index([tenantId, folderId, isDeleted])
  @@index([tenantId, name])
}

model FileVersion {
  id         String    @id @default(uuid())
  fileId     String
  versionNum Int
  storageKey String
  sizeBytes  Int
  uploadedAt DateTime  @default(now())
  uploadedById String
  file       DriveFile @relation(fields: [fileId], references: [id])
  @@unique([fileId, versionNum])
}

model FileShare {
  id         String      @id @default(uuid())
  tenantId   String
  fileId     String?
  folderId   String?
  sharedWithUserId String?
  sharedWithRole   String?   // RoleName enum
  permission FilePermission @default(READ)
  file       DriveFile?  @relation(fields: [fileId], references: [id])
  folder     DriveFolder? @relation(fields: [folderId], references: [id])
}

enum FilePermission { READ WRITE }
```

### Version Control Flow
- On file update: create new `FileVersion` row (new `storageKey`), increment `versionNum`, keep old versions
- `restoreVersion(fileId, versionNum)` → creates a new version copying that `storageKey` as the latest

### Trash & Auto-Purge
- `deleteFile(id)` → sets `isDeleted = true`, `deletedAt = now()`
- Scheduled job (daily): permanently delete (S3 object + DB rows) for files where `deletedAt < now() - 30 days`

## Implementation Plan

### Step 1: Prisma Models & Basic CRUD
- Create all models
- Mutations: `createFolder`, `renameFolder`, `deleteFolder` (recursive soft-delete)
- Mutations: `uploadFile`, `moveFile`, `renameFile`, `deleteFile`, `restoreFile`
- Query: `folderContents(folderId?, pagination)` — files and subfolders

### Step 2: File Upload Integration
- Reuse `FileStorageService` from E05-02
- Pre-signed URL flow: `createFileUploadUrl` → upload → `confirmFileUpload`
- Increment tenant storage usage counter

### Step 3: Sharing
- Mutations: `shareFile(fileId, userId?, roleName?, permission)`, `unshareFile`
- Access check: user can access a file if: owner, or has a matching `FileShare`, or inherited from parent folder share

### Step 4: Version History
- Query: `fileVersions(fileId)` — list all versions with sizes and upload dates
- Mutation: `restoreFileVersion(fileId, versionNum)`

### Step 5: Trash & Search
- Query: `trash(pagination)` — files with `isDeleted = true`
- Query: `searchFiles(query, pagination)` — simple `ILIKE %query%` on `name`
- Scheduled job: purge old trash

## Testing Strategy

### Unit Tests
- [ ] `deleteFile` sets `isDeleted = true` without removing DB row
- [ ] Trash purge job selects only files deleted > 30 days ago

### Integration Tests
- [ ] Upload a file, upload a new version → `fileVersions` returns 2 versions
- [ ] Share folder with SALES_MANAGER role → a user with that role can read files in the folder
- [ ] Storage quota exceeded → upload returns `QUOTA_EXCEEDED`

## Dependencies

### Blocked By
- STORY-E05-02 (`FileStorageService` and quota tracking infrastructure)
- STORY-E02-01 (tenant scoping)
- STORY-E02-02 (role-based sharing uses RoleName)

### Blocks
- Nothing directly — standalone drive feature

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Deep folder hierarchy creates slow recursive queries | Medium | Limit depth to 10 levels; use materialized path or ltree for deep hierarchies in future |
| Restoring a version after quota is exceeded | Low | Check quota on restore as if it were a new upload |
| S3 objects orphaned if DB row creation fails | Medium | Use two-phase: confirm endpoint only creates DB row after S3 upload confirmed |
