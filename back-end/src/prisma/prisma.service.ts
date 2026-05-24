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

            const nextArgs = args ?? {};

            if (operation === 'create') {
              nextArgs.data = {
                ...nextArgs.data,
                tenantId: context.tenantId,
              };

              return query(nextArgs);
            }

            if (operation === 'createMany') {
              if (Array.isArray(nextArgs.data)) {
                nextArgs.data = nextArgs.data.map((item: object) => ({
                  ...item,
                  tenantId: context.tenantId,
                }));
              } else {
                nextArgs.data = {
                  ...nextArgs.data,
                  tenantId: context.tenantId,
                };
              }

              return query(nextArgs);
            }

            nextArgs.where = {
              ...(nextArgs.where ?? {}),
              tenantId: context.tenantId,
            };

            if (operation === 'upsert') {
              nextArgs.create = {
                ...nextArgs.create,
                tenantId: context.tenantId,
              };

              nextArgs.update = {
                ...nextArgs.update,
                tenantId: context.tenantId,
              };
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
