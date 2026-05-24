import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PermissionService } from './permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { Permission, Role, RolePermissionsMatrix } from './rbac.types';
import { ForbiddenException } from '@nestjs/common';

@Resolver()
export class RbacResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
  ) {}

  @Query(() => [RolePermissionsMatrix])
  async rolePermissions(@Args('tenantId') tenantId: string) {
    // List all roles and their permissions for a tenant
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
    const role = await this.prisma.role.findFirst({ where: { tenantId, name: roleName } });
    const perm = await this.prisma.permission.findUnique({ where: { code: permissionCode } });
    if (!role || !perm) throw new ForbiddenException('Role or permission not found');
    await this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
      update: {},
      create: { roleId: role.id, permissionId: perm.id },
    });
    // TODO: Invalidate cache for all users with this role in this tenant
    return true;
  }

  @Mutation(() => Boolean)
  async revokePermission(
    @Args('tenantId') tenantId: string,
    @Args('roleName') roleName: string,
    @Args('permissionCode') permissionCode: string,
  ) {
    const role = await this.prisma.role.findFirst({ where: { tenantId, name: roleName } });
    const perm = await this.prisma.permission.findUnique({ where: { code: permissionCode } });
    if (!role || !perm) throw new ForbiddenException('Role or permission not found');
    await this.prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
    }).catch(() => {});
    // TODO: Invalidate cache for all users with this role in this tenant
    return true;
  }
}
