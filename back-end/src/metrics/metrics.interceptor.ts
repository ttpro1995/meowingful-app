import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Counter, Histogram } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Request, Response } from 'express';

interface RouteWithPath {
  path: string;
}

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly httpRequestCounter: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    private readonly httpRequestDuration: Histogram<string>,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    let request: Request | undefined;
    let response: Response | undefined;

    if (context.getType<'http' | 'graphql'>() === 'http') {
      const ctx = context.switchToHttp();
      request = ctx.getRequest<Request>();
      response = ctx.getResponse<Response>();
    } else if (context.getType<'http' | 'graphql'>() === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context).getContext<{
        req?: Request;
        res?: Response;
      }>();
      request = gqlContext.req;
      response = gqlContext.res;
    }

    const start = Date.now();

    const method = request?.method ?? 'GRAPHQL';
    const route = request?.route as RouteWithPath | undefined;
    const path: string = route?.path ?? request?.url ?? 'unknown';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = (Date.now() - start) / 1000;
          const statusCode = response?.statusCode || 200;

          this.httpRequestCounter.inc({ method, path, status: statusCode });
          this.httpRequestDuration.observe(
            { method, path, status: statusCode },
            duration,
          );
        },
        error: () => {
          const duration = (Date.now() - start) / 1000;
          const statusCode = 500;

          this.httpRequestCounter.inc({ method, path, status: statusCode });
          this.httpRequestDuration.observe(
            { method, path, status: statusCode },
            duration,
          );
        },
      }),
    );
  }
}
