import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PermissionService } from './permission.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  RolePermissionsFilterInput,
  RolePermissionsMatrix,
  RolePermissionsPayload,
  RolePermissionsQueryInput,
} from './rbac.types';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getTenantContext } from '../tenant/tenant-context.storage';
import {
  AuditAction as PrismaAuditAction,
  RoleName,
} from '@prisma/client';
import { EnumFilter, StringFilter } from '../shared/pagination/filter.types';
import { SortDirection } from '../shared/pagination/pagination.args';
import { paginate } from '../shared/pagination/paginate';
import { Auditable, AuditAction } from '../audit/audit.decorators';
import { createUpdateDiff } from '../audit/audit.helpers';

@Resolver()
export class RbacResolver {
  private readonly rolePermissionsSortableFields = new Set([
    'roleName',
    'permissionCount',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
  ) {}

  private parseRoleName(roleName: string): RoleName {
    const parsed = Object.values(RoleName).find((value) => value === roleName);
    if (!parsed) {
      throw new ForbiddenException('Role or permission not found');
    }

    return parsed;
  }

  private parseRoleFilterValue(value: string): RoleName {
    const parsed = Object.values(RoleName).find((role) => role === value);
    if (!parsed) {
      throw new BadRequestException(`Invalid role filter value: ${value}`);
    }

    return parsed;
  }

  private matchesRoleNameFilter(
    roleName: RoleName,
    filter?: EnumFilter,
  ): boolean {
    if (!filter) {
      return true;
    }

    if (
      filter.equals &&
      roleName !== this.parseRoleFilterValue(filter.equals)
    ) {
      return false;
    }

    if (filter.in && filter.in.length > 0) {
      const allowedRoles = new Set(
        filter.in.map((value) => this.parseRoleFilterValue(value)),
      );
      if (!allowedRoles.has(roleName)) {
        return false;
      }
    }

    return true;
  }

  private matchesStringFilter(value: string, filter?: StringFilter): boolean {
    if (!filter) {
      return true;
    }

    const normalizedValue = value.toLowerCase();

    if (filter.equals && normalizedValue !== filter.equals.toLowerCase()) {
      return false;
    }

    if (
      filter.contains &&
      !normalizedValue.includes(filter.contains.toLowerCase())
    ) {
      return false;
    }

    if (
      filter.startsWith &&
      !normalizedValue.startsWith(filter.startsWith.toLowerCase())
    ) {
      return false;
    }

    if (
      filter.endsWith &&
      !normalizedValue.endsWith(filter.endsWith.toLowerCase())
    ) {
      return false;
    }

    if (filter.in && filter.in.length > 0) {
      const normalizedAllowedValues = filter.in.map((entry) =>
        entry.toLowerCase(),
      );
      if (!normalizedAllowedValues.includes(normalizedValue)) {
        return false;
      }
    }

    return true;
  }

  private filterRolePermissionsRows(
    rows: RolePermissionsMatrix[],
    filter?: RolePermissionsFilterInput,
  ): RolePermissionsMatrix[] {
    if (!filter) {
      return rows;
    }

    return rows.filter((row) => {
      if (!this.matchesRoleNameFilter(row.roleName, filter.roleName)) {
        return false;
      }

      if (filter.permissionCode) {
        return row.permissions.some((permissionCode) =>
          this.matchesStringFilter(permissionCode, filter.permissionCode),
        );
      }

      return true;
    });
  }

  private sortRolePermissionsRows(
    rows: RolePermissionsMatrix[],
    orderField: string | undefined,
    direction: SortDirection | undefined,
  ): RolePermissionsMatrix[] {
    const field = orderField ?? 'roleName';
    if (!this.rolePermissionsSortableFields.has(field)) {
      throw new BadRequestException(`Unsupported orderBy.field: ${field}`);
    }

    const sortDirection = direction === SortDirection.DESC ? -1 : 1;

    return [...rows].sort((left, right) => {
      const comparison =
        field === 'permissionCount'
          ? left.permissions.length - right.permissions.length
          : left.roleName.localeCompare(right.roleName);

      if (comparison !== 0) {
        return comparison * sortDirection;
      }

      return left.roleName.localeCompare(right.roleName) * sortDirection;
    });
  }

  @Query(() => RolePermissionsPayload)
  async rolePermissions(
    @Args('tenantId') tenantId: string,
    @Args('query', { nullable: true }) query?: RolePermissionsQueryInput,
  ): Promise<RolePermissionsPayload> {
    const context = getTenantContext();
    if (!context?.isSuperAdmin && context?.tenantId !== tenantId) {
      throw new ForbiddenException('Cannot access other tenant permissions');
    }

    const roles = await this.prisma.role.findMany({
      where: { tenantId },
      include: { permissions: { include: { permission: true } } },
    });

    const rows: RolePermissionsMatrix[] = roles.map((role) => ({
      roleName: role.name,
      permissions: role.permissions.map((rp) => rp.permission.code),
    }));

    const filteredRows = this.filterRolePermissionsRows(rows, query?.filter);
    const sortedRows = this.sortRolePermissionsRows(
      filteredRows,
      query?.orderBy?.field,
      query?.orderBy?.direction,
    );

    const { page, limit, skip, take } = paginate(
      query?.pagination?.page,
      query?.pagination?.limit,
    );

    const data = sortedRows.slice(skip, skip + take);
    const totalCount = sortedRows.length;

    return {
      data,
      rolePermissions: data,
      totalCount,
      pageInfo: {
        total: totalCount,
        page,
        limit,
        totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / limit),
      },
    };
  }

