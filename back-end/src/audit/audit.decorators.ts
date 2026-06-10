import { SetMetadata } from '@nestjs/common';
import {
  AUDITABLE_RESOURCE_KEY,
  AUDIT_ACTION_RESOLVER_KEY,
} from './audit.constants';
import { AuditActionResolver } from './audit.types';

export const Auditable = (resource: string) =>
  SetMetadata(AUDITABLE_RESOURCE_KEY, resource);

export const AuditAction = (resolver: AuditActionResolver) =>
  SetMetadata(AUDIT_ACTION_RESOLVER_KEY, resolver);
