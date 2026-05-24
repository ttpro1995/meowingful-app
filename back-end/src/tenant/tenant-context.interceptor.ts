import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { runWithTenantContext } from './tenant-context.storage';
import { RequestWithTenantContext } from './tenant.request';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (context.getType<'graphql' | 'http'>() !== 'graphql') {
      return next.handle();
    }

    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext<{ req?: RequestWithTenantContext }>();

    return runWithTenantContext(ctx.req?.tenantContext ?? null, () => {
      return next.handle();
    });
  }
}
