import { Request } from 'express';
import { ResolvedTenantContext } from './tenant-context.storage';

export interface RequestWithTenantContext extends Request {
  tenantContext?: ResolvedTenantContext | null;
}
