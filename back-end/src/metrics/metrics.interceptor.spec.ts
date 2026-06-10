import { CallHandler, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request, Response } from 'express';
import { Counter, Histogram } from 'prom-client';
import { lastValueFrom, of, throwError } from 'rxjs';
import { MetricsInterceptor } from './metrics.interceptor';

describe('MetricsInterceptor', () => {
  const counterInc = jest.fn();
  const durationObserve = jest.fn();

  const counter = {
    inc: counterInc,
  } as unknown as Counter<string>;

  const histogram = {
    observe: durationObserve,
  } as unknown as Histogram<string>;

  const createHttpContext = (
    req: Partial<Request>,
    res: Partial<Response>,
  ): ExecutionContext =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records success metrics for HTTP requests', async () => {
    const interceptor = new MetricsInterceptor(counter, histogram);
    const context = createHttpContext(
      {
        method: 'GET',
        route: { path: '/health' },
      },
      { statusCode: 201 },
    );

    const next: CallHandler<unknown> = {
      handle: () => of('ok'),
    };

    await lastValueFrom(interceptor.intercept(context, next));

    expect(counterInc).toHaveBeenCalledWith({
      method: 'GET',
      path: '/health',
      status: 201,
    });
    expect(durationObserve).toHaveBeenCalledWith(
      {
        method: 'GET',
        path: '/health',
        status: 201,
      },
      expect.any(Number),
    );
  });

  it('records error metrics for HTTP failures', async () => {
    const interceptor = new MetricsInterceptor(counter, histogram);
    const context = createHttpContext(
      {
        method: 'POST',
        url: '/graphql',
      },
      { statusCode: 400 },
    );

    const next: CallHandler<unknown> = {
      handle: () => throwError(() => new Error('boom')),
    };

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).rejects.toThrow('boom');

    expect(counterInc).toHaveBeenCalledWith({
      method: 'POST',
      path: '/graphql',
      status: 500,
    });
    expect(durationObserve).toHaveBeenCalledWith(
      {
        method: 'POST',
        path: '/graphql',
        status: 500,
      },
      expect.any(Number),
    );
  });

  it('uses GRAPHQL and unknown defaults when graphql context has no req/res', async () => {
    const interceptor = new MetricsInterceptor(counter, histogram);
    const gqlCreateSpy = jest
      .spyOn(GqlExecutionContext, 'create')
      .mockReturnValue({
        getContext: () => ({}),
      } as unknown as GqlExecutionContext);

    const context = {
      getType: () => 'graphql',
    } as unknown as ExecutionContext;

    const next: CallHandler<unknown> = {
      handle: () => of('ok'),
    };

    await lastValueFrom(interceptor.intercept(context, next));

    expect(gqlCreateSpy).toHaveBeenCalledTimes(1);
    expect(counterInc).toHaveBeenCalledWith({
      method: 'GRAPHQL',
      path: 'unknown',
      status: 200,
    });
    expect(durationObserve).toHaveBeenCalledWith(
      {
        method: 'GRAPHQL',
        path: 'unknown',
        status: 200,
      },
      expect.any(Number),
    );
  });
});
