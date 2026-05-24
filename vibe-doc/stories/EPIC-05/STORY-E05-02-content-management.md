# Story: Content Management — Video, Documents & SCORM

## Metadata
- **Story ID**: STORY-E05-02
- **Epic**: EPIC-05 — E-Learning Core
- **Priority**: High
- **Status**: Todo
- **Created**: 2026-05-24
- **Related**: vibe-doc/epic-plan.md, vibe-doc/architecture.md

## User Story
As an instructor, I want to upload videos and documents to my lessons so that students can access course materials, and as an admin, I want SCORM packages to be uploadable so that we can import third-party training content.

## Context
Lessons are shells until content is attached. This story handles file upload, storage, and the playback/viewing layer. Video is the heaviest case — large files, streaming, and progress tracking. SCORM compatibility is required for enterprise clients who purchase off-the-shelf training. Storage quotas are enforced per tenant to control costs.

## Requirements

### Functional Requirements
- [ ] Instructor uploads video, PDF, or SCORM package to a lesson
- [ ] Uploaded content stored in S3-compatible object storage (MinIO in dev)
- [ ] Video content: direct upload via pre-signed URL (bypasses backend for large files); duration extracted on upload
- [ ] Document content (PDF, Word, Excel, PowerPoint): stored and accessible via signed URL
- [ ] SCORM 1.2 / SCORM 2004 packages: uploaded as ZIP, extracted server-side, launch URL returned
- [ ] Instructor can replace content on a lesson (old file archived, not deleted immediately)
- [ ] Per-tenant storage quota enforced (configurable in `TenantConfig`)

### Non-Functional Requirements
- [ ] Pre-signed upload URL expires in 15 minutes
- [ ] Video streaming uses range requests (HTTP 206) to support seeking
- [ ] SCORM extraction runs asynchronously in a Bull job
- [ ] Storage usage tracked per tenant; upload rejected if quota exceeded

## Acceptance Criteria
- [ ] Instructor uploads a 200MB video using the pre-signed URL; video is playable in the lesson
- [ ] Uploading a SCORM package processes it and returns a launch URL within 60 seconds
- [ ] Uploading when tenant storage quota is exceeded returns `QUOTA_EXCEEDED` error
- [ ] Document content is viewable via a signed URL valid for 1 hour

## Technical Specifications

### Architecture Impact
- **Prisma**: New `Content`, `ScormPackage` models; `StorageUsage` counter on `TenantConfig`
- **Backend**: `ContentModule`; `FileStorageService` (S3/MinIO client); `ScormProcessorJob`
- **REST**: Pre-signed URL endpoint; SCORM upload endpoint

### Prisma Schema
```prisma
model Content {
  id          String      @id @default(uuid())
  tenantId    String
  lessonId    String?     @unique
  type        ContentType
  storageKey  String      // S3 object key
  fileName    String
  mimeType    String
  sizeBytes   Int
  duration    Int?        // seconds (video only)
  status      ContentStatus @default(PROCESSING)
  scormPackage ScormPackage?
  lesson      Lesson?     @relation(fields: [lessonId], references: [id])
  tenant      Tenant      @relation(fields: [tenantId], references: [id])
}

model ScormPackage {
  id             String  @id @default(uuid())
  contentId      String  @unique
  manifestPath   String  // path to imsmanifest.xml
  launchUrl      String  // relative URL to launch SCO
  scormVersion   String  // "1.2" | "2004"
  extractedPath  String  // folder in S3 where package is extracted
  content        Content @relation(fields: [contentId], references: [id])
}

enum ContentType   { VIDEO DOCUMENT SCORM }
enum ContentStatus { PROCESSING READY FAILED ARCHIVED }
```

### Upload Flow (Video)
```
1. Client → POST /content/upload-url { lessonId, mimeType, sizeBytes }
   → Backend validates quota, creates Content(PROCESSING), returns { uploadUrl, contentId }
2. Client → PUT {uploadUrl} (direct to S3, bypasses backend)
3. S3 event / webhook → Backend marks Content(READY), extracts video duration
```

### SCORM Flow
```
1. Client → POST /content/scorm/upload (multipart ZIP)
   → Backend saves ZIP to S3, creates Content + ScormPackage(PROCESSING)
   → Enqueues ScormProcessorJob
2. ScormProcessorJob: extracts ZIP, parses imsmanifest.xml, uploads folder to S3
   → Updates ScormPackage.launchUrl, marks Content(READY)
```

## Implementation Plan

### Step 1: FileStorageService
- MinIO client (aws-sdk v3 compatible)
- Methods: `generateUploadUrl`, `generateDownloadUrl`, `deleteObject`, `extractZipToPrefix`

### Step 2: Pre-signed Upload API
- `POST /content/upload-url` — validates quota, creates `Content` record, returns pre-signed URL
- `POST /content/:id/confirm` — called after client upload completes; kicks off processing

### Step 3: SCORM Upload & Processor
- `POST /content/scorm/upload` — uploads ZIP, creates records, enqueues job
- `ScormProcessorJob`: unzip, parse manifest, upload, update record

### Step 4: Quota Tracking
- Before each upload: check `TenantConfig.storageUsedBytes + sizeBytes <= storageQuotaBytes`
- On upload confirm: increment `TenantConfig.storageUsedBytes`
- On content archive: decrement counter

### Step 5: Playback
- `GET /content/:id/url` — returns signed download URL (1-hour expiry) for documents
- Video: signed URL returned; range-request support handled by S3/MinIO natively

## Testing Strategy

### Unit Tests
- [ ] Quota check rejects upload when `used + size > quota`
- [ ] SCORM manifest parser extracts correct `launchUrl` for 1.2 and 2004 formats

### Integration Tests
- [ ] Upload flow: generate URL → confirm → content status becomes READY
- [ ] SCORM processor job extracts ZIP and updates package with launch URL

## Dependencies

### Blocked By
- STORY-E05-01 (Lesson entity — content is attached to lessons)
- STORY-E02-04 (storage quota in `TenantConfig`)

### Blocks
- STORY-E05-03 (students can view lesson content after enrollment)
- STORY-E05-06 (file storage system uses same `FileStorageService`)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large video upload timeout | Medium | Pre-signed URL bypass keeps upload client-to-S3; no backend timeout risk |
| SCORM ZIP with path traversal attack | High | Validate all extracted paths against a base prefix before writing |
| S3 bucket missing in dev | Low | Docker Compose includes MinIO; bucket auto-created on startup |
