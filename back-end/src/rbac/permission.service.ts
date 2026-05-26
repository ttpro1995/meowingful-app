import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { Redis } from 'ioredis';
import { RoleName, UserRole } from '@prisma/client';

const USER_ROLE_TO_ROLE_NAME: Record<UserRole, RoleName | null> = {
  SUPER_ADMIN: RoleName.SUPER_ADMIN,
  TENANT_ADMIN: RoleName.TENANT_ADMIN,
  USER: null,
};

const ROLE_NAME_TO_USER_ROLE: Partial<Record<RoleName, UserRole>> = {
  SUPER_ADMIN: UserRole.SUPER_ADMIN,
  TENANT_ADMIN: UserRole.TENANT_ADMIN,
};

@Injectable()
export class PermissionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getUserPermissions(
    tenantId: string,
    userId: string,
  ): Promise<string[]> {
    const cacheKey = `perm:${tenantId}:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as string[];
    }

    const permissions = await this.loadUserPermissions(tenantId, userId);
    await this.redis.set(cacheKey, JSON.stringify(permissions), 'EX', 60);
    return permissions;
  }

  async loadUserPermissions(
    tenantId: string,
    userId: string,
  ): Promise<string[]> {
    const memberRoles = await this.prisma.userTenantRole.findMany({
      where: {
        tenantId,
        userId,
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (memberRoles.length > 0) {
      const permissionSet = new Set<string>();

      for (const userRole of memberRoles) {
        for (const rolePermission of userRole.role.permissions) {
          permissionSet.add(rolePermission.permission.code);
        }
      }

      return [...permissionSet];
    }

    return this.loadLegacyPermissions(tenantId, userId);
  }

  private async loadLegacyPermissions(
    tenantId: string,
    userId: string,
  ): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      return [];
    }

    const roleName = USER_ROLE_TO_ROLE_NAME[user.role];
    if (!roleName) {
      return [];
    }

    const role = await this.prisma.role.findFirst({
      where: { tenantId, name: roleName },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) {
      return [];
    }

    return role.permissions.map((rp) => rp.permission.code);
  }

  async invalidateUserPermissions(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const cacheKey = `perm:${tenantId}:${userId}`;
    await this.redis.del(cacheKey);
  }

  async invalidateRolePermissions(
    tenantId: string,
    roleName: string,
  ): Promise<void> {
    const parsedRoleName = Object.values(RoleName).find(
      (value) => value === roleName,
    );

    if (!parsedRoleName) {
      return;
    }

    const userIds = new Set<string>();

    const memberUsers = await this.prisma.userTenantRole.findMany({
      where: {
        tenantId,
        role: {
          name: parsedRoleName,
        },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    for (const memberUser of memberUsers) {
      userIds.add(memberUser.userId);
    }

    const legacyRole = ROLE_NAME_TO_USER_ROLE[parsedRoleName];
    if (legacyRole) {
      const legacyUsers = await this.prisma.user.findMany({
        where: {
          tenantId,
          role: legacyRole,
        },
        select: { id: true },
      });

      for (const legacyUser of legacyUsers) {
        userIds.add(legacyUser.id);
      }
    }

    for (const userId of userIds) {
      await this.invalidateUserPermissions(tenantId, userId);
    }
  }
}
