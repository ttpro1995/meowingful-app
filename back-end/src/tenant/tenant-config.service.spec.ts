import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FileStorageService } from '../file-storage/file-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { PermissionService } from '../rbac/permission.service';
import { getTenantContext } from './tenant-context.storage';
import { TenantConfigService } from './tenant-config.service';
import { TenantFeature } from './tenant-config.types';

jest.mock('./tenant-context.storage', () => ({
  getTenantContext: jest.fn(),
}));

describe('TenantConfigService', () => {
  let service: TenantConfigService;

  const now = new Date('2026-05-28T00:00:00.000Z');

  const baseConfigRecord = {
    id: 'config-1',
    tenantId: 'tenant-1',
    logoUrl: null,
    primaryColor: '#3B82F6',
    subdomain: null,
    timezone: 'UTC',
    defaultLanguage: 'en',
    businessHours: null,
    features: {
      crm: false,
      elearning: false,
      call_center: false,
      live_classes: false,
      marketplace: false,
    },
    createdAt: now,
    updatedAt: now,
  };

  const mockPrisma = {
    tenantConfig: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  } as unknown as CacheService;

  const mockPermissionService = {
    getUserPermissions: jest.fn(),
  } as unknown as PermissionService;

  const mockFileStorageService = {
    uploadTenantLogo: jest.fn(),
    resolveLocalLogoPath: jest.fn(),
  } as unknown as FileStorageService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new TenantConfigService(
      mockPrisma,
      mockCacheService,
      mockPermissionService,
      mockFileStorageService,
    );
  });

  it('returns cached tenant config when available', async () => {
    (mockCacheService.get as jest.Mock).mockResolvedValue(
      JSON.stringify({
        id: 'config-cached',
        tenantId: 'tenant-1',
        features: { crm: true },
      }),
    );

    const result = await service.getTenantConfigByTenantId('tenant-1');

    expect(result.id).toBe('config-cached');
    expect(result.features.crm).toBe(true);
    expect(mockPrisma.tenantConfig.upsert).not.toHaveBeenCalled();
  });

  it('updates tenant config and refreshes cache for tenant manager', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'user-1',
      role: UserRole.USER,
      isSuperAdmin: false,
    });
    (mockPermissionService.getUserPermissions as jest.Mock).mockResolvedValue([
      'tenant:manage',
    ]);
    (mockPrisma.tenantConfig.upsert as jest.Mock).mockResolvedValue({
      ...baseConfigRecord,
      primaryColor: '#112233',
    });

    const result = await service.updateTenantConfig({
      primaryColor: '#112233',
    });

    expect(result.primaryColor).toBe('#112233');
    expect(mockCacheService.del).toHaveBeenCalledWith('tenant_config:tenant-1');
    expect(mockCacheService.set).toHaveBeenCalled();
    expect(mockPermissionService.getUserPermissions).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
    );
  });

  it('rejects feature toggle when caller is not super-admin', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'user-1',
      role: UserRole.TENANT_ADMIN,
      isSuperAdmin: false,
    });

    await expect(
      service.setFeatureFlag('tenant-1', TenantFeature.CRM, true),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('updates feature flag and invalidates cache', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-super',
      userId: 'user-super',
      role: UserRole.SUPER_ADMIN,
      isSuperAdmin: true,
    });

    (mockPrisma.tenant.findUnique as jest.Mock).mockResolvedValue({
      id: 'tenant-1',
    });
    (mockCacheService.get as jest.Mock).mockResolvedValue(null);
    (mockPrisma.tenantConfig.upsert as jest.Mock).mockResolvedValue(
      baseConfigRecord,
    );
    (mockPrisma.tenantConfig.update as jest.Mock).mockResolvedValue({
      ...baseConfigRecord,
      features: {
        ...baseConfigRecord.features,
        crm: true,
      },
    });

    const result = await service.setFeatureFlag(
      'tenant-1',
      TenantFeature.CRM,
      true,
    );

    expect(result.features.crm).toBe(true);
    expect(mockPrisma.tenantConfig.update).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      data: {
        features: {
          crm: true,
          elearning: false,
          call_center: false,
          live_classes: false,
          marketplace: false,
        },
      },
    });
    expect(mockCacheService.del).toHaveBeenCalledWith('tenant_config:tenant-1');
  });

  it('stores uploaded logo URL and refreshes cache', async () => {
    (mockFileStorageService.uploadTenantLogo as jest.Mock).mockResolvedValue(
      'https://cdn.example.com/logo.png',
    );
    (mockPrisma.tenantConfig.upsert as jest.Mock).mockResolvedValue({
      ...baseConfigRecord,
      logoUrl: 'https://cdn.example.com/logo.png',
    });

    const result = await service.uploadTenantLogo(
      'tenant-1',
      {} as Express.Multer.File,
    );

    expect(result.logoUrl).toBe('https://cdn.example.com/logo.png');
    expect(mockCacheService.del).toHaveBeenCalledWith('tenant_config:tenant-1');
    expect(mockCacheService.set).toHaveBeenCalled();
  });
});
