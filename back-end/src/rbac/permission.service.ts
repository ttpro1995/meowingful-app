import { Injectable, Inject, CACHE_MANAGER, ForbiddenException } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getUserPermissions(tenantId: string, userId: string): Promise<string[]> {
    const cacheKey = `perm:${tenantId}:${userId}`;
    let permissions = await this.cacheManager.get<string[]>(cacheKey);
    if (!permissions) {
      permissions = await this.loadUserPermissions(tenantId, userId);
      await this.cacheManager.set(cacheKey, permissions, 60); // 60s TTL
    }
    return permissions;
  }

  async loadUserPermissions(tenantId: string, userId: string): Promise<string[]> {
    // Find roles for user, then permissions for those roles
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
      },
    });
    if (!user) return [];
    // TODO: Implement user-role assignment if needed
    // For now, assume user.role maps to RoleName
    const role = await this.prisma.role.findFirst({
      where: { tenantId, name: user.role },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) return [];
    return role.permissions.map((rp) => rp.permission.code);
  }

  async invalidateUserPermissions(tenantId: string, userId: string) {
    const cacheKey = `perm:${tenantId}:${userId}`;
    await this.cacheManager.del(cacheKey);
  }
}
