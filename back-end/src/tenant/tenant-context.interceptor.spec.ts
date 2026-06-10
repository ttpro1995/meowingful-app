import { CallHandler, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { lastValueFrom, of } from 'rxjs';
import { runWithTenantContext } from './tenant-context.storage';
import { TenantContextInterceptor } from './tenant-context.interceptor';

jest.mock('./tenant-context.storage', () => ({
  runWithTenantContext: jest.fn((context, callback: () => unknown) => {
    void context;
    return callback();
  }),
}));

describe('TenantContextInterceptor', () => {
  const interceptor = new TenantContextInterceptor();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes through for non-graphql context', async () => {
    const nextResult = of('ok-http');
    const handleMock = jest.fn(() => nextResult);
    const next: CallHandler = {
      handle: handleMock,
    };

    const context = {
      getType: () => 'http',
    } as unknown as ExecutionContext;

    const result = interceptor.intercept(context, next);

    expect(result).toBe(nextResult);
    expect(handleMock).toHaveBeenCalledTimes(1);
    expect(runWithTenantContext).not.toHaveBeenCalled();

    await expect(lastValueFrom(result)).resolves.toBe('ok-http');
  });

  it('runs graphql requests inside tenant context storage scope', async () => {
    const next: CallHandler = {
      handle: jest.fn(() => of('ok-graphql')),
    };

    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({
        req: {
          tenantContext: {
            tenantId: 'tenant-1',
            userId: 'user-1',
            role: 'USER',
            isSuperAdmin: false,
          },
        },
      }),
    } as unknown as GqlExecutionContext);

    const context = {
      getType: () => 'graphql',
    } as unknown as ExecutionContext;

    const result = interceptor.intercept(context, next);

    expect(runWithTenantContext).toHaveBeenCalledWith(
      {
        tenantId: 'tenant-1',
        userId: 'user-1',
        role: 'USER',
        isSuperAdmin: false,
      },
      expect.any(Function),
    );

    await expect(lastValueFrom(result)).resolves.toBe('ok-graphql');
  });
});
