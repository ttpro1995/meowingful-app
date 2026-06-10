-- STORY-E02-06: Audit logging

CREATE TYPE "AuditAction" AS ENUM (
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'PERMISSION_GRANTED',
  'PERMISSION_REVOKED'
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "actorId" TEXT,
  "actorEmail" TEXT,
  "action" "AuditAction" NOT NULL,
  "resource" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "diff" JSONB,
  "ipAddress" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_tenantId_resource_createdAt_idx"
ON "AuditLog"("tenantId", "resource", "createdAt");

CREATE INDEX "AuditLog_tenantId_actorId_createdAt_idx"
ON "AuditLog"("tenantId", "actorId", "createdAt");

CREATE INDEX "AuditLog_tenantId_archivedAt_createdAt_idx"
ON "AuditLog"("tenantId", "archivedAt", "createdAt");

ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
