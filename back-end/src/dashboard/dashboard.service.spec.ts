import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PubSub } from 'graphql-subscriptions';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { PermissionService } from '../rbac/permission.service';
import { DashboardService } from './dashboard.service';
import { DashboardDateRangePreset } from './dashboard.types';
import { getTenantContext } from '../tenant/tenant-context.storage';

jest.mock('../tenant/tenant-context.storage', () => ({
  getTenantContext: jest.fn(),
}));

describe('DashboardService', () => {
  const cacheGet = jest.fn();
  const cacheSet = jest.fn();
  const getUserPermissions = jest.fn();
  const tenantFindMany = jest.fn();
  const userCount = jest.fn();
  const userTenantRoleCount = jest.fn();
  const userTenantRoleFindFirst = jest.fn();
  const pubSubPublish = jest.fn();

  const mockPrisma = {
    tenant: {
      findMany: tenantFindMany,
    },
    user: {
      count: userCount,
    },
    userTenantRole: {
      count: userTenantRoleCount,
      findFirst: userTenantRoleFindFirst,
    },
  } as unknown as PrismaService;

  const mockCache = {
    get: cacheGet,
    set: cacheSet,
  } as unknown as CacheService;

  const mockPermissionService = {
    getUserPermissions,
  } as unknown as PermissionService;

  const mockPubSub = {
    publish: pubSubPublish,
    asyncIterableIterator: jest.fn(),
  } as unknown as PubSub<{ dashboardMetricsUpdated: unknown }>;

  let service: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DashboardService(
      mockPrisma,
      mockCache,
      mockPermissionService,
      mockPubSub,
    );
  });

  it('returns cached metrics for a director member', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'user-1',
      role: UserRole.USER,
      isSuperAdmin: false,
    });
    userTenantRoleFindFirst.mockResolvedValue({ userId: 'user-1' });
    cacheGet.mockResolvedValue(
      JSON.stringify({
        metrics: {
          LAST_7_DAYS: {
            activeUsers: 2,
            totalStudents: 1,
            publishedCourses: 0,
            monthlyRevenue: 0,
          },
          LAST_30_DAYS: {
            activeUsers: 8,
            totalStudents: 3,
            publishedCourses: 0,
            monthlyRevenue: 0,
          },
          LAST_90_DAYS: {
            activeUsers: 21,
            totalStudents: 8,
            publishedCourses: 0,
            monthlyRevenue: 0,
          },
        },
        recentActivity: [
          {
            id: 'evt-1',
            type: 'USER_JOINED',
            actor: 'jane',
            timestamp: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      }),
    );

    const result = await service.dashboardMetrics({
      preset: DashboardDateRangePreset.LAST_30_DAYS,
    });

    expect(result.activeUsers).toBe(8);
    expect(result.totalStudents).toBe(3);
    expect(result.recentActivity).toHaveLength(1);
  });

  it('throws FORBIDDEN for non-admin/non-director users', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'user-2',
      role: UserRole.USER,
      isSuperAdmin: false,
    });
    userTenantRoleFindFirst.mockResolvedValue(null);
    getUserPermissions.mockResolvedValue([]);

    await expect(service.dashboardMetrics()).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws UNAUTHORIZED when tenant context is missing', async () => {
    (getTenantContext as jest.Mock).mockReturnValue(null);

    await expect(service.dashboardMetrics()).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refreshes tenant metrics and publishes updates for all date ranges', async () => {
    cacheGet.mockResolvedValue(null);
    userCount
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(16);
    userTenantRoleCount
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(11);

    await service.refreshTenantMetrics('tenant-1');

    expect(cacheSet).toHaveBeenCalledTimes(1);
    expect(cacheSet).toHaveBeenCalledWith(
      'dashboard:tenant-1',
      expect.any(String),
      300,
    );
    expect(pubSubPublish).toHaveBeenCalledTimes(3);
  });

  it('records user joined activity and increments active users', async () => {
    cacheGet.mockResolvedValue(
      JSON.stringify({
        metrics: {
          LAST_7_DAYS: {
            activeUsers: 1,
            totalStudents: 0,
            publishedCourses: 0,
            monthlyRevenue: 0,
          },
          LAST_30_DAYS: {
            activeUsers: 4,
            totalStudents: 1,
            publishedCourses: 0,
            monthlyRevenue: 0,
          },
          LAST_90_DAYS: {
            activeUsers: 10,
            totalStudents: 3,
            publishedCourses: 0,
            monthlyRevenue: 0,
          },
        },
        recentActivity: [],
        updatedAt: new Date().toISOString(),
      }),
    );

    await service.recordUserJoined('tenant-1', 'new-user');

    const payload = JSON.parse(cacheSet.mock.calls[0][1] as string) as {
      metrics: {
        LAST_7_DAYS: { activeUsers: number };
        LAST_30_DAYS: { activeUsers: number };
        LAST_90_DAYS: { activeUsers: number };
      };
      recentActivity: Array<{ type: string; actor: string }>;
    };

    expect(payload.metrics.LAST_7_DAYS.activeUsers).toBe(2);
    expect(payload.metrics.LAST_30_DAYS.activeUsers).toBe(5);
    expect(payload.metrics.LAST_90_DAYS.activeUsers).toBe(11);
    expect(payload.recentActivity[0].type).toBe('USER_JOINED');
    expect(payload.recentActivity[0].actor).toBe('new-user');
  });
});
