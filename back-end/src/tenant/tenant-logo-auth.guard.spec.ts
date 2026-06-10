import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { TenantLogoAuthGuard } from './tenant-logo-auth.guard';
import { TenantConfigService } from './tenant-config.service';
import { RequestWithTenantContext } from './tenant.request';

describe('TenantLogoAuthGuard', () => {
  const findMembership = jest.fn();
  const assertCanManageTenant = jest.fn();

  const prisma = {
    userTenantRole: {
      findFirst: findMembership,
    },
  } as unknown as PrismaService;

  const tenantConfigService = {
    assertCanManageTenant,
  } as unknown as TenantConfigService;

  const createHttpContext = (req: RequestWithTenantContext): ExecutionContext =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    }) as unknown as ExecutionContext;

  let guard: TenantLogoAuthGuard;

  beforeEach(() => {
    jest.restoreAllMocks();
    findMembership.mockReset();
    assertCanManageTenant.mockReset();
    guard = new TenantLogoAuthGuard(prisma, tenantConfigService);
  });

  it('allows non-http context without authentication checks', async () => {
    const context = {
      getType: () => 'graphql',
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findMembership).not.toHaveBeenCalled();
    expect(assertCanManageTenant).not.toHaveBeenCalled();
  });

  it('rejects when authorization header is missing', async () => {
    const req = {
      headers: {},
    } as RequestWithTenantContext;

    await expect(guard.canActivate(createHttpContext(req))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when bearer token format is invalid', async () => {
    const req = {
      headers: {
        authorization: 'Token abc',
      },
    } as RequestWithTenantContext;

    await expect(guard.canActivate(createHttpContext(req))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when jwt verification fails', async () => {
    jest.spyOn(jwt, 'verify').mockImplementationOnce(() => {
      throw new Error('invalid-token');
    });

    const req = {
      headers: {
        authorization: 'Bearer bad-token',
      },
    } as RequestWithTenantContext;

    await expect(guard.canActivate(createHttpContext(req))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when decoded token is a string', async () => {
    jest.spyOn(jwt, 'verify').mockReturnValueOnce('token-string');

    const req = {
      headers: {
        authorization: 'Bearer token',
      },
    } as RequestWithTenantContext;

    await expect(guard.canActivate(createHttpContext(req))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when required token fields are missing', async () => {
    jest.spyOn(jwt, 'verify').mockReturnValueOnce({
      sub: 'user-1',
    });

    const req = {
      headers: {
        authorization: 'Bearer token',
      },
    } as RequestWithTenantContext;

    await expect(guard.canActivate(createHttpContext(req))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when user is not a member of the tenant', async () => {
    jest.spyOn(jwt, 'verify').mockReturnValueOnce({
      sub: 'user-1',
      tenantId: 'tenant-1',
    });
    findMembership.mockResolvedValueOnce(null);

    const req = {
      headers: {
        authorization: 'Bearer token',
      },
    } as RequestWithTenantContext;

    await expect(guard.canActivate(createHttpContext(req))).rejects.toThrow(
      UnauthorizedException,
    );

    expect(findMembership).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        tenantId: 'tenant-1',
      },
      select: {
        userId: true,
      },
    });
  });

  it('sets tenant context with default USER role when role is missing in token', async () => {
    jest.spyOn(jwt, 'verify').mockReturnValueOnce({
      sub: 'user-1',
      tenantId: 'tenant-1',
    });
    findMembership.mockResolvedValueOnce({ userId: 'user-1' });
    assertCanManageTenant.mockResolvedValueOnce(undefined);

    const req = {
      headers: {
        authorization: 'Bearer token',
      },
    } as RequestWithTenantContext;

    await expect(guard.canActivate(createHttpContext(req))).resolves.toBe(true);

    expect(assertCanManageTenant).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      userId: 'user-1',
      role: UserRole.USER,
      isSuperAdmin: false,
    });
    expect(req.tenantContext).toEqual({
      tenantId: 'tenant-1',
      userId: 'user-1',
      role: UserRole.USER,
      isSuperAdmin: false,
    });
  });

  it('sets isSuperAdmin=true for SUPER_ADMIN role', async () => {
    jest.spyOn(jwt, 'verify').mockReturnValueOnce({
      sub: 'super-1',
      tenantId: 'tenant-1',
      role: UserRole.SUPER_ADMIN,
    });
    findMembership.mockResolvedValueOnce({ userId: 'super-1' });
    assertCanManageTenant.mockResolvedValueOnce(undefined);

    const req = {
      headers: {
        authorization: 'Bearer token',
      },
    } as RequestWithTenantContext;

    await expect(guard.canActivate(createHttpContext(req))).resolves.toBe(true);

    expect(assertCanManageTenant).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      userId: 'super-1',
      role: UserRole.SUPER_ADMIN,
      isSuperAdmin: true,
    });
    expect(req.tenantContext).toEqual({
      tenantId: 'tenant-1',
      userId: 'super-1',
      role: UserRole.SUPER_ADMIN,
      isSuperAdmin: true,
    });
  });
});
