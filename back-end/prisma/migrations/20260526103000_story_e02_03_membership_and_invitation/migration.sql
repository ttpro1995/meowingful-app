-- STORY-E02-03: User-Tenant Membership and Invitations

-- Create invitation table for tenant onboarding.
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_tenantId_email_idx" ON "Invitation"("tenantId", "email");
CREATE INDEX "Invitation_expiresAt_idx" ON "Invitation"("expiresAt");

ALTER TABLE "Invitation"
ADD CONSTRAINT "Invitation_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invitation"
ADD CONSTRAINT "Invitation_roleId_fkey"
FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ensure each tenant has predefined roles so membership backfill is possible.
INSERT INTO "Role" ("id", "tenantId", "name")
SELECT
    CONCAT(t."id", '-', LOWER(v.role_name::text)) AS "id",
    t."id" AS "tenantId",
    v.role_name AS "name"
FROM "Tenant" t
CROSS JOIN (
    VALUES
      ('SUPER_ADMIN'::"RoleName"),
      ('TENANT_ADMIN'::"RoleName"),
      ('DEVELOPER'::"RoleName"),
      ('DIRECTOR'::"RoleName"),
      ('SALES_MANAGER'::"RoleName"),
      ('STAFF'::"RoleName"),
      ('ACCOUNTANT'::"RoleName"),
      ('HR'::"RoleName"),
      ('INSTRUCTOR'::"RoleName"),
      ('STUDENT'::"RoleName")
) AS v(role_name)
ON CONFLICT ("tenantId", "name") DO NOTHING;

-- Rebuild membership join table to support multiple roles per user per tenant.
DROP TABLE IF EXISTS "UserTenantRole";

CREATE TABLE "UserTenantRole" (
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTenantRole_pkey" PRIMARY KEY ("userId", "tenantId", "roleId")
);

CREATE INDEX "UserTenantRole_tenantId_userId_idx" ON "UserTenantRole"("tenantId", "userId");
CREATE INDEX "UserTenantRole_tenantId_roleId_idx" ON "UserTenantRole"("tenantId", "roleId");

ALTER TABLE "UserTenantRole"
ADD CONSTRAINT "UserTenantRole_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTenantRole"
ADD CONSTRAINT "UserTenantRole_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTenantRole"
ADD CONSTRAINT "UserTenantRole_roleId_fkey"
FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill tenant memberships from legacy User.tenantId/User.role data.
INSERT INTO "UserTenantRole" ("userId", "tenantId", "roleId")
SELECT
    u."id" AS "userId",
    u."tenantId" AS "tenantId",
    r."id" AS "roleId"
FROM "User" u
JOIN "Role" r
  ON r."tenantId" = u."tenantId"
 AND r."name" = CASE
    WHEN u."role" = 'SUPER_ADMIN' THEN 'SUPER_ADMIN'::"RoleName"
    WHEN u."role" = 'TENANT_ADMIN' THEN 'TENANT_ADMIN'::"RoleName"
    ELSE 'DEVELOPER'::"RoleName"
 END
ON CONFLICT DO NOTHING;
