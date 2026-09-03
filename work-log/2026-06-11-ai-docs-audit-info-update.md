# Work Log: AI Docs Update for Audit Implementation

## Date
2026-06-11

## Summary
Updated AI-facing and project-facing documentation to include the new STORY-E02-06 audit logging implementation details.

## Changes Made

### Updated AGENTS instructions
- File: `AGENTS.md`
- Added BullMQ to backend architecture stack.
- Added a dedicated "Audit Logging (STORY-E02-06)" section with:
  - audit module location and file pattern
  - `@Auditable` and `@AuditAction` usage guidance
  - global `AuditInterceptor` behavior
  - BullMQ queue name (`audit-log`) and worker persistence flow
  - login audit emission in `AuthService.login`
  - admin-only `auditLogs(query)` behavior
  - diff sanitization notes for sensitive fields
  - migration reference (`20260611093000_story_e02_06_audit_logging`)
- Added troubleshooting note for P2021 (`AuditLog` table missing) with migration commands.

### Updated README
- File: `README.md`
- Added BullMQ to backend tech stack.
- Added "Audit Logging" feature section.
- Added GraphQL `auditLogs` query example.
- Added `AuditLog` table description in database schema section.

## Notes
- This update is documentation-only and does not change runtime behavior.
