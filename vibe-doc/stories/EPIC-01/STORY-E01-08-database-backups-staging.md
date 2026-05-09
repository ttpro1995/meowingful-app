# Story: Database Backups & Staging Environment

## Metadata
- **Story ID**: STORY-E01-08
- **Epic**: EPIC-01 — Foundation & Infrastructure Enhancement
- **Priority**: Medium
- **Status**: Todo
- **Created**: 2026-05-09
- **Related**: vibe-doc/epic-plan.md, vibe-doc/stories/EPIC-01/STORY-E01-01-ci-cd-enhancement.md

## User Story
As a platform operator, I want automated daily database backups and a staging environment that mirrors production so that we can recover from data loss and validate releases safely before they reach users.

## Context
The current setup has a single PostgreSQL container with no backup strategy and no staging environment. As the platform starts holding real user and CRM data, data loss would be catastrophic. A staging environment is also the deploy target for STORY-E01-01's CD pipeline.

## Requirements

### Functional Requirements
- [ ] Automated daily PostgreSQL backup runs via cron (pg_dump compressed to .gz)
- [ ] Backups are uploaded to a remote object store (MinIO self-hosted or AWS S3)
- [ ] Backups are retained for 30 days; older backups are automatically deleted
- [ ] A restore procedure is documented and tested manually at least once
- [ ] Staging environment: Docker Compose stack running on a separate server/VM
- [ ] Staging has its own database, Redis, and environment config (no shared state with production)
- [ ] Staging URL is accessible internally (behind basic auth or VPN)

### Non-Functional Requirements
- [ ] Backup job alerts (log + optional email) if the backup fails
- [ ] Backup files are encrypted before upload (gpg symmetric encryption)
- [ ] Staging environment variables clearly marked with `STAGING_` prefix or separate `.env.staging`

## Acceptance Criteria
- [ ] Cron job runs daily at 02:00 UTC and uploads a compressed, encrypted dump to object storage
- [ ] Backup file naming: `meowingful_<YYYY-MM-DD_HH-MM>.sql.gz.gpg`
- [ ] Restoring a backup to a clean DB produces working application state (manually verified)
- [ ] Staging environment reachable at a defined internal URL and running the latest master build
- [ ] Listing backup objects in the bucket shows files no older than 30 days

## Technical Specifications

### Backup Architecture
```
Cron (daily 02:00 UTC)
  └── backup.sh
        ├── pg_dump → meowingful_<date>.sql.gz
        ├── gpg --symmetric → .sql.gz.gpg
        ├── Upload to MinIO/S3
        └── Delete files older than 30 days from bucket
```

### backup.sh Skeleton
```bash
#!/bin/bash
set -euo pipefail

DATE=$(date +%Y-%m-%d_%H-%M)
FILE="meowingful_${DATE}.sql.gz"
ENCRYPTED="${FILE}.gpg"

pg_dump "$DATABASE_URL" | gzip > "/tmp/${FILE}"
gpg --batch --yes --passphrase "$BACKUP_GPG_PASSPHRASE" \
    --symmetric --cipher-algo AES256 \
    -o "/tmp/${ENCRYPTED}" "/tmp/${FILE}"

# Upload (using aws CLI or mc for MinIO)
aws s3 cp "/tmp/${ENCRYPTED}" "s3://${BACKUP_BUCKET}/${ENCRYPTED}"

# Prune older than 30 days
aws s3 ls "s3://${BACKUP_BUCKET}/" | while read -r line; do
  ...
done

rm -f "/tmp/${FILE}" "/tmp/${ENCRYPTED}"
echo "Backup completed: ${ENCRYPTED}"
```

### Docker Compose: Backup Sidecar
```yaml
backup:
  image: postgres:16-alpine
  profiles: ["backup"]
  environment:
    DATABASE_URL: ${DATABASE_URL}
    BACKUP_BUCKET: ${BACKUP_BUCKET}
    BACKUP_GPG_PASSPHRASE: ${BACKUP_GPG_PASSPHRASE}
  volumes:
    - ./scripts/backup.sh:/backup.sh
  entrypoint: crond -f -l 2
```

### Staging Environment
- Separate server or VM (e.g., a cheap VPS or second Docker host)
- `docker-compose.staging.yml` or override file with staging-specific config
- Database pre-populated from a sanitized snapshot of production (PII removed)
- Basic auth on Nginx reverse proxy for staging frontend

### Environment Variables (new)
```
BACKUP_BUCKET=meowingful-backups
BACKUP_GPG_PASSPHRASE=<strong passphrase, in secrets manager>
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_ENDPOINT_URL=http://minio:9000  # or real S3
```

## Implementation Plan

### Step 1: MinIO Setup (local/staging object store)
- Add MinIO container to `docker-compose.yml` under `profiles: ["storage"]`
- Create bucket `meowingful-backups` via MinIO init script

### Step 2: Backup Script
- Write `scripts/backup.sh` with pg_dump, gpg encrypt, upload, and prune steps
- Add Docker Compose `backup` profile service using `crond`
- Test manually: run script and confirm encrypted file in MinIO bucket

### Step 3: Restore Procedure Document
- Write `docs/restore-procedure.md` with step-by-step:
  1. Download and decrypt backup
  2. Drop and recreate DB
  3. `psql < dump.sql`
  4. Run `prisma migrate deploy`
- Test the procedure end-to-end once

### Step 4: Staging Environment
- Provision staging server
- Create `.env.staging` (no production credentials)
- Configure Nginx with basic auth for staging frontend
- Wire up to CD pipeline from STORY-E01-01

## Testing Strategy

### Manual Tests
- [ ] Run backup script → verify file in MinIO
- [ ] Run restore procedure from backup → verify app works
- [ ] Verify 30-day prune: manually insert old object name, run prune logic, confirm deleted

## Dependencies

### Blocked By
- STORY-E01-01 (staging is the CD deployment target)

### Blocks
- All other stories benefit from having a staging environment

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Backup passphrase lost | Critical | Store passphrase in password manager and a secondary secure location |
| Backup silent failure (disk full, network error) | High | `set -euo pipefail` + alert on non-zero exit |
| Staging has production data accidentally | Medium | Use sanitized snapshot script; never copy prod `.env` to staging |
