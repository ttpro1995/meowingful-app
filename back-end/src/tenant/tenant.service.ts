import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTenantInput,
  Tenant,
  TenantListItem,
  TenantsPayload,
  UpdateTenantInput,
} from './tenant.types';
import { getTenantContext } from './tenant-context.storage';
import { RoleName } from '@prisma/client';

const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  SUPER_ADMIN: [
    'lead:create',
    'lead:delete',
    'course:create',
    'course:enroll',
    'tenant:manage',
  ],
  TENANT_ADMIN: [
    'lead:create',
    'lead:delete',
    'course:create',
    'course:enroll',
    'tenant:manage',
  ],
  DEVELOPER: [],
  DIRECTOR: [],
  SALES_MANAGER: ['lead:create', 'lead:delete'],
  STAFF: ['lead:create'],
  ACCOUNTANT: [],
  HR: [],
  INSTRUCTOR: ['course:create'],
  STUDENT: ['course:enroll'],
};

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  private isPrismaUniqueConstraintError(
    error: unknown,
  ): error is { code: string } {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return typeof error.code === 'string';
  }

  private assertAuthenticated(): string {
    const context = getTenantContext();
    if (!context?.tenantId) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }

    return context.tenantId;
  }

  private assertSuperAdmin(): void {
    const context = getTenantContext();
    if (!context?.isSuperAdmin) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }
  }

  private async mapTenantListItem(tenant: Tenant): Promise<TenantListItem> {
    const userCount = await this.prisma.user.count({
      where: {
        deletedAt: null,
        userRoles: {
          some: {
            tenantId: tenant.id,
          },
        },
      },
    });

    return {
      ...tenant,
      userCount,
      activeCourses: 0,
    };
  }

  private async seedRolesForTenant(tenantId: string): Promise<void> {
    for (const roleName of Object.keys(
      DEFAULT_ROLE_PERMISSIONS,
    ) as RoleName[]) {
      const role = await this.prisma.role.create({
        data: {
          tenantId,
          name: roleName,
        },
      });

      const permCodes = DEFAULT_ROLE_PERMISSIONS[roleName];
      for (const code of permCodes) {
        const perm = await this.prisma.permission.findUnique({
          where: { code },
        });
        if (perm) {
          await this.prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: perm.id,
            },
          });
        }
      }
    }
  }

  async createTenant(input: CreateTenantInput): Promise<Tenant> {
    this.assertSuperAdmin();

    try {
      const tenant = await this.prisma.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          planTier: input.planTier ?? 'basic',
          contactEmail: input.contactEmail,
        },
      });

      await this.seedRolesForTenant(tenant.id);
      return tenant;
    } catch (error: unknown) {
      if (this.isPrismaUniqueConstraintError(error) && error.code === 'P2002') {
        throw new ConflictException('Tenant slug already exists');
      }

      throw error;
    }
  }

  async updateTenant(
    tenantId: string,
    input: UpdateTenantInput,
  ): Promise<Tenant> {
    this.assertSuperAdmin();

    const existing = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!existing) {
      throw new BadRequestException('Tenant not found');
    }

    try {
      return await this.prisma.tenant.update({
        where: { id: tenantId },
        data: input,
      });
    } catch (error: unknown) {
      if (this.isPrismaUniqueConstraintError(error) && error.code === 'P2002') {
        throw new ConflictException('Tenant slug already exists');
      }

      throw error;
    }
  }

  async deactivateTenant(tenantId: string): Promise<Tenant> {
    this.assertSuperAdmin();

    return this.updateTenant(tenantId, { isActive: false });
  }

  async tenants(): Promise<TenantsPayload> {
    this.assertSuperAdmin();

    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const tenantsWithCounts = await Promise.all(
      tenants.map((tenant) => this.mapTenantListItem(tenant)),
    );

    return {
      tenants: tenantsWithCounts,
      totalCount: tenantsWithCounts.length,
    };
  }

  async myTenant(): Promise<Tenant> {
    const tenantId = this.assertAuthenticated();

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }

    return tenant;
  }
}
