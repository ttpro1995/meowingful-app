import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, tap } from 'rxjs';
import { AuditAction } from '@prisma/client';
import { AuditService } from './audit.service';
import {
  AUDITABLE_RESOURCE_KEY,
  AUDIT_ACTION_RESOLVER_KEY,
} from './audit.constants';
import { AuditActionResolver } from './audit.types';
import { getClientIpAddress } from './audit.helpers';
import { RequestWithTenantContext } from '../tenant/tenant.request';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<'graphql' | 'http'>() !== 'graphql') {
      return next.handle();
    }

    const resource = this.reflector.getAllAndOverride<string>(
      AUDITABLE_RESOURCE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!resource) {
      return next.handle();
    }

    const actionResolver = this.reflector.getAllAndOverride<AuditActionResolver>(
      AUDIT_ACTION_RESOLVER_KEY,
      [context.getHandler(), context.getClass()],
    );

    const gqlContext = GqlExecutionContext.create(context);
    const request = gqlContext.getContext<{ req?: RequestWithTenantContext }>()?.req;
    const args = gqlContext.getArgs<Record<string, unknown>>();

    const tenantId = request?.tenantContext?.tenantId;
    const actorId = request?.tenantContext?.userId;
    const actorEmail = typeof args?.input === 'object' && args?.input
      ? (args.input as { email?: string; username?: string }).email ??
        (args.input as { email?: string; username?: string }).username
      : undefined;
    const ipAddress = getClientIpAddress(request);

    return next.handle().pipe(
      tap((result: unknown) => {
        if (!tenantId) {
          return;
        }

        const resolved = actionResolver
          ? actionResolver({
              args,
              result,
              requestResourceId: this.extractRequestResourceId(args),
            })
          : {
              action: AuditAction.UPDATE,
              resourceId: this.extractResourceId(args, result),
              diff: undefined,
            };

        void this.auditService.log({
          tenantId,
          actorId,
          actorEmail,
          action: resolved.action,
          resource,
          resourceId: resolved.resourceId,
          diff: resolved.diff ?? null,
          ipAddress,
        });
      }),
    );
  }

  private extractRequestResourceId(args: Record<string, unknown>): string | undefined {
    const idCandidates = [args?.userId, args?.tenantId, args?.id];
    for (const candidate of idCandidates) {
      if (typeof candidate === 'string' && candidate) {
        return candidate;
      }
    }

    return undefined;
  }

  private extractResourceId(args: Record<string, unknown>, result: unknown): string {
    const requestId = this.extractRequestResourceId(args);
    if (requestId) {
      return requestId;
    }

    if (
      typeof result === 'object' &&
      result !== null &&
      'id' in result &&
      typeof (result as { id: unknown }).id === 'string'
    ) {
      return (result as { id: string }).id;
    }

    return 'unknown';
  }
}
