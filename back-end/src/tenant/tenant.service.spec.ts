import { BadRequestException, UnauthorizedException } from '@nestjs/common';
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
    user: {
      count: jest.fn(),
    },
  } as unknown as PrismaService;

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
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrismaService.tenant.findUnique = findUniqueMock;

    const tenant = await service.myTenant();

    expect(tenant.id).toBe('tenant-1');
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
    });
  });

  it('returns tenant list with user counts for super-admin', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-admin',
      isSuperAdmin: true,
    });

    mockPrismaService.tenant.findMany = jest.fn().mockResolvedValue([
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
    mockPrismaService.tenant.findMany = jest.fn().mockResolvedValue([
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
    mockPrismaService.user.count = jest.fn().mockResolvedValue(1);

    const result = await service.tenants({
      pagination: {
        page: 1,
        limit: 200,
      },
    });

    expect(result.pageInfo.limit).toBe(100);
    expect(mockPrismaService.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 100,
      }),
    );
  });
});
