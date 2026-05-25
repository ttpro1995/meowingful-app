import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PermissionService } from './permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { RolePermissionsMatrix } from './rbac.types';
import { ForbiddenException } from '@nestjs/common';
import { getTenantContext } from '../tenant/tenant-context.storage';

@Resolver()
export class RbacResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
  ) {}

  @Query(() => [RolePermissionsMatrix])
  async rolePermissions(@Args('tenantId') tenantId: string) {
    const context = getTenantContext();
    if (!context?.isSuperAdmin && context?.tenantId !== tenantId) {
      throw new ForbiddenException('Cannot access other tenant permissions');
    }
    const roles = await this.prisma.role.findMany({
      where: { tenantId },
      include: { permissions: { include: { permission: true } } },
    });
    return roles.map((role) => ({
      roleName: role.name,
      permissions: role.permissions.map((rp) => rp.permission.code),
    }));
  }

  @Mutation(() => Boolean)
  async grantPermission(
    @Args('tenantId') tenantId: string,
    @Args('roleName') roleName: string,
    @Args('permissionCode') permissionCode: string,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { tenantId, name: roleName },
    });
    const perm = await this.prisma.permission.findUnique({
      where: { code: permissionCode },
    });
    if (!role || !perm)
      throw new ForbiddenException('Role or permission not found');
    await this.prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId: perm.id },
      },
      update: {},
      create: { roleId: role.id, permissionId: perm.id },
    });
    await this.permissionService.invalidateRolePermissions(tenantId, roleName);
    return true;
  }

  @Mutation(() => Boolean)
  async revokePermission(
    @Args('tenantId') tenantId: string,
    @Args('roleName') roleName: string,
    @Args('permissionCode') permissionCode: string,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { tenantId, name: roleName },
    });
    const perm = await this.prisma.permission.findUnique({
      where: { code: permissionCode },
    });
    if (!role || !perm)
      throw new ForbiddenException('Role or permission not found');
    await this.prisma.rolePermission
      .delete({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: perm.id },
        },
      })
      .catch(() => {});
    await this.permissionService.invalidateRolePermissions(tenantId, roleName);
    return true;
  }
}
