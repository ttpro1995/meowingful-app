import { Test, TestingModule } from '@nestjs/testing';
import { PermissionService } from './permission.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { PrismaService } from '../prisma/prisma.service';
import { RoleName } from '@prisma/client';

describe('PermissionService', () => {
  let service: PermissionService;
  let mockPrisma: {
    user: { findUnique: jest.Mock; findMany: jest.Mock };
    role: { findFirst: jest.Mock };
    userTenantRole: { findMany: jest.Mock };
  };
  let mockRedis: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      role: {
        findFirst: jest.fn(),
      },
      userTenantRole: {
        findMany: jest.fn(),
      },
    };

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<PermissionService>(PermissionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserPermissions', () => {
    it('should return cached permissions when available', async () => {
      const cachedPerms = JSON.stringify(['lead:create', 'lead:delete']);
      mockRedis.get.mockResolvedValue(cachedPerms);

      const result = await service.getUserPermissions('tenant-1', 'user-1');

      expect(result).toEqual(['lead:create', 'lead:delete']);
      expect(mockRedis.get).toHaveBeenCalledWith('perm:tenant-1:user-1');
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.userTenantRole.findMany).not.toHaveBeenCalled();
    });

    it('should load and cache permissions when not cached', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userTenantRole.findMany.mockResolvedValue([
        {
          role: {
            permissions: [{ permission: { code: 'lead:create' } }],
          },
        },
      ]);
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.getUserPermissions('tenant-1', 'user-1');

      expect(result).toEqual(['lead:create']);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'perm:tenant-1:user-1',
        JSON.stringify(['lead:create']),
        'EX',
        60,
      );
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should fall back to legacy role mapping when membership rows are missing', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userTenantRole.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'SUPER_ADMIN',
      });
      mockPrisma.role.findFirst.mockResolvedValue({
        id: 'role-1',
        name: RoleName.SUPER_ADMIN,
        permissions: [{ permission: { code: 'tenant:manage' } }],
      });

      const result = await service.getUserPermissions('tenant-1', 'user-1');

      expect(result).toEqual(['tenant:manage']);
    });

    it('should return empty array when user not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userTenantRole.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getUserPermissions('tenant-1', 'user-1');

      expect(result).toEqual([]);
    });

    it('should return empty array when user role has no mapping', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userTenantRole.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'USER',
      });

      const result = await service.getUserPermissions('tenant-1', 'user-1');

      expect(result).toEqual([]);
      expect(mockPrisma.role.findFirst).not.toHaveBeenCalled();
    });

    it('should return empty array when role not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.userTenantRole.findMany.mockResolvedValue([]);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'TENANT_ADMIN',
      });
      mockPrisma.role.findFirst.mockResolvedValue(null);

      const result = await service.getUserPermissions('tenant-1', 'user-1');

      expect(result).toEqual([]);
    });
  });

  describe('invalidateUserPermissions', () => {
    it('should delete the cache key for user', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.invalidateUserPermissions('tenant-1', 'user-1');

      expect(mockRedis.del).toHaveBeenCalledWith('perm:tenant-1:user-1');
    });
  });

  describe('invalidateRolePermissions', () => {
    it('should invalidate permissions for all users with the role', async () => {
      mockPrisma.userTenantRole.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-2', role: 'TENANT_ADMIN' },
        { id: 'user-3', role: 'TENANT_ADMIN' },
      ]);

      await service.invalidateRolePermissions(
        'tenant-1',
        RoleName.TENANT_ADMIN,
      );

      expect(mockPrisma.userTenantRole.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          role: {
            name: RoleName.TENANT_ADMIN,
          },
        },
        select: { userId: true },
        distinct: ['userId'],
      });
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', role: RoleName.TENANT_ADMIN },
        select: { id: true },
      });
      expect(mockRedis.del).toHaveBeenCalledTimes(3);
    });
  });
});
