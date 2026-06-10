import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { Request, Response } from 'express';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { LoggerModule } from './logger/logger.module';
import { MetricsModule } from './metrics/metrics.module';
import { TenantModule } from './tenant/tenant.module';
import { RbacModule } from './rbac/rbac.module';
import { MembershipModule } from './membership/membership.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { formatGraphQLError } from './shared/errors/error-format.plugin';
import { UserError } from './shared/errors/user-error.type';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      subscriptions: {
        'graphql-ws': {
          connectionInitWaitTimeout: 5_000,
        },
      },
      buildSchemaOptions: {
        orphanedTypes: [UserError],
      },
      formatError: formatGraphQLError,
      context: (context: {
        req?: Request;
        res?: Response;
        extra?: {
          request?: Request;
        };
        connectionParams?: Record<string, unknown>;
      }) => {
        if (context.req) {
          return {
            req: context.req,
            res: context.res,
          };
        }

        const authorization =
          typeof context.connectionParams?.authorization === 'string'
            ? context.connectionParams.authorization
            : typeof context.connectionParams?.Authorization === 'string'
              ? context.connectionParams.Authorization
              : '';

        const request =
          context.extra?.request ??
          ({ headers: { authorization } } as unknown as Request);

        if (!request.headers.authorization && authorization) {
          request.headers.authorization = authorization;
        }

        return {
          req: request,
          res: context.res,
        };
      },
    }),
    PrismaModule,
    RedisModule,
    TenantModule,
    AuthModule,
    HealthModule,
    MetricsModule,
    RbacModule,
    MembershipModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
