-- Restore unique index on Auth(tenantId, username) which was dropped in 20260524120433_rbac_init

CREATE UNIQUE INDEX IF NOT EXISTS "Auth_tenantId_username_key" ON "Auth"("tenantId", "username");
