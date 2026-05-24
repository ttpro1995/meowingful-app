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

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

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
        tenantId: tenant.id,
        deletedAt: null,
      },
    });

    return {
      ...tenant,
      userCount,
      activeCourses: 0,
    };
  }

  async createTenant(input: CreateTenantInput): Promise<Tenant> {
    this.assertSuperAdmin();

    try {
      return await this.prisma.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          planTier: input.planTier ?? 'basic',
          contactEmail: input.contactEmail,
        },
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Tenant slug already exists');
      }

      throw error;
    }
  }

  async updateTenant(tenantId: string, input: UpdateTenantInput): Promise<Tenant> {
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
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
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
