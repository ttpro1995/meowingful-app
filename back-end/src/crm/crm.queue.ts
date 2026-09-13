import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { CrmService } from './crm.service';

export const CRM_EVENT_QUEUE_TOKEN = 'CRM_EVENT_QUEUE';
export const CRM_EVENT_QUEUE_NAME = 'crm-events';

export interface CrmEventQueue {
  add(name: string, data: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

@Injectable()
export class CrmScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CrmScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly crmService: CrmService) {}

  onModuleInit(): void {
    this.timer = setInterval(
      () => {
        void this.crmService.checkSlaBreaches().catch((error: unknown) => {
          this.logger.error(
            `SLA check failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      },
      15 * 60 * 1000,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}

@Injectable()
export class CrmQueueLifecycle implements OnModuleDestroy {
  constructor(
    @Inject(CRM_EVENT_QUEUE_TOKEN)
    private readonly queue: CrmEventQueue,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}

export const crmEventQueueProvider = {
  provide: CRM_EVENT_QUEUE_TOKEN,
  useFactory: (redis: Redis): CrmEventQueue =>
    new Queue(CRM_EVENT_QUEUE_NAME, {
      connection: {
        host:
          typeof redis.options.host === 'string'
            ? redis.options.host
            : 'localhost',
        port:
          typeof redis.options.port === 'number' ? redis.options.port : 6379,
        ...(redis.options.password ? { password: redis.options.password } : {}),
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 250 },
        removeOnComplete: false,
      },
    }),
  inject: [REDIS_CLIENT],
};
