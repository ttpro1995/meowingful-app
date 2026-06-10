import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuditAction as PrismaAuditAction } from '@prisma/client';
import {
  TenantConfig,
  TenantFeature,
  UpdateTenantConfigInput,
} from './tenant-config.types';
import { TenantConfigService } from './tenant-config.service';
import { Auditable, AuditAction } from '../audit/audit.decorators';
import { createUpdateDiff } from '../audit/audit.helpers';

@Resolver(() => TenantConfig)
export class TenantConfigResolver {
  constructor(private readonly tenantConfigService: TenantConfigService) {}

  @Query(() => TenantConfig)
  async tenantConfig(): Promise<TenantConfig> {
    return this.tenantConfigService.tenantConfig();
  }

  @Mutation(() => TenantConfig)
  @Auditable('TenantConfig')
  @AuditAction(({ result, args }) => ({
    action: PrismaAuditAction.UPDATE,
    resourceId:
      typeof result === 'object' &&
      result !== null &&
      'tenantId' in result &&
      typeof (result as { tenantId: unknown }).tenantId === 'string'
        ? (result as { tenantId: string }).tenantId
        : 'unknown',
    diff: createUpdateDiff(
      null,
      typeof args.input === 'object' && args.input
        ? (args.input as Record<string, unknown>)
        : null,
    ),
  }))
  async updateTenantConfig(
    @Args('input') input: UpdateTenantConfigInput,
  ): Promise<TenantConfig> {
    return this.tenantConfigService.updateTenantConfig(input);
  }

  @Mutation(() => TenantConfig)
  @Auditable('TenantConfig')
  @AuditAction(({ args }) => ({
    action: PrismaAuditAction.UPDATE,
    resourceId:
      typeof args.tenantId === 'string' && args.tenantId
        ? args.tenantId
        : 'unknown',
    diff: createUpdateDiff(null, {
      feature: args.feature,
      enabled: args.enabled,
    }),
  }))
  async setFeatureFlag(
    @Args('tenantId') tenantId: string,
    @Args('feature', { type: () => TenantFeature }) feature: TenantFeature,
    @Args('enabled') enabled: boolean,
  ): Promise<TenantConfig> {
    return this.tenantConfigService.setFeatureFlag(tenantId, feature, enabled);
  }
}
