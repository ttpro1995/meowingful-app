-- TenantManagementAndIsolation

-- Create user role enum for JWT role claims and authorization checks.
CREATE TYPE "UserRole" AS ENUM ('USER', 'TENANT_ADMIN', 'SUPER_ADMIN');

-- Create tenant table.
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "planTier" TEXT NOT NULL DEFAULT 'basic',
    "contactEmail" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- Seed the default tenant used to backfill current users.
INSERT INTO "Tenant" ("id", "name", "slug", "planTier", "contactEmail", "isActive", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Tenant',
  'default',
  'basic',
  'admin@default.local',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

-- Add tenant identity to users and credentials.
ALTER TABLE "User" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';
ALTER TABLE "Auth" ADD COLUMN "tenantId" TEXT;

UPDATE "User"
SET "tenantId" = (SELECT "id" FROM "Tenant" WHERE "slug" = 'default' LIMIT 1)
WHERE "tenantId" IS NULL;

UPDATE "Auth" AS a
SET "tenantId" = u."tenantId"
FROM "User" AS u
WHERE a."userId" = u."id" AND a."tenantId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Auth" ALTER COLUMN "tenantId" SET NOT NULL;

DROP INDEX "User_username_key";
DROP INDEX "Auth_username_key";

CREATE UNIQUE INDEX "User_tenantId_username_key" ON "User"("tenantId", "username");
CREATE UNIQUE INDEX "Auth_tenantId_username_key" ON "Auth"("tenantId", "username");
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX "Auth_tenantId_idx" ON "Auth"("tenantId");

ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Auth" ADD CONSTRAINT "Auth_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
