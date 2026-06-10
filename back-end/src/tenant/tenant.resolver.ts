import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuditAction as PrismaAuditAction } from '@prisma/client';
import { RequirePermission } from '../rbac/permission.guard';
import { TenantService } from './tenant.service';
import { Auditable, AuditAction } from '../audit/audit.decorators';
import { createUpdateDiff } from '../audit/audit.helpers';
import {
  CreateTenantInput,
  Tenant,
  TenantsPayload,
  TenantsQueryInput,
  UpdateTenantInput,
} from './tenant.types';

@Resolver(() => Tenant)
export class TenantResolver {
  constructor(private readonly tenantService: TenantService) {}

  @Mutation(() => Tenant)
  @RequirePermission('tenant:manage')
  @Auditable('Tenant')
  @AuditAction(({ result, args }) => ({
    action: PrismaAuditAction.CREATE,
    resourceId:
      typeof result === 'object' &&
      result !== null &&
      'id' in result &&
      typeof (result as { id: unknown }).id === 'string'
        ? (result as { id: string }).id
        : 'unknown',
    diff: createUpdateDiff(
      null,
      typeof args.input === 'object' && args.input
        ? (args.input as Record<string, unknown>)
        : null,
    ),
  }))
  async createTenant(@Args('input') input: CreateTenantInput): Promise<Tenant> {
    return this.tenantService.createTenant(input);
  }

  @Mutation(() => Tenant)
  @Auditable('Tenant')
  @AuditAction(({ args }) => ({
    action: PrismaAuditAction.UPDATE,
    resourceId:
      typeof args.tenantId === 'string' && args.tenantId
        ? args.tenantId
        : 'unknown',
    diff: createUpdateDiff(
      null,
      typeof args.input === 'object' && args.input
        ? (args.input as Record<string, unknown>)
        : null,
    ),
  }))
  async updateTenant(
    @Args('tenantId') tenantId: string,
    @Args('input') input: UpdateTenantInput,
  ): Promise<Tenant> {
    return this.tenantService.updateTenant(tenantId, input);
  }

  @Mutation(() => Tenant)
  @Auditable('Tenant')
  @AuditAction(({ args }) => ({
    action: PrismaAuditAction.UPDATE,
    resourceId:
      typeof args.tenantId === 'string' && args.tenantId
        ? args.tenantId
        : 'unknown',
    diff: createUpdateDiff(null, { isActive: false }),
  }))
  async deactivateTenant(@Args('tenantId') tenantId: string): Promise<Tenant> {
    return this.tenantService.deactivateTenant(tenantId);
  }

  @Query(() => TenantsPayload)
  async tenants(
    @Args('query', { nullable: true }) query?: TenantsQueryInput,
  ): Promise<TenantsPayload> {
    return this.tenantService.tenants(query ?? {});
  }

  @Query(() => Tenant)
  async myTenant(): Promise<Tenant> {
    return this.tenantService.myTenant();
  }
}
