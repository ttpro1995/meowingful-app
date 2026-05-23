import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Counter, Histogram } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Request } from 'express';

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
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<import('express').Response>();
    const start = Date.now();

    const method = request.method;
    const route = request.route as RouteWithPath | undefined;
    const path: string = route?.path ?? request.url ?? 'unknown';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = (Date.now() - start) / 1000;
          const statusCode = response.statusCode || 200;

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
