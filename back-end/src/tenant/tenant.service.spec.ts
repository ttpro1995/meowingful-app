import {
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { TenantService } from './tenant.service';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from './tenant-context.storage';
import { SortDirection } from '../shared/pagination/pagination.args';

jest.mock('./tenant-context.storage', () => ({
  getTenantContext: jest.fn(),
}));

describe('TenantService', () => {
  let service: TenantService;

  const mockPrismaService = {
    tenant: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    tenantConfig: {
      create: jest.fn(),
      upsert: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    role: {
      upsert: jest.fn(),
      create: jest.fn(),
    },
    permission: {
      findUnique: jest.fn(),
    },
    rolePermission: {
      create: jest.fn(),
    },
  } as unknown as PrismaService;

  const mockTenant = mockPrismaService.tenant as unknown as {
    create: jest.Mock;
    update: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
  const mockTenantConfig = mockPrismaService.tenantConfig as unknown as {
    create: jest.Mock;
    upsert: jest.Mock;
  };
  const mockUser = mockPrismaService.user as unknown as {
    count: jest.Mock;
  };
  const mockRole = mockPrismaService.role as unknown as {
    create: jest.Mock;
    upsert: jest.Mock;
  };
  const mockPermission = mockPrismaService.permission as unknown as {
    findUnique: jest.Mock;
  };
  const mockRolePermission = mockPrismaService.rolePermission as unknown as {
    create: jest.Mock;
  };

  beforeEach(() => {
    service = new TenantService(mockPrismaService);
    jest.clearAllMocks();
  });

  it('rejects createTenant when caller is not super-admin', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      isSuperAdmin: false,
    });

    await expect(
      service.createTenant({
        name: 'Tenant 1',
        slug: 'tenant-1',
        contactEmail: 'owner@tenant-1.test',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('returns myTenant for authenticated request', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      isSuperAdmin: false,
    });

    const findUniqueMock = jest.fn().mockResolvedValue({
      id: 'tenant-1',
      name: 'Tenant 1',
      slug: 'tenant-1',
      planTier: 'basic',
      contactEmail: 'owner@tenant-1.test',
      config: {
        logoUrl: 'https://cdn.example.com/logo.png',
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrismaService.tenant.findUnique = findUniqueMock;

    const tenant = await service.myTenant();

    expect(tenant.id).toBe('tenant-1');
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      include: {
        config: {
          select: {
            logoUrl: true,
          },
        },
      },
    });
  });

  it('returns tenant list with user counts for super-admin', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-admin',
      isSuperAdmin: true,
    });

    const findManyMock = jest.fn().mockResolvedValue([
      {
        id: 'tenant-1',
        name: 'Tenant 1',
        slug: 'tenant-1',
        planTier: 'basic',
        contactEmail: 'owner@tenant-1.test',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'tenant-2',
        name: 'Tenant 2',
        slug: 'tenant-2',
        planTier: 'pro',
        contactEmail: 'owner@tenant-2.test',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockPrismaService.tenant.findMany = findManyMock;

    mockPrismaService.user.count = jest
      .fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5);
    mockPrismaService.tenant.count = jest.fn().mockResolvedValue(2);

    const result = await service.tenants();

    expect(result.totalCount).toBe(2);
    expect(result.pageInfo.total).toBe(2);
    expect(result.data.length).toBe(2);
    expect(result.tenants[0].userCount).toBe(2);
    expect(result.tenants[1].userCount).toBe(5);
  });

  it('throws BadRequestException for unsupported tenants orderBy field', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-admin',
      isSuperAdmin: true,
    });

    await expect(
      service.tenants({
        orderBy: {
          field: 'invalidField',
          direction: SortDirection.ASC,
        },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('clamps pagination.limit to max 100 in tenant list payload', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-admin',
      isSuperAdmin: true,
    });

    mockPrismaService.tenant.count = jest.fn().mockResolvedValue(1);
    const findManyMock = jest.fn().mockResolvedValue([
      {
        id: 'tenant-1',
        name: 'Tenant 1',
        slug: 'tenant-1',
        planTier: 'basic',
        contactEmail: 'owner@tenant-1.test',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockPrismaService.tenant.findMany = findManyMock;
    mockPrismaService.user.count = jest.fn().mockResolvedValue(1);

    const result = await service.tenants({
      pagination: {
        page: 1,
        limit: 200,
      },
    });

    expect(result.pageInfo.limit).toBe(100);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 100,
      }),
    );
  });

  describe('createTenant', () => {
    it('creates a tenant and tenantConfig for super-admin', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'super-admin',
        isSuperAdmin: true,
      });

      const createdTenant = {
        id: 'tenant-new',
        name: 'New Tenant',
        slug: 'new-tenant',
        planTier: 'pro',
        contactEmail: 'owner@newtenant.test',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTenant.create.mockResolvedValue(createdTenant);
      mockTenantConfig.create.mockResolvedValue({
        id: 'config-new',
        tenantId: 'tenant-new',
      });
      mockRole.create.mockResolvedValue({
        id: 'role-1',
        tenantId: 'tenant-new',
        name: 'DEVELOPER',
      });
      mockPermission.findUnique.mockResolvedValue({
        id: 'perm-1',
        code: 'lead:create',
      });
      mockRolePermission.create.mockResolvedValue({});

      const result = await service.createTenant({
        name: 'New Tenant',
        slug: 'new-tenant',
        planTier: 'pro',
        contactEmail: 'owner@newtenant.test',
      });

      expect(result.name).toBe('New Tenant');
      expect(mockTenant.create).toHaveBeenCalledWith({
        data: {
          name: 'New Tenant',
          slug: 'new-tenant',
          planTier: 'pro',
          contactEmail: 'owner@newtenant.test',
        },
      });
      expect(mockTenantConfig.create).toHaveBeenCalledWith({
        data: { tenantId: 'tenant-new' },
      });
      expect(mockRole.create).toHaveBeenCalled();
    });

    it('throws ConflictException on duplicate slug', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'super-admin',
        isSuperAdmin: true,
      });

      const duplicateError = new Error('Unique constraint failed') as Error & {
        code: string;
      };
      duplicateError.code = 'P2002';
      mockTenant.create.mockRejectedValue(duplicateError);

      await expect(
        service.createTenant({
          name: 'Duplicate Tenant',
          slug: 'duplicate-slug',
          contactEmail: 'owner@dup.test',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateTenant', () => {
    it('updates tenant metadata for super-admin', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'super-admin',
        isSuperAdmin: true,
      });

      const existingTenant = {
        id: 'tenant-1',
        name: 'Old Name',
        slug: 'tenant-1',
        planTier: 'basic',
        contactEmail: 'old@test.com',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedTenant = {
        ...existingTenant,
        name: 'Updated Name',
        planTier: 'enterprise',
      };

      mockTenant.findUnique.mockResolvedValue(existingTenant);
      mockTenant.update.mockResolvedValue(updatedTenant);

      const result = await service.updateTenant('tenant-1', {
        name: 'Updated Name',
        planTier: 'enterprise',
      });

      expect(result.name).toBe('Updated Name');
      expect(mockTenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { name: 'Updated Name', planTier: 'enterprise' },
      });
    });

    it('throws BadRequestException when tenant not found', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'super-admin',
        isSuperAdmin: true,
      });

      mockTenant.findUnique.mockResolvedValue(null);

      await expect(
        service.updateTenant('nonexistent', { name: 'New Name' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deactivateTenant', () => {
    it('sets isActive to false for super-admin', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'super-admin',
        isSuperAdmin: true,
      });

      const deactivatedTenant = {
        id: 'tenant-1',
        name: 'Tenant 1',
        slug: 'tenant-1',
        planTier: 'basic',
        contactEmail: 'owner@tenant-1.test',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockTenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'Tenant 1',
        slug: 'tenant-1',
        planTier: 'basic',
        contactEmail: 'owner@tenant-1.test',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockTenant.update.mockResolvedValue(deactivatedTenant);

      const result = await service.deactivateTenant('tenant-1');

      expect(result.isActive).toBe(false);
      expect(mockTenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { isActive: false },
      });
    });
  });

  describe('tenants pagination and filtering', () => {
    it('applies string filter to tenant name in tenants query', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'super-admin',
        isSuperAdmin: true,
      });

      mockTenant.count.mockResolvedValue(1);
      mockTenant.findMany.mockResolvedValue([
        {
          id: 'tenant-1',
          name: 'Acme Corp',
          slug: 'acme',
          planTier: 'basic',
          contactEmail: 'acme@test.com',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      mockUser.count.mockResolvedValue(5);

      const result = (await service.tenants({
        filter: {
          name: { contains: 'Acme' },
        },
      })) as { totalCount: number };

      expect(mockTenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: {
              contains: 'Acme',
              mode: 'insensitive',
            },
          },
        }),
      );
      expect(result.totalCount).toBe(1);
    });

    it('applies isActive filter to tenants query', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'super-admin',
        isSuperAdmin: true,
      });

      mockTenant.count.mockResolvedValue(1);
      mockTenant.findMany.mockResolvedValue([]);
      mockUser.count.mockResolvedValue(0);

      await service.tenants({
        filter: {
          isActive: false,
        },
      });

      expect(mockTenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: false },
        }),
      );
    });

    it('orders tenants by name ascending', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'super-admin',
        isSuperAdmin: true,
      });

      mockTenant.count.mockResolvedValue(2);
      mockTenant.findMany.mockResolvedValue([
        {
          id: 't1',
          name: 'Alpha',
          slug: 'alpha',
          planTier: 'basic',
          contactEmail: 'a@test.com',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 't2',
          name: 'Beta',
          slug: 'beta',
          planTier: 'basic',
          contactEmail: 'b@test.com',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      mockUser.count.mockResolvedValue(0);

      await service.tenants({
        orderBy: {
          field: 'name',
          direction: SortDirection.ASC,
        },
      });

      expect(mockTenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        }),
      );
    });
  });

  describe('myTenant', () => {
    it('returns UNAUTHORIZED when no tenant context', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: undefined,
        isSuperAdmin: false,
      });

      await expect(service.myTenant()).rejects.toThrow(UnauthorizedException);
    });

    it('returns tenant with logoUrl from config', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        userId: 'user-1',
        isSuperAdmin: false,
      });

      mockTenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'My Tenant',
        slug: 'my-tenant',
        planTier: 'basic',
        contactEmail: 'admin@mytenant.com',
        isActive: true,
        config: {
          logoUrl: 'https://cdn.example.com/tenant-logo.png',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.myTenant();

      expect(result.logoUrl).toBe('https://cdn.example.com/tenant-logo.png');
    });

    it('returns tenant with undefined logoUrl when config has null logoUrl', async () => {
      (getTenantContext as jest.Mock).mockReturnValue({
        tenantId: 'tenant-1',
        userId: 'user-1',
        isSuperAdmin: false,
      });

      mockTenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'My Tenant',
        slug: 'my-tenant',
        planTier: 'basic',
        contactEmail: 'admin@mytenant.com',
        isActive: true,
        config: {
          logoUrl: null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.myTenant();

      expect(result.logoUrl).toBeUndefined();
    });
  });
});
