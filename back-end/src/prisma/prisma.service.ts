import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { getTenantContext } from '../tenant/tenant-context.storage';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly tenantScopedModels = new Set(['User', 'Auth']);

  private scopedUserWhere(tenantId: string): Record<string, unknown> {
    return {
      OR: [
        { tenantId },
        {
          userRoles: {
            some: {
              tenantId,
            },
          },
        },
      ],
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return this.isRecord(value) ? value : {};
  }

  private withTenantId(
    value: unknown,
    tenantId: string,
  ): Record<string, unknown> {
    return {
      ...this.toRecord(value),
      tenantId,
    };
  }

  private withTenantIdForCreateMany(
    value: unknown,
    tenantId: string,
  ): Record<string, unknown> | Record<string, unknown>[] {
    if (Array.isArray(value)) {
      return value.map((item) => this.withTenantId(item, tenantId));
    }

    return this.withTenantId(value, tenantId);
  }

  constructor() {
    super({
      adapter: new PrismaPg(
        new pg.Pool({
          connectionString: process.env.DATABASE_URL,
        }),
      ),
    });

    this.registerTenantExtensions();
  }

  private registerTenantExtensions(): void {
    const extendedClient = this.$extends({
      query: {
        $allModels: {
          $allOperations: async ({ model, operation, args, query }) => {
            if (!model || !this.tenantScopedModels.has(model)) {
              return query(args);
            }

            const context = getTenantContext();
            if (!context?.tenantId || context.isSuperAdmin) {
              return query(args);
            }

            const nextArgs = this.toRecord(args);

            if (model === 'User') {
              if (operation === 'findUnique') {
                nextArgs.where = this.withTenantId(
                  nextArgs.where,
                  context.tenantId,
                );

                return query(nextArgs);
              }

              if (operation === 'create') {
                nextArgs.data = this.withTenantId(
                  nextArgs.data,
                  context.tenantId,
                );

                return query(nextArgs);
              }

              if (operation === 'createMany') {
                nextArgs.data = this.withTenantIdForCreateMany(
                  nextArgs.data,
                  context.tenantId,
                );

                return query(nextArgs);
              }

              const userScope = this.scopedUserWhere(context.tenantId);
              const existingWhere = this.toRecord(nextArgs.where);

              nextArgs.where =
                Object.keys(existingWhere).length === 0
                  ? userScope
                  : {
                      AND: [existingWhere, userScope],
                    };

              if (operation === 'upsert') {
                nextArgs.create = this.withTenantId(
                  nextArgs.create,
                  context.tenantId,
                );

                nextArgs.update = this.withTenantId(
                  nextArgs.update,
                  context.tenantId,
                );
              }

              return query(nextArgs);
            }

            if (operation === 'create') {
              nextArgs.data = this.withTenantId(
                nextArgs.data,
                context.tenantId,
              );

              return query(nextArgs);
            }

            if (operation === 'createMany') {
              nextArgs.data = this.withTenantIdForCreateMany(
                nextArgs.data,
                context.tenantId,
              );

              return query(nextArgs);
            }

            nextArgs.where = this.withTenantId(
              nextArgs.where,
              context.tenantId,
            );

            if (operation === 'upsert') {
              nextArgs.create = this.withTenantId(
                nextArgs.create,
                context.tenantId,
              );

              nextArgs.update = this.withTenantId(
                nextArgs.update,
                context.tenantId,
              );
            }

            return query(nextArgs);
          },
        },
      },
    });

    Object.assign(this, extendedClient);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
