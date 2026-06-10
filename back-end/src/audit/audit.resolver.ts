import { ForbiddenException } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { UserRole } from '@prisma/client';
import { getTenantContext } from '../tenant/tenant-context.storage';
import { AuditLogsPayload, AuditLogsQueryInput } from './audit.types';
import { AuditService } from './audit.service';

@Resolver()
export class AuditResolver {
  constructor(private readonly auditService: AuditService) {}

  @Query(() => AuditLogsPayload)
  async auditLogs(
    @Args('query', { nullable: true }) query?: AuditLogsQueryInput,
  ): Promise<AuditLogsPayload> {
    const context = getTenantContext();
    if (!context?.tenantId || !context.userId) {
      throw new ForbiddenException('UNAUTHORIZED');
    }

    if (!context.isSuperAdmin && context.role !== UserRole.TENANT_ADMIN) {
      throw new ForbiddenException('FORBIDDEN');
    }

    const result = await this.auditService.getAuditLogs(context.tenantId, query ?? {});

    return {
      data: result.data.map((entry) => ({
        id: entry.id,
        tenantId: entry.tenantId,
        actorId: entry.actorId ?? undefined,
        actorEmail: entry.actorEmail ?? undefined,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        diff: entry.diff ? JSON.stringify(entry.diff) : undefined,
        ipAddress: entry.ipAddress ?? undefined,
        createdAt: entry.createdAt,
      })),
      auditLogs: result.data.map((entry) => ({
        id: entry.id,
        tenantId: entry.tenantId,
        actorId: entry.actorId ?? undefined,
        actorEmail: entry.actorEmail ?? undefined,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        diff: entry.diff ? JSON.stringify(entry.diff) : undefined,
        ipAddress: entry.ipAddress ?? undefined,
        createdAt: entry.createdAt,
      })),
      totalCount: result.totalCount,
      pageInfo: {
        total: result.totalCount,
        page: result.page,
        limit: result.limit,
        totalPages:
          result.totalCount === 0
            ? 0
            : Math.ceil(result.totalCount / result.limit),
      },
    };
  }
}
