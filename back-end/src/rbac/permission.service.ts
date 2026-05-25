import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { Redis } from 'ioredis';
import { RoleName } from '@prisma/client';

const USER_ROLE_TO_ROLE_NAME: Record<string, RoleName | null> = {
  SUPER_ADMIN: RoleName.SUPER_ADMIN,
  TENANT_ADMIN: RoleName.TENANT_ADMIN,
  USER: null,
} as const;

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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) return [];

    const roleName = USER_ROLE_TO_ROLE_NAME[user.role];
    if (!roleName) return [];

    const role = await this.prisma.role.findFirst({
      where: { tenantId, name: roleName },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) return [];
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
    const users = await this.prisma.user.findMany({
      where: { tenantId, role: roleName },
    });
    for (const user of users) {
      await this.invalidateUserPermissions(tenantId, user.id);
    }
  }
}