  @Query(() => [String])
  async myPermissions(): Promise<string[]> {
    const context = getTenantContext();
    if (!context?.tenantId || !context.userId) {
      throw new ForbiddenException('UNAUTHORIZED');
    }

    return this.permissionService.getUserPermissions(
      context.tenantId,
      context.userId,
    );
  }

  @Mutation(() => Boolean)
  @Auditable('RolePermission')
  @AuditAction(({ args }) => ({
    action: PrismaAuditAction.PERMISSION_GRANTED,
    resourceId:
      typeof args.tenantId === 'string' && args.tenantId
        ? `${args.tenantId}:${String(args.roleName)}:${String(args.permissionCode)}`
        : 'unknown',
    diff: createUpdateDiff(null, {
      roleName: args.roleName,
      permissionCode: args.permissionCode,
      granted: true,
    }),
  }))
  async grantPermission(
    @Args('tenantId') tenantId: string,
    @Args('roleName', { type: () => RoleName }) roleName: RoleName,
    @Args('permissionCode') permissionCode: string,
  ) {
    const parsedRoleName = this.parseRoleName(roleName);
    const role = await this.prisma.role.findFirst({
      where: { tenantId, name: parsedRoleName },
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
  @Auditable('RolePermission')
  @AuditAction(({ args }) => ({
    action: PrismaAuditAction.PERMISSION_REVOKED,
    resourceId:
      typeof args.tenantId === 'string' && args.tenantId
        ? `${args.tenantId}:${String(args.roleName)}:${String(args.permissionCode)}`
        : 'unknown',
    diff: createUpdateDiff(null, {
      roleName: args.roleName,
      permissionCode: args.permissionCode,
      granted: false,
    }),
  }))
  async revokePermission(
    @Args('tenantId') tenantId: string,
    @Args('roleName', { type: () => RoleName }) roleName: RoleName,
    @Args('permissionCode') permissionCode: string,
  ) {
    const parsedRoleName = this.parseRoleName(roleName);
    const role = await this.prisma.role.findFirst({
      where: { tenantId, name: parsedRoleName },
    });
    const perm = await this.prisma.permission.findUnique({
      where: { code: permissionCode },
    });
    if (!role || !perm)
      throw new ForbiddenException('Role or permission not found');
    try {
      await this.prisma.rolePermission.delete({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: perm.id },
        },
      });
    } catch {
      // Ignore missing mapping because mutation is idempotent.
    }

    await this.permissionService.invalidateRolePermissions(tenantId, roleName);
    return true;
  }
}
