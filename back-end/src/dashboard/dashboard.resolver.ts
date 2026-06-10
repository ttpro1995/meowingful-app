import { Args, Query, Resolver, Subscription } from '@nestjs/graphql';
import { DashboardService } from './dashboard.service';
import {
  DEFAULT_DASHBOARD_DATE_RANGE,
  DashboardDateRangeInput,
  DashboardMetrics,
  DashboardMetricsUpdatedEvent,
} from './dashboard.types';

interface SubscriptionContext {
  req?: {
    tenantContext?: {
      tenantId?: string;
    };
  };
}

interface DashboardSubscriptionPayload {
  dashboardMetricsUpdated: DashboardMetricsUpdatedEvent;
}

@Resolver(() => DashboardMetrics)
export class DashboardResolver {
  constructor(private readonly dashboardService: DashboardService) {}

  @Query(() => DashboardMetrics)
  async dashboardMetrics(
    @Args('dateRange', { nullable: true }) dateRange?: DashboardDateRangeInput,
  ): Promise<DashboardMetrics> {
    return this.dashboardService.dashboardMetrics(dateRange);
  }

  @Subscription(() => DashboardMetrics, {
    name: 'dashboardMetricsUpdated',
    filter: (
      payload: DashboardSubscriptionPayload,
      variables: { dateRange?: DashboardDateRangeInput },
      context: SubscriptionContext,
    ) => {
      const tenantIdFromContext = context.req?.tenantContext?.tenantId;
      const tenantIdFromEvent = payload.dashboardMetricsUpdated?.tenantId;

      if (!tenantIdFromContext || tenantIdFromContext !== tenantIdFromEvent) {
        return false;
      }

      const selectedRange =
        variables.dateRange?.preset ?? DEFAULT_DASHBOARD_DATE_RANGE;
      return payload.dashboardMetricsUpdated.dateRange === selectedRange;
    },
    resolve: (payload: DashboardSubscriptionPayload) =>
      payload.dashboardMetricsUpdated.metrics,
  })
  dashboardMetricsUpdated(
    @Args('dateRange', { nullable: true }) _dateRange?: DashboardDateRangeInput,
  ): AsyncIterableIterator<unknown> {
    return this.dashboardService.asyncIterator();
  }
}
