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
  TenantsFilterInput,
  TenantsPayload,
  TenantsQueryInput,
  UpdateTenantInput,
} from './tenant.types';
import { getTenantContext } from './tenant-context.storage';
import { Prisma, RoleName } from '@prisma/client';
import { DateFilter, StringFilter } from '../shared/pagination/filter.types';
import { SortDirection } from '../shared/pagination/pagination.args';
import { paginate } from '../shared/pagination/paginate';

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
  private readonly tenantSortableFields = new Set([
    'createdAt',
    'updatedAt',
    'name',
    'slug',
    'planTier',
    'contactEmail',
  ]);

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

  private toStringFilter(
    filter?: StringFilter,
  ): Prisma.StringFilter | undefined {
    if (!filter) {
      return undefined;
    }

    const where: Prisma.StringFilter = {
      mode: 'insensitive',
    };

    if (filter.equals) {
      where.equals = filter.equals;
    }

    if (filter.contains) {
      where.contains = filter.contains;
    }

    if (filter.startsWith) {
      where.startsWith = filter.startsWith;
    }

    if (filter.endsWith) {
      where.endsWith = filter.endsWith;
    }

    if (filter.in && filter.in.length > 0) {
      where.in = filter.in;
    }

    return Object.keys(where).length > 1 ? where : undefined;
  }

  private toDateFilter(filter?: DateFilter): Prisma.DateTimeFilter | undefined {
    if (!filter) {
      return undefined;
    }

    const where: Prisma.DateTimeFilter = {};

    if (filter.equals) {
      where.equals = new Date(filter.equals);
    }

    if (filter.gt) {
      where.gt = new Date(filter.gt);
    }

    if (filter.gte) {
      where.gte = new Date(filter.gte);
    }

    if (filter.lt) {
      where.lt = new Date(filter.lt);
    }

    if (filter.lte) {
      where.lte = new Date(filter.lte);
    }

    return Object.keys(where).length > 0 ? where : undefined;
  }

  private buildTenantsWhereInput(
    filter?: TenantsFilterInput,
  ): Prisma.TenantWhereInput {
    const where: Prisma.TenantWhereInput = {};

    const nameFilter = this.toStringFilter(filter?.name);
    if (nameFilter) {
      where.name = nameFilter;
    }

    const slugFilter = this.toStringFilter(filter?.slug);
    if (slugFilter) {
      where.slug = slugFilter;
    }

    const planTierFilter = this.toStringFilter(filter?.planTier);
    if (planTierFilter) {
      where.planTier = planTierFilter;
    }

    const contactEmailFilter = this.toStringFilter(filter?.contactEmail);
    if (contactEmailFilter) {
      where.contactEmail = contactEmailFilter;
    }

    const createdAtFilter = this.toDateFilter(filter?.createdAt);
    if (createdAtFilter) {
      where.createdAt = createdAtFilter;
    }

    if (typeof filter?.isActive === 'boolean') {
      where.isActive = filter.isActive;
    }

    return where;
  }

  private resolveTenantsOrderBy(
    orderField: string | undefined,
    direction: SortDirection | undefined,
  ): Prisma.TenantOrderByWithRelationInput {
    const field = orderField ?? 'createdAt';
    if (!this.tenantSortableFields.has(field)) {
      throw new BadRequestException(`Unsupported orderBy.field: ${field}`);
    }

    const prismaDirection: Prisma.SortOrder =
      direction === SortDirection.DESC ? 'desc' : 'asc';

    return {
      [field]: prismaDirection,
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

      await this.prisma.tenantConfig.create({
        data: {
          tenantId: tenant.id,
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

  async tenants(query: TenantsQueryInput = {}): Promise<TenantsPayload> {
    this.assertSuperAdmin();

    const { page, limit, skip, take } = paginate(
      query.pagination?.page,
      query.pagination?.limit,
    );

    const where = this.buildTenantsWhereInput(query.filter);
    const orderBy = this.resolveTenantsOrderBy(
      query.orderBy?.field,
      query.orderBy?.direction,
    );

    const totalCount = await this.prisma.tenant.count({ where });

    const tenants = await this.prisma.tenant.findMany({
      where,
      orderBy,
      skip,
      take,
    });

    const data = await Promise.all(
      tenants.map((tenant) => this.mapTenantListItem(tenant)),
    );

    return {
      data,
      tenants: data,
      totalCount,
      pageInfo: {
        total: totalCount,
        page,
        limit,
        totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / limit),
      },
    };
  }

  async myTenant(): Promise<Tenant> {
    const tenantId = this.assertAuthenticated();

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        config: {
          select: {
            logoUrl: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      planTier: tenant.planTier,
      contactEmail: tenant.contactEmail,
      logoUrl: tenant.config?.logoUrl ?? undefined,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }
}
