import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { DateFilter, EnumFilter, StringFilter } from '../shared/pagination/filter.types';
import { SortDirection } from '../shared/pagination/pagination.args';
import { paginate } from '../shared/pagination/paginate';
import { runWithTenantContext } from '../tenant/tenant-context.storage';
import {
  AUDIT_ARCHIVE_RETENTION_DAYS,
  AUDIT_QUEUE_NAME,
  AUDIT_QUEUE_TOKEN,
  AUDIT_WORKER_TOKEN,
} from './audit.constants';
import { AuditLogJobPayload, AuditLogsQueryInput } from './audit.types';

interface QueueConnectionOptions {
  host: string;
  port: number;
  password?: string;
}

interface AuditQueueLike {
  add(name: string, data: AuditLogJobPayload): Promise<unknown>;
  close(): Promise<void>;
}

interface AuditWorkerLike {
  close(): Promise<void>;
}

@Injectable()
export class AuditService implements OnModuleDestroy {
  private static readonly staticLogger = new Logger(AuditService.name);
  private readonly logger = new Logger(AuditService.name);
  private readonly sortableFields = new Set(['createdAt', 'resource', 'action']);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_QUEUE_TOKEN) private readonly queue: AuditQueueLike,
    @Inject(AUDIT_WORKER_TOKEN) private readonly worker: AuditWorkerLike,
  ) {}

  static getQueueConnection(redis: Redis): QueueConnectionOptions {
    const options = redis.options;

    return {
      host: typeof options.host === 'string' ? options.host : 'localhost',
      port: typeof options.port === 'number' ? options.port : 6379,
      ...(typeof options.password === 'string' && options.password
        ? { password: options.password }
        : {}),
    };
  }

  static async persistAuditLog(
    prisma: PrismaService,
    payload: AuditLogJobPayload,
  ): Promise<void> {
    try {
      await runWithTenantContext(null, async () => {
        await prisma.auditLog.create({
          data: {
            tenantId: payload.tenantId,
            actorId: payload.actorId,
            actorEmail: payload.actorEmail,
            action: payload.action,
            resource: payload.resource,
            resourceId: payload.resourceId,
            diff: payload.diff
              ? (payload.diff as Prisma.InputJsonObject)
              : undefined,
            ipAddress: payload.ipAddress,
          },
        });
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021'
      ) {
        AuditService.staticLogger.warn(
          'AuditLog table is missing; skipping audit persistence until migrations are applied',
        );
        return;
      }

      throw error;
    }
  }

  static buildQueue(redis: Redis): Queue<AuditLogJobPayload> {
    return new Queue<AuditLogJobPayload>(AUDIT_QUEUE_NAME, {
      connection: AuditService.getQueueConnection(redis),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 250,
        },
        removeOnComplete: false,
      },
    });
  }

  static buildWorker(
    redis: Redis,
    prisma: PrismaService,
  ): Worker<AuditLogJobPayload> {
    return new Worker<AuditLogJobPayload>(
      AUDIT_QUEUE_NAME,
      async (job: Job<AuditLogJobPayload>) => {
        await AuditService.persistAuditLog(prisma, job.data);
      },
      {
        connection: AuditService.getQueueConnection(redis),
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.worker.close(), this.queue.close()]);
  }

  async log(entry: AuditLogJobPayload): Promise<void> {
    try {
      await this.queue.add('audit-log', entry);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to enqueue audit log: ${message}`);
    }
  }

  async logLoginEvent(params: {
    tenantId: string;
    username: string;
    actorId?: string;
    action: AuditAction;
    ipAddress?: string | null;
  }): Promise<void> {
    await this.log({
      tenantId: params.tenantId,
      actorId: params.actorId,
      actorEmail: params.username,
      action: params.action,
      resource: 'Auth',
      resourceId: params.actorId ?? params.username,
      diff: null,
      ipAddress: params.ipAddress,
    });
  }

  async archiveExpiredLogs(): Promise<number> {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - AUDIT_ARCHIVE_RETENTION_DAYS);

    try {
      const result = await this.prisma.auditLog.updateMany({
        where: {
          createdAt: {
            lt: cutoff,
          },
          archivedAt: null,
        },
        data: {
          archivedAt: new Date(),
        },
      });

      return result.count;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021'
      ) {
        this.logger.warn(
          'AuditLog table is missing; archive job skipped until migrations are applied',
        );
        return 0;
      }

      throw error;
    }
  }

  private parseAction(value: string): AuditAction {
    const parsed = Object.values(AuditAction).find((entry) => entry === value);
    if (!parsed) {
      throw new BadRequestException(`Invalid action filter value: ${value}`);
    }

    return parsed;
  }

  private toStringFilter(filter?: StringFilter): Prisma.StringFilter | undefined {
    if (!filter) {
      return undefined;
    }

    const where: Prisma.StringFilter = {
      mode: 'insensitive',
    };

    if (filter.equals) {
      where.equals = filter.equals;
    }

    if (filter.contains) {
      where.contains = filter.contains;
    }

    if (filter.startsWith) {
      where.startsWith = filter.startsWith;
    }

    if (filter.endsWith) {
      where.endsWith = filter.endsWith;
    }

    if (filter.in && filter.in.length > 0) {
      where.in = filter.in;
    }

    return Object.keys(where).length > 1 ? where : undefined;
  }

  private toDateFilter(filter?: DateFilter): Prisma.DateTimeFilter | undefined {
    if (!filter) {
      return undefined;
    }

    const where: Prisma.DateTimeFilter = {};

    if (filter.equals) {
      where.equals = new Date(filter.equals);
    }

    if (filter.gt) {
      where.gt = new Date(filter.gt);
    }

    if (filter.gte) {
      where.gte = new Date(filter.gte);
    }

    if (filter.lt) {
      where.lt = new Date(filter.lt);
    }

    if (filter.lte) {
      where.lte = new Date(filter.lte);
    }

    return Object.keys(where).length > 0 ? where : undefined;
  }

  private toActionFilter(
    filter?: EnumFilter,
  ): Prisma.EnumAuditActionFilter | undefined {
    if (!filter) {
      return undefined;
    }

    const where: Prisma.EnumAuditActionFilter = {};

    if (filter.equals) {
      where.equals = this.parseAction(filter.equals);
    }

    if (filter.in && filter.in.length > 0) {
      where.in = filter.in.map((value) => this.parseAction(value));
    }

    return Object.keys(where).length > 0 ? where : undefined;
  }

  private toOrderBy(
    field: string | undefined,
    direction: SortDirection | undefined,
  ): Prisma.AuditLogOrderByWithRelationInput {
    const orderField = field ?? 'createdAt';
    if (!this.sortableFields.has(orderField)) {
      throw new BadRequestException(`Unsupported orderBy.field: ${orderField}`);
    }

    return {
      [orderField]: direction === SortDirection.DESC ? 'desc' : 'asc',
    };
  }

  async getAuditLogs(tenantId: string, query: AuditLogsQueryInput = {}): Promise<{
    data: Prisma.AuditLogGetPayload<object>[];
    totalCount: number;
    page: number;
    limit: number;
  }> {
    const requestedLimit =
      query.pagination?.limit ?? query.first ?? query.last ?? undefined;
    const requestedPage = query.pagination?.page ?? 1;
    const { page, limit, skip, take } = paginate(requestedPage, requestedLimit);

    const where: Prisma.AuditLogWhereInput = {
      tenantId,
      actorId: this.toStringFilter(query.filter?.actorId),
      resource: this.toStringFilter(query.filter?.resource),
      action: this.toActionFilter(query.filter?.action),
      createdAt: this.toDateFilter(query.filter?.createdAt),
    };

    let data: Prisma.AuditLogGetPayload<object>[] = [];
    let totalCount = 0;

    try {
      [data, totalCount] = await this.prisma.$transaction([
        this.prisma.auditLog.findMany({
          where,
          orderBy: this.toOrderBy(query.orderBy?.field, query.orderBy?.direction),
          skip,
          take,
        }),
        this.prisma.auditLog.count({ where }),
      ]);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021'
      ) {
        this.logger.warn(
          'AuditLog table is missing; returning empty audit result until migrations are applied',
        );
      } else {
        throw error;
      }
    }

    return {
      data,
      totalCount,
      page,
      limit,
    };
  }
}

export const auditQueueProvider = {
  provide: AUDIT_QUEUE_TOKEN,
  inject: [REDIS_CLIENT, PrismaService],
  useFactory: (redis: Redis, prisma: PrismaService): AuditQueueLike => {
    if (process.env.NODE_ENV === 'test') {
      return {
        add: async (_name: string, data: AuditLogJobPayload) => {
          await AuditService.persistAuditLog(prisma, data);
        },
        close: async () => {
          return;
        },
      };
    }

    return AuditService.buildQueue(redis);
  },
};

export const auditWorkerProvider = {
  provide: AUDIT_WORKER_TOKEN,
  inject: [REDIS_CLIENT, PrismaService],
  useFactory: (redis: Redis, prisma: PrismaService): AuditWorkerLike => {
    if (process.env.NODE_ENV === 'test') {
      return {
        close: async () => {
          return;
        },
      };
    }

    const worker = AuditService.buildWorker(redis, prisma);
    worker.on('failed', (job, error) => {
      const jobId = job?.id ?? 'unknown';
      const logger = new Logger('AuditWorker');
      logger.error(`Audit job ${jobId} failed: ${error.message}`);
    });

    return worker;
  },
};
