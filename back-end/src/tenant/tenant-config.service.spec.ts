import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
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

  type TenantConfigUpdateFn = (args: {
    where: { tenantId: string };
    data: { features: Record<string, boolean> };
  }) => Promise<unknown>;

  const tenantConfigUpsert = jest.fn<() => Promise<unknown>>();
  const tenantConfigUpdate = jest.fn<TenantConfigUpdateFn>();
  const tenantFindUnique = jest.fn<() => Promise<unknown>>();
  const cacheGet = jest.fn<() => Promise<unknown>>();
  const cacheSet = jest.fn<() => Promise<void>>();
  const cacheDel = jest.fn<() => Promise<void>>();
  const getUserPermissions = jest.fn<() => Promise<unknown>>();
  const uploadTenantLogo = jest.fn<() => Promise<string>>();
  const resolveLocalLogoPath = jest.fn<() => string>();

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
      upsert: tenantConfigUpsert,
      update: tenantConfigUpdate,
    },
    tenant: {
      findUnique: tenantFindUnique,
    },
  } as unknown as PrismaService;

  const mockCacheService = {
    get: cacheGet,
    set: cacheSet,
    del: cacheDel,
  } as unknown as CacheService;

  const mockPermissionService = {
    getUserPermissions,
  } as unknown as PermissionService;

  const mockFileStorageService = {
    uploadTenantLogo,
    resolveLocalLogoPath,
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
    cacheGet.mockResolvedValue(
      JSON.stringify({
        id: 'config-cached',
        tenantId: 'tenant-1',
        features: { crm: true },
      }),
    );

    const result = await service.getTenantConfigByTenantId('tenant-1');

    expect(result.id).toBe('config-cached');
    expect(result.features.crm).toBe(true);
    expect(tenantConfigUpsert).not.toHaveBeenCalled();
  });

  it('falls through to DB when cache misses and caches the result', async () => {
    cacheGet.mockResolvedValue(null);
    tenantConfigUpsert.mockResolvedValue({
      ...baseConfigRecord,
      features: {
        crm: true,
        elearning: false,
        call_center: false,
        live_classes: false,
        marketplace: false,
      },
    });

    const result = await service.getTenantConfigByTenantId('tenant-1');

    expect(result.id).toBe('config-1');
    expect(cacheSet).toHaveBeenCalled();
    expect(tenantConfigUpsert).toHaveBeenCalled();
  });

  it('invalidates and refreshes cache on updateTenantConfig', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'user-1',
      role: UserRole.USER,
      isSuperAdmin: false,
    });
    getUserPermissions.mockResolvedValue(['tenant:manage']);
    tenantConfigUpsert.mockResolvedValue({
      ...baseConfigRecord,
      primaryColor: '#112233',
    });

    const result = await service.updateTenantConfig({
      primaryColor: '#112233',
    });

    expect(result.primaryColor).toBe('#112233');
    expect(cacheDel).toHaveBeenCalledWith('tenant_config:tenant-1');
    expect(cacheSet).toHaveBeenCalled();
    expect(getUserPermissions).toHaveBeenCalledWith('tenant-1', 'user-1');
  });

  it('throws ForbiddenException when caller lacks tenant:manage permission', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'user-1',
      role: UserRole.USER,
      isSuperAdmin: false,
    });
    getUserPermissions.mockResolvedValue([]);

    await expect(
      service.updateTenantConfig({ primaryColor: '#FF0000' }),
    ).rejects.toThrow(ForbiddenException);
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

    tenantFindUnique.mockResolvedValue({
      id: 'tenant-1',
    });
    cacheGet.mockResolvedValue(null);
    tenantConfigUpsert.mockResolvedValue(baseConfigRecord);
    tenantConfigUpdate.mockResolvedValue({
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
    expect(tenantConfigUpdate).toHaveBeenCalledWith({
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
    expect(cacheDel).toHaveBeenCalledWith('tenant_config:tenant-1');
  });

  it('throws BadRequestException when target tenant not found for setFeatureFlag', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-super',
      userId: 'user-super',
      role: UserRole.SUPER_ADMIN,
      isSuperAdmin: true,
    });

    tenantFindUnique.mockResolvedValue(null);

    await expect(
      service.setFeatureFlag('nonexistent', TenantFeature.CRM, true),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates non-CRM feature flag (elearning)', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-super',
      userId: 'user-super',
      role: UserRole.SUPER_ADMIN,
      isSuperAdmin: true,
    });

    tenantFindUnique.mockResolvedValue({ id: 'tenant-1' });
    cacheGet.mockResolvedValue(null);
    tenantConfigUpsert.mockResolvedValue(baseConfigRecord);
    tenantConfigUpdate.mockResolvedValue({
      ...baseConfigRecord,
      features: {
        ...baseConfigRecord.features,
        elearning: true,
      },
    });

    const result = await service.setFeatureFlag(
      'tenant-1',
      TenantFeature.ELEARNING,
      true,
    );

    expect((result.features as Record<string, boolean>).elearning).toBe(true);
    expect(tenantConfigUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          features: expect.objectContaining({ elearning: true }),
        }),
      }),
    );
  });

  it('stores uploaded logo URL and refreshes cache', async () => {
    uploadTenantLogo.mockResolvedValue('https://cdn.example.com/logo.png');
    tenantConfigUpsert.mockResolvedValue({
      ...baseConfigRecord,
      logoUrl: 'https://cdn.example.com/logo.png',
    });

    const result = await service.uploadTenantLogo(
      'tenant-1',
      {} as Express.Multer.File,
    );

    expect(result.logoUrl).toBe('https://cdn.example.com/logo.png');
    expect(cacheDel).toHaveBeenCalledWith('tenant_config:tenant-1');
    expect(cacheSet).toHaveBeenCalled();
  });

  it('rejects when unauthenticated (no tenant context)', async () => {
    (getTenantContext as jest.Mock).mockReturnValue(null);

    await expect(service.tenantConfig()).rejects.toThrow(UnauthorizedException);
  });

  it('normalizes business hours from JSON and returns in config', async () => {
    cacheGet.mockResolvedValue(null);
    tenantConfigUpsert.mockResolvedValue({
      ...baseConfigRecord,
      businessHours: { mon: '09:00-18:00', fri: '09:00-17:00' },
    });

    const result = await service.getTenantConfigByTenantId('tenant-1');

    expect(result.businessHours).toBeDefined();
    expect((result.businessHours as Record<string, string>).mon).toBe(
      '09:00-18:00',
    );
  });

  it('invalidates stale cache when JSON parse fails', async () => {
    cacheGet.mockResolvedValue('not-valid-json{');

    await service.getTenantConfigByTenantId('tenant-1');

    expect(cacheDel).toHaveBeenCalledWith('tenant_config:tenant-1');
  });

  it('allows super-admin to call updateTenantConfig without permission check', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'user-super',
      role: UserRole.SUPER_ADMIN,
      isSuperAdmin: true,
    });

    tenantConfigUpsert.mockResolvedValue({
      ...baseConfigRecord,
      primaryColor: '#ABCDEF',
    });

    const result = await service.updateTenantConfig({
      primaryColor: '#ABCDEF',
    });

    expect(result.primaryColor).toBe('#ABCDEF');
    expect(getUserPermissions).not.toHaveBeenCalled();
  });
});
