import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { PermissionService } from './permission.service';
import { RbacResolver } from './rbac.resolver';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant-context.storage';
import { SortDirection } from '../shared/pagination/pagination.args';

jest.mock('../tenant/tenant-context.storage', () => ({
  getTenantContext: jest.fn(),
}));

describe('RbacResolver', () => {
  let resolver: RbacResolver;

  const mockPrisma = {
    role: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    permission: {
      findUnique: jest.fn(),
    },
    rolePermission: {
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockPermissionService = {
    getUserPermissions: jest.fn(),
    invalidateRolePermissions: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resolver = new RbacResolver(
      mockPrisma as unknown as PrismaService,
      mockPermissionService as unknown as PermissionService,
    );
  });

  it('returns paginated role permissions using E01-07 query contract', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      isSuperAdmin: false,
    });

    mockPrisma.role.findMany.mockResolvedValue([
      {
        name: RoleName.STAFF,
        permissions: [{ permission: { code: 'lead:create' } }],
      },
      {
        name: RoleName.SALES_MANAGER,
        permissions: [
          { permission: { code: 'lead:create' } },
          { permission: { code: 'lead:delete' } },
        ],
      },
      {
        name: RoleName.TENANT_ADMIN,
        permissions: [{ permission: { code: 'tenant:manage' } }],
      },
    ]);

    const result = await resolver.rolePermissions('tenant-1', {
      pagination: { page: 1, limit: 2 },
      orderBy: { field: 'roleName', direction: SortDirection.ASC },
      filter: {
        permissionCode: {
          contains: 'lead:',
        },
      },
    });

    expect(result.totalCount).toBe(2);
    expect(result.pageInfo).toEqual({
      total: 2,
      page: 1,
      limit: 2,
      totalPages: 1,
    });

    expect(result.data.map((entry) => entry.roleName)).toEqual([
      RoleName.SALES_MANAGER,
      RoleName.STAFF,
    ]);
    expect(result.rolePermissions).toEqual(result.data);
  });

  it('sorts by permissionCount descending', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      isSuperAdmin: false,
    });

    mockPrisma.role.findMany.mockResolvedValue([
      {
        name: RoleName.STAFF,
        permissions: [{ permission: { code: 'lead:create' } }],
      },
      {
        name: RoleName.SALES_MANAGER,
        permissions: [
          { permission: { code: 'lead:create' } },
          { permission: { code: 'lead:delete' } },
        ],
      },
    ]);

    const result = await resolver.rolePermissions('tenant-1', {
      orderBy: { field: 'permissionCount', direction: SortDirection.DESC },
    });

    expect(result.data.map((entry) => entry.roleName)).toEqual([
      RoleName.SALES_MANAGER,
      RoleName.STAFF,
    ]);
  });

  it('throws BadRequestException for unsupported orderBy field', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      isSuperAdmin: false,
    });

    mockPrisma.role.findMany.mockResolvedValue([]);

    await expect(
      resolver.rolePermissions('tenant-1', {
        orderBy: { field: 'createdAt', direction: SortDirection.ASC },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws ForbiddenException for cross-tenant access', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      isSuperAdmin: false,
    });

    await expect(resolver.rolePermissions('tenant-2')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
