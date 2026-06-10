import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { PermissionService } from '../rbac/permission.service';
import { getTenantContext } from '../tenant/tenant-context.storage';
import { RoleName, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PubSub } from 'graphql-subscriptions';
import {
  DEFAULT_DASHBOARD_DATE_RANGE,
  DashboardDateRangeInput,
  DashboardDateRangePreset,
  DashboardMetrics,
  DashboardMetricsSnapshot,
  DashboardTenantCache,
} from './dashboard.types';
import {
  DASHBOARD_METRICS_UPDATED_TOPIC,
  DASHBOARD_PUB_SUB,
} from './dashboard.constants';

interface AuthenticatedContext {
  tenantId: string;
  userId: string;
  role: UserRole;
  isSuperAdmin: boolean;
}

@Injectable()
export class DashboardService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DashboardService.name);
  private readonly refreshIntervalMs = 60_000;
  private readonly dashboardCacheTtlSeconds = 5 * 60;
  private refreshIntervalHandle: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly permissionService: PermissionService,
    @Inject(DASHBOARD_PUB_SUB)
    private readonly pubSub: PubSub<Record<string, unknown>>,
  ) {}

  onModuleInit(): void {
    this.refreshIntervalHandle = setInterval(() => {
      void this.refreshAllTenantsMetrics();
    }, this.refreshIntervalMs);

    void this.refreshAllTenantsMetrics();
  }

  onModuleDestroy(): void {
    if (this.refreshIntervalHandle) {
      clearInterval(this.refreshIntervalHandle);
      this.refreshIntervalHandle = null;
    }
  }

  async dashboardMetrics(input?: DashboardDateRangeInput): Promise<DashboardMetrics> {
    const context = this.getAuthenticatedContext();
    await this.assertDashboardAccess(context);

    const dateRange = this.resolveDateRange(input);
    const payload = await this.getCachedTenantDashboard(context.tenantId);

    return this.buildDashboardMetrics(payload, dateRange);
  }

  asyncIterator(): AsyncIterableIterator<Record<string, unknown>> {
    return this.pubSub.asyncIterableIterator(DASHBOARD_METRICS_UPDATED_TOPIC);
  }

  async recordUserJoined(tenantId: string, actor: string): Promise<void> {
    const payload = await this.getCachedTenantDashboard(tenantId);

    payload.recentActivity = [
      {
        id: randomUUID(),
        type: 'USER_JOINED',
        actor,
        timestamp: new Date().toISOString(),
      },
      ...payload.recentActivity,
    ].slice(0, 10);

    this.bumpMetricForAllRanges(payload, 'activeUsers', 1);
    payload.updatedAt = new Date().toISOString();

    await this.persistAndPublish(tenantId, payload);
  }

  async recordCoursePublished(tenantId: string, actor: string): Promise<void> {
    const payload = await this.getCachedTenantDashboard(tenantId);

    payload.recentActivity = [
      {
        id: randomUUID(),
        type: 'COURSE_PUBLISHED',
        actor,
        timestamp: new Date().toISOString(),
      },
      ...payload.recentActivity,
    ].slice(0, 10);

    this.bumpMetricForAllRanges(payload, 'publishedCourses', 1);
    payload.updatedAt = new Date().toISOString();

    await this.persistAndPublish(tenantId, payload);
  }

  async recordLeadConverted(tenantId: string, actor: string): Promise<void> {
    const payload = await this.getCachedTenantDashboard(tenantId);

    payload.recentActivity = [
      {
        id: randomUUID(),
        type: 'LEAD_CONVERTED',
        actor,
        timestamp: new Date().toISOString(),
      },
      ...payload.recentActivity,
    ].slice(0, 10);

    payload.updatedAt = new Date().toISOString();

    await this.persistAndPublish(tenantId, payload);
  }

  async refreshAllTenantsMetrics(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    await Promise.all(
      tenants.map(async ({ id }) => {
        try {
          await this.refreshTenantMetrics(id);
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : 'unknown refresh error';
          this.logger.warn(
            `Dashboard metrics refresh failed for tenant ${id}: ${message}`,
          );
        }
      }),
    );
  }

  async refreshTenantMetrics(tenantId: string): Promise<void> {
    const [last7Days, last30Days, last90Days, payload] = await Promise.all([
      this.computeMetricsSnapshot(tenantId, DashboardDateRangePreset.LAST_7_DAYS),
      this.computeMetricsSnapshot(tenantId, DashboardDateRangePreset.LAST_30_DAYS),
      this.computeMetricsSnapshot(tenantId, DashboardDateRangePreset.LAST_90_DAYS),
      this.getCachedTenantDashboard(tenantId),
    ]);

    const nextPayload: DashboardTenantCache = {
      metrics: {
        [DashboardDateRangePreset.LAST_7_DAYS]: last7Days,
        [DashboardDateRangePreset.LAST_30_DAYS]: last30Days,
        [DashboardDateRangePreset.LAST_90_DAYS]: last90Days,
      },
      recentActivity: payload.recentActivity.slice(0, 10),
      updatedAt: new Date().toISOString(),
    };

    await this.persistAndPublish(tenantId, nextPayload);
  }

  private async persistAndPublish(
    tenantId: string,
    payload: DashboardTenantCache,
  ): Promise<void> {
    await this.cacheService.set(
      this.cacheKey(tenantId),
      JSON.stringify(payload),
      this.dashboardCacheTtlSeconds,
    );

    for (const dateRange of [
      DashboardDateRangePreset.LAST_7_DAYS,
      DashboardDateRangePreset.LAST_30_DAYS,
      DashboardDateRangePreset.LAST_90_DAYS,
    ]) {
      const metrics = this.buildDashboardMetrics(payload, dateRange);

      await this.pubSub.publish(DASHBOARD_METRICS_UPDATED_TOPIC, {
        dashboardMetricsUpdated: {
          tenantId,
          dateRange,
          metrics,
        },
      });
    }
  }

  private cacheKey(tenantId: string): string {
    return `dashboard:${tenantId}`;
  }

  private resolveDateRange(
    input?: DashboardDateRangeInput,
  ): DashboardDateRangePreset {
    return input?.preset ?? DEFAULT_DASHBOARD_DATE_RANGE;
  }

  private getDaysForRange(range: DashboardDateRangePreset): number {
    switch (range) {
      case DashboardDateRangePreset.LAST_7_DAYS:
        return 7;
      case DashboardDateRangePreset.LAST_90_DAYS:
        return 90;
      case DashboardDateRangePreset.LAST_30_DAYS:
      default:
        return 30;
    }
  }

  private getSinceDate(range: DashboardDateRangePreset): Date {
    const days = this.getDaysForRange(range);
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }

  private emptySnapshot(): DashboardMetricsSnapshot {
    return {
      activeUsers: 0,
      totalStudents: 0,
      publishedCourses: 0,
      monthlyRevenue: 0,
    };
  }

  private emptyPayload(): DashboardTenantCache {
    return {
      metrics: {
        [DashboardDateRangePreset.LAST_7_DAYS]: this.emptySnapshot(),
        [DashboardDateRangePreset.LAST_30_DAYS]: this.emptySnapshot(),
        [DashboardDateRangePreset.LAST_90_DAYS]: this.emptySnapshot(),
      },
      recentActivity: [],
      updatedAt: new Date().toISOString(),
    };
  }

  private normalizeSnapshot(
    snapshot: DashboardMetricsSnapshot | undefined,
  ): DashboardMetricsSnapshot {
    if (!snapshot) {
      return this.emptySnapshot();
    }

    return {
      activeUsers: Number(snapshot.activeUsers) || 0,
      totalStudents: Number(snapshot.totalStudents) || 0,
      publishedCourses: Number(snapshot.publishedCourses) || 0,
      monthlyRevenue: Number(snapshot.monthlyRevenue) || 0,
    };
  }

  private parseCachedPayload(cached: string | null): DashboardTenantCache {
    if (!cached) {
      return this.emptyPayload();
    }

    try {
      const parsed = JSON.parse(cached) as Partial<DashboardTenantCache>;
      const recentActivity = Array.isArray(parsed.recentActivity)
        ? parsed.recentActivity
            .filter(
              (event) =>
                event &&
                typeof event.id === 'string' &&
                typeof event.type === 'string' &&
                typeof event.actor === 'string' &&
                typeof event.timestamp === 'string',
            )
            .slice(0, 10)
        : [];

      return {
        metrics: {
          [DashboardDateRangePreset.LAST_7_DAYS]: this.normalizeSnapshot(
            parsed.metrics?.[DashboardDateRangePreset.LAST_7_DAYS],
          ),
          [DashboardDateRangePreset.LAST_30_DAYS]: this.normalizeSnapshot(
            parsed.metrics?.[DashboardDateRangePreset.LAST_30_DAYS],
          ),
          [DashboardDateRangePreset.LAST_90_DAYS]: this.normalizeSnapshot(
            parsed.metrics?.[DashboardDateRangePreset.LAST_90_DAYS],
          ),
        },
        recentActivity,
        updatedAt:
          typeof parsed.updatedAt === 'string'
            ? parsed.updatedAt
            : new Date().toISOString(),
      };
    } catch {
      return this.emptyPayload();
    }
  }

  private async getCachedTenantDashboard(
    tenantId: string,
  ): Promise<DashboardTenantCache> {
    const cached = await this.cacheService.get(this.cacheKey(tenantId));
    return this.parseCachedPayload(cached);
  }

  private buildDashboardMetrics(
    payload: DashboardTenantCache,
    dateRange: DashboardDateRangePreset,
  ): DashboardMetrics {
    const metrics = this.normalizeSnapshot(payload.metrics[dateRange]);
    const sinceDate = this.getSinceDate(dateRange);

    return {
      activeUsers: metrics.activeUsers,
      totalStudents: metrics.totalStudents,
      publishedCourses: metrics.publishedCourses,
      monthlyRevenue: metrics.monthlyRevenue,
      recentActivity: payload.recentActivity
        .filter((event) => new Date(event.timestamp).getTime() >= sinceDate.getTime())
        .slice(0, 10)
        .map((event) => ({
          ...event,
          timestamp: new Date(event.timestamp),
        })),
    };
  }

  private bumpMetricForAllRanges(
    payload: DashboardTenantCache,
    metricKey: keyof DashboardMetricsSnapshot,
    delta: number,
  ): void {
    for (const range of [
      DashboardDateRangePreset.LAST_7_DAYS,
      DashboardDateRangePreset.LAST_30_DAYS,
      DashboardDateRangePreset.LAST_90_DAYS,
    ]) {
      const currentValue = payload.metrics[range][metricKey];
      payload.metrics[range][metricKey] = Number(currentValue) + delta;
    }
  }

  private getAuthenticatedContext(): AuthenticatedContext {
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

  private async assertDashboardAccess(
    context: AuthenticatedContext,
  ): Promise<void> {
    if (context.isSuperAdmin || context.role === UserRole.TENANT_ADMIN) {
      return;
    }

    const isDirectorOrAdminViaMembership = await this.prisma.userTenantRole.findFirst({
      where: {
        tenantId: context.tenantId,
        userId: context.userId,
        role: {
          name: {
            in: [RoleName.TENANT_ADMIN, RoleName.DIRECTOR],
          },
        },
      },
      select: {
        userId: true,
      },
    });

    if (isDirectorOrAdminViaMembership) {
      return;
    }

    const permissions = await this.permissionService.getUserPermissions(
      context.tenantId,
      context.userId,
    );

    if (!permissions.includes('tenant:manage')) {
      throw new ForbiddenException('FORBIDDEN');
    }
  }

  private async computeMetricsSnapshot(
    tenantId: string,
    dateRange: DashboardDateRangePreset,
  ): Promise<DashboardMetricsSnapshot> {
    const since = this.getSinceDate(dateRange);

    const [activeUsers, totalStudents] = await Promise.all([
      this.prisma.user.count({
        where: {
          tenantId,
          deletedAt: null,
          createdAt: {
            gte: since,
          },
        },
      }),
      this.prisma.userTenantRole.count({
        where: {
          tenantId,
          role: {
            name: RoleName.STUDENT,
          },
          user: {
            deletedAt: null,
            createdAt: {
              gte: since,
            },
          },
        },
      }),
    ]);

    return {
      activeUsers,
      totalStudents,
      publishedCourses: 0,
      monthlyRevenue: 0,
    };
  }
}
