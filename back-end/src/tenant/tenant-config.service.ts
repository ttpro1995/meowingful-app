import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { FileStorageService } from '../file-storage/file-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { PermissionService } from '../rbac/permission.service';
import { getTenantContext } from './tenant-context.storage';
import {
  BusinessHours,
  BusinessHoursInput,
  BusinessHoursShape,
  DEFAULT_TENANT_FEATURES,
  TenantConfig,
  TenantFeature,
  TenantFeatureKey,
  TenantFeatures,
  TenantFeaturesShape,
  UpdateTenantConfigInput,
} from './tenant-config.types';

interface TenantAccessContext {
  tenantId: string;
  userId: string;
  role: UserRole;
  isSuperAdmin: boolean;
}

@Injectable()
export class TenantConfigService {
  private readonly cacheTtlSeconds = 5 * 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly permissionService: PermissionService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  private cacheKey(tenantId: string): string {
    return `tenant_config:${tenantId}`;
  }

  private getAuthenticatedContext(): TenantAccessContext {
    const context = getTenantContext();

    if (!context?.tenantId || !context.userId) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }

    return {
      tenantId: context.tenantId,
      userId: context.userId,
      role: context.role,
      isSuperAdmin: context.isSuperAdmin,
    };
  }

  private assertSuperAdmin(context: TenantAccessContext): void {
    if (!context.isSuperAdmin) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private normalizeFeatures(features: unknown): TenantFeaturesShape {
    const raw = this.isRecord(features) ? features : {};

    return {
      crm: raw.crm === true,
      elearning: raw.elearning === true,
      call_center: raw.call_center === true,
      live_classes: raw.live_classes === true,
      marketplace: raw.marketplace === true,
    };
  }

  private normalizeBusinessHours(value: unknown): BusinessHours | undefined {
    if (!this.isRecord(value)) {
      return undefined;
    }

    const result: BusinessHoursShape = {};
    for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
      const rawValue = value[day];
      if (typeof rawValue === 'string' && rawValue.length > 0) {
        result[day as keyof BusinessHoursShape] = rawValue;
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  private toBusinessHoursJson(
    value: BusinessHoursInput | undefined,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined;
    }

    const businessHours: Record<string, string> = {};

    for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
      const range = value[day as keyof BusinessHoursInput];
      if (typeof range === 'string' && range.length > 0) {
        businessHours[day] = range;
      }
    }

    return Object.keys(businessHours).length === 0
      ? Prisma.JsonNull
      : businessHours;
  }

  private mapTenantConfig(config: {
    id: string;
    tenantId: string;
    logoUrl: string | null;
    primaryColor: string;
    subdomain: string | null;
    timezone: string;
    defaultLanguage: string;
    businessHours: Prisma.JsonValue;
    features: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }): TenantConfig {
    const features: TenantFeatures = {
      ...DEFAULT_TENANT_FEATURES,
      ...this.normalizeFeatures(config.features),
    };

    return {
      id: config.id,
      tenantId: config.tenantId,
      logoUrl: config.logoUrl ?? undefined,
      primaryColor: config.primaryColor,
      subdomain: config.subdomain ?? undefined,
      timezone: config.timezone,
      defaultLanguage: config.defaultLanguage,
      businessHours: this.normalizeBusinessHours(config.businessHours),
      features,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async assertCanManageTenant(context: TenantAccessContext): Promise<void> {
    if (context.isSuperAdmin || context.role === UserRole.TENANT_ADMIN) {
      return;
    }

    const permissions = await this.permissionService.getUserPermissions(
      context.tenantId,
      context.userId,
    );

    if (!permissions.includes('tenant:manage')) {
      throw new ForbiddenException(
        'FORBIDDEN: missing permission tenant:manage',
      );
    }
  }

  async invalidateTenantConfigCache(tenantId: string): Promise<void> {
    await this.cacheService.del(this.cacheKey(tenantId));
  }

  private async setCachedTenantConfig(
    tenantId: string,
    config: TenantConfig,
  ): Promise<void> {
    await this.cacheService.set(
      this.cacheKey(tenantId),
      JSON.stringify(config),
      this.cacheTtlSeconds,
    );
  }

  private async getCachedTenantConfig(
    tenantId: string,
  ): Promise<TenantConfig | null> {
    const cached = await this.cacheService.get(this.cacheKey(tenantId));
    if (!cached) {
      return null;
    }

    try {
      return JSON.parse(cached) as TenantConfig;
    } catch {
      await this.invalidateTenantConfigCache(tenantId);
      return null;
    }
  }

  async upsertDefaultTenantConfig(tenantId: string): Promise<void> {
    await this.prisma.tenantConfig.upsert({
      where: { tenantId },
      update: {},
      create: {
        tenantId,
      },
    });

    await this.invalidateTenantConfigCache(tenantId);
  }

  async getTenantConfigByTenantId(tenantId: string): Promise<TenantConfig> {
    const cached = await this.getCachedTenantConfig(tenantId);
    if (cached) {
      return cached;
    }

    const config = await this.prisma.tenantConfig.upsert({
      where: { tenantId },
      update: {},
      create: {
        tenantId,
      },
    });

    const mapped = this.mapTenantConfig(config);
    await this.setCachedTenantConfig(tenantId, mapped);

    return mapped;
  }

  async tenantConfig(): Promise<TenantConfig> {
    const context = this.getAuthenticatedContext();
    return this.getTenantConfigByTenantId(context.tenantId);
  }

  async updateTenantConfig(
    input: UpdateTenantConfigInput,
  ): Promise<TenantConfig> {
    const context = this.getAuthenticatedContext();
    await this.assertCanManageTenant(context);

    const updateData: Prisma.TenantConfigUncheckedUpdateInput = {};
    const createData: Prisma.TenantConfigUncheckedCreateInput = {
      tenantId: context.tenantId,
    };

    if (input.primaryColor !== undefined) {
      updateData.primaryColor = input.primaryColor;
      createData.primaryColor = input.primaryColor;
    }

    if (input.subdomain !== undefined) {
      updateData.subdomain = input.subdomain;
      createData.subdomain = input.subdomain;
    }

    if (input.timezone !== undefined) {
      updateData.timezone = input.timezone;
      createData.timezone = input.timezone;
    }

    if (input.defaultLanguage !== undefined) {
      updateData.defaultLanguage = input.defaultLanguage;
      createData.defaultLanguage = input.defaultLanguage;
    }

    const businessHours = this.toBusinessHoursJson(input.businessHours);
    if (businessHours !== undefined) {
      updateData.businessHours = businessHours;
      createData.businessHours = businessHours;
    }

    const updated = await this.prisma.tenantConfig.upsert({
      where: { tenantId: context.tenantId },
      update: updateData,
      create: createData,
    });

    const mapped = this.mapTenantConfig(updated);
    await this.invalidateTenantConfigCache(context.tenantId);
    await this.setCachedTenantConfig(context.tenantId, mapped);

    return mapped;
  }

  async setFeatureFlag(
    tenantId: string,
    feature: TenantFeature,
    enabled: boolean,
  ): Promise<TenantConfig> {
    const context = this.getAuthenticatedContext();
    this.assertSuperAdmin(context);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    const currentConfig = await this.getTenantConfigByTenantId(tenantId);
    const nextFeatures: Prisma.InputJsonObject = {
      ...DEFAULT_TENANT_FEATURES,
      ...currentConfig.features,
      [feature as TenantFeatureKey]: enabled,
    };

    const updated = await this.prisma.tenantConfig.update({
      where: { tenantId },
      data: {
        features: nextFeatures,
      },
    });

    const mapped = this.mapTenantConfig(updated);
    await this.invalidateTenantConfigCache(tenantId);
    await this.setCachedTenantConfig(tenantId, mapped);

    return mapped;
  }

  async uploadTenantLogo(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<TenantConfig> {
    const logoUrl = await this.fileStorageService.uploadTenantLogo(
      tenantId,
      file,
    );

    const updated = await this.prisma.tenantConfig.upsert({
      where: { tenantId },
      update: {
        logoUrl,
      },
      create: {
        tenantId,
        logoUrl,
      },
    });

    const mapped = this.mapTenantConfig(updated);
    await this.invalidateTenantConfigCache(tenantId);
    await this.setCachedTenantConfig(tenantId, mapped);

    return mapped;
  }

  resolveLocalLogoPath(tenantId: string, fileName: string): string | null {
    return this.fileStorageService.resolveLocalLogoPath(tenantId, fileName);
  }
}
