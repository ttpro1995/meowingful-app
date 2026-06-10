import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuditAction } from '@prisma/client';
import { lastValueFrom, of } from 'rxjs';
import { AUDITABLE_RESOURCE_KEY, AUDIT_ACTION_RESOLVER_KEY } from './audit.constants';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

describe('AuditInterceptor', () => {
  const log = jest.fn();
  const auditService = { log } as unknown as AuditService;
  const getAllAndOverride = jest.fn();
  const reflector = { getAllAndOverride } as unknown as Reflector;

  const interceptor = new AuditInterceptor(reflector, auditService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('captures diff and emits audit job', async () => {
    const actionResolver = jest.fn(() => ({
      action: AuditAction.UPDATE,
      resourceId: 'lead-1',
      diff: {
        before: { status: 'NEW' },
        after: { status: 'CONTACTED' },
      },
    }));

    getAllAndOverride.mockImplementation((key: string) => {
      if (key === AUDITABLE_RESOURCE_KEY) {
        return 'Lead';
      }

      if (key === AUDIT_ACTION_RESOLVER_KEY) {
        return actionResolver;
      }

      return undefined;
    });

    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({
        req: {
          tenantContext: {
            tenantId: 'tenant-1',
            userId: 'user-1',
          },
          headers: {},
          ip: '127.0.0.1',
        },
      }),
      getArgs: () => ({
        id: 'lead-1',
        input: {
          status: 'CONTACTED',
        },
      }),
    } as unknown as GqlExecutionContext);

    const context = {
      getType: () => 'graphql',
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    const next: CallHandler = {
      handle: jest.fn(() => of({ id: 'lead-1', status: 'CONTACTED' })),
    };

    await lastValueFrom(interceptor.intercept(context, next));

    expect(actionResolver).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      actorId: 'user-1',
      actorEmail: undefined,
      action: AuditAction.UPDATE,
      resource: 'Lead',
      resourceId: 'lead-1',
      diff: {
        before: { status: 'NEW' },
        after: { status: 'CONTACTED' },
      },
      ipAddress: '127.0.0.1',
    });
  });
});
