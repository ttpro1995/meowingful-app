import {
  Inject,
  Injectable,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import type { RequestWithTenantContext } from './tenant.request';

@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  readonly tenantId?: string;
  readonly userId?: string;
  readonly role?: UserRole;
  readonly isSuperAdmin: boolean;

  constructor(@Inject(REQUEST) req: RequestWithTenantContext) {
    this.tenantId = req.tenantContext?.tenantId;
    this.userId = req.tenantContext?.userId;
    this.role = req.tenantContext?.role;
    this.isSuperAdmin = req.tenantContext?.isSuperAdmin ?? false;
  }

  assertAuthenticated(): void {
    if (!this.tenantId || !this.userId) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }
  }
}
