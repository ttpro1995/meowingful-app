import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { TenantGuard } from './tenant.guard';

describe('TenantGuard', () => {
  let guard: TenantGuard;

  beforeEach(() => {
    guard = new TenantGuard();
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

  it('allows public register mutation without token', () => {
    const context = mockGraphqlContext({
      parentTypeName: 'Mutation',
      fieldName: 'register',
    });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('rejects protected query when token is missing', () => {
    const context = mockGraphqlContext({
      parentTypeName: 'Query',
      fieldName: 'users',
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('resolves tenant context from valid access token', () => {
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

    const result = guard.canActivate(context);

    expect(result).toBe(true);

    const gql = GqlExecutionContext.create(context);
    const req = gql.getContext<{ req: { tenantContext: { tenantId: string } } }>()
      .req;

    expect(req.tenantContext.tenantId).toBe('tenant-1');
    expect(req.tenantContext.isSuperAdmin).toBe(true);
  });
});
