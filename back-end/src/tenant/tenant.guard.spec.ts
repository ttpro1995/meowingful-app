import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { TenantGuard } from './tenant.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('TenantGuard', () => {
  let guard: TenantGuard;
  const mockPrismaService = {
    userTenantRole: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(() => {
    guard = new TenantGuard(mockPrismaService as unknown as PrismaService);
    mockPrismaService.userTenantRole.findFirst.mockResolvedValue({
      userId: 'user-1',
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockGraphqlContext(params: {
    fieldName: string;
    parentTypeName: string;
    authorization?: string;
  }): ExecutionContext {
    const req = {
      headers: {
        authorization: params.authorization,
      },
    };

    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({ req }),
      getInfo: () => ({
        fieldName: params.fieldName,
        parentType: { name: params.parentTypeName },
      }),
    } as never);

    return {
      getType: () => 'graphql',
    } as ExecutionContext;
  }

  it('allows public register mutation without token', async () => {
    const context = mockGraphqlContext({
      parentTypeName: 'Mutation',
      fieldName: 'register',
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('rejects protected query when token is missing', async () => {
    const context = mockGraphqlContext({
      parentTypeName: 'Query',
      fieldName: 'users',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('resolves tenant context from valid access token', async () => {
    const accessToken = jwt.sign(
      {
        sub: 'user-1',
        tenantId: 'tenant-1',
        role: UserRole.SUPER_ADMIN,
      },
      'dev-secret-key-change-in-production',
      { expiresIn: 900 },
    );

    const context = mockGraphqlContext({
      parentTypeName: 'Query',
      fieldName: 'users',
      authorization: `Bearer ${accessToken}`,
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);

    const gql = GqlExecutionContext.create(context);
    const req = gql.getContext<{
      req: { tenantContext: { tenantId: string } };
    }>().req;

    expect(req.tenantContext.tenantId).toBe('tenant-1');
    expect(req.tenantContext.isSuperAdmin).toBe(true);
  });

  it('rejects when user is no longer a member of the token tenant', async () => {
    mockPrismaService.userTenantRole.findFirst.mockResolvedValueOnce(null);

    const accessToken = jwt.sign(
      {
        sub: 'user-1',
        tenantId: 'tenant-1',
        role: UserRole.USER,
      },
      'dev-secret-key-change-in-production',
      { expiresIn: 900 },
    );

    const context = mockGraphqlContext({
      parentTypeName: 'Query',
      fieldName: 'users',
      authorization: `Bearer ${accessToken}`,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
