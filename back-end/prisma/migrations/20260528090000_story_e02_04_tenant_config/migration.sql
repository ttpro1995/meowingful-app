-- STORY-E02-04: Tenant configuration, branding, and feature flags

CREATE TABLE "TenantConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#3B82F6',
    "subdomain" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "businessHours" JSONB,
    "features" JSONB NOT NULL DEFAULT '{"crm":false,"elearning":false,"call_center":false,"live_classes":false,"marketplace":false}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantConfig_tenantId_key" ON "TenantConfig"("tenantId");
CREATE UNIQUE INDEX "TenantConfig_subdomain_key" ON "TenantConfig"("subdomain");

ALTER TABLE "TenantConfig"
ADD CONSTRAINT "TenantConfig_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill a config row for already existing tenants.
INSERT INTO "TenantConfig" ("id", "tenantId")
SELECT CONCAT(t."id", '-config'), t."id"
FROM "Tenant" t
ON CONFLICT ("tenantId") DO NOTHING;
