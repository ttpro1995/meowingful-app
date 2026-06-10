import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { TenantContext } from './tenant.context';
import { RequestWithTenantContext } from './tenant.request';

describe('TenantContext', () => {
  it('maps tenant context from request and allows authenticated context', () => {
    const request = {
      tenantContext: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        role: UserRole.TENANT_ADMIN,
        isSuperAdmin: false,
      },
    } as RequestWithTenantContext;

    const context = new TenantContext(request);

    expect(context.tenantId).toBe('tenant-1');
    expect(context.userId).toBe('user-1');
    expect(context.role).toBe(UserRole.TENANT_ADMIN);
    expect(context.isSuperAdmin).toBe(false);
    expect(() => context.assertAuthenticated()).not.toThrow();
  });

  it('throws UnauthorizedException when tenant or user is missing', () => {
    const request = {
      tenantContext: {
        tenantId: 'tenant-1',
        userId: undefined,
        role: UserRole.USER,
        isSuperAdmin: false,
      },
    } as RequestWithTenantContext;

    const context = new TenantContext(request);

    expect(() => context.assertAuthenticated()).toThrow(UnauthorizedException);
  });
});
