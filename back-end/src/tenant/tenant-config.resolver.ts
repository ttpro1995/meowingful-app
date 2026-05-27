import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  TenantConfig,
  TenantFeature,
  UpdateTenantConfigInput,
} from './tenant-config.types';
import { TenantConfigService } from './tenant-config.service';

@Resolver(() => TenantConfig)
export class TenantConfigResolver {
  constructor(private readonly tenantConfigService: TenantConfigService) {}

  @Query(() => TenantConfig)
  async tenantConfig(): Promise<TenantConfig> {
    return this.tenantConfigService.tenantConfig();
  }

  @Mutation(() => TenantConfig)
  async updateTenantConfig(
    @Args('input') input: UpdateTenantConfigInput,
  ): Promise<TenantConfig> {
    return this.tenantConfigService.updateTenantConfig(input);
  }

  @Mutation(() => TenantConfig)
  async setFeatureFlag(
    @Args('tenantId') tenantId: string,
    @Args('feature', { type: () => TenantFeature }) feature: TenantFeature,
    @Args('enabled') enabled: boolean,
  ): Promise<TenantConfig> {
    return this.tenantConfigService.setFeatureFlag(tenantId, feature, enabled);
  }
}
