import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { TenantService } from './tenant.service';
import {
  CreateTenantInput,
  Tenant,
  TenantsPayload,
  UpdateTenantInput,
} from './tenant.types';

@Resolver(() => Tenant)
export class TenantResolver {
  constructor(private readonly tenantService: TenantService) {}

  @Mutation(() => Tenant)
  async createTenant(@Args('input') input: CreateTenantInput): Promise<Tenant> {
    return this.tenantService.createTenant(input);
  }

  @Mutation(() => Tenant)
  async updateTenant(
    @Args('tenantId') tenantId: string,
    @Args('input') input: UpdateTenantInput,
  ): Promise<Tenant> {
    return this.tenantService.updateTenant(tenantId, input);
  }

  @Mutation(() => Tenant)
  async deactivateTenant(@Args('tenantId') tenantId: string): Promise<Tenant> {
    return this.tenantService.deactivateTenant(tenantId);
  }

  @Query(() => TenantsPayload)
  async tenants(): Promise<TenantsPayload> {
    return this.tenantService.tenants();
  }

  @Query(() => Tenant)
  async myTenant(): Promise<Tenant> {
    return this.tenantService.myTenant();
  }
}
