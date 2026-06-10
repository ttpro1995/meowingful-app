import { Module } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { DashboardResolver } from './dashboard.resolver';
import { DashboardService } from './dashboard.service';
import { DASHBOARD_PUB_SUB } from './dashboard.constants';

@Module({
  providers: [
    DashboardResolver,
    DashboardService,
    {
      provide: DASHBOARD_PUB_SUB,
      useFactory: () => new PubSub(),
    },
  ],
  exports: [DashboardService],
})
export class DashboardModule {}
