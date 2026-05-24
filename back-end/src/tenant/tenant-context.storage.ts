import { AsyncLocalStorage } from 'node:async_hooks';
import { UserRole } from '@prisma/client';

export interface ResolvedTenantContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  isSuperAdmin: boolean;
}

const tenantContextStorage = new AsyncLocalStorage<ResolvedTenantContext | null>();

export function runWithTenantContext<T>(
  context: ResolvedTenantContext | null,
  callback: () => T,
): T {
  return tenantContextStorage.run(context, callback);
}

export function getTenantContext(): ResolvedTenantContext | null {
  return tenantContextStorage.getStore() ?? null;
}
