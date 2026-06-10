import { Field, Float, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum DashboardDateRangePreset {
  LAST_7_DAYS = 'LAST_7_DAYS',
  LAST_30_DAYS = 'LAST_30_DAYS',
  LAST_90_DAYS = 'LAST_90_DAYS',
}

registerEnumType(DashboardDateRangePreset, {
  name: 'DashboardDateRangePreset',
});

export const DEFAULT_DASHBOARD_DATE_RANGE = DashboardDateRangePreset.LAST_30_DAYS;

@InputType()
export class DashboardDateRangeInput {
  @Field(() => DashboardDateRangePreset, { nullable: true })
  preset?: DashboardDateRangePreset;
}

@ObjectType()
export class ActivityEvent {
  @Field()
  id: string;

  @Field()
  type: string;

  @Field()
  actor: string;

  @Field()
  timestamp: Date;
}

@ObjectType()
export class DashboardMetrics {
  @Field(() => Int)
  activeUsers: number;

  @Field(() => Int)
  totalStudents: number;

  @Field(() => Int)
  publishedCourses: number;

  @Field(() => Float)
  monthlyRevenue: number;

  @Field(() => [ActivityEvent])
  recentActivity: ActivityEvent[];
}

export interface DashboardMetricsSnapshot {
  activeUsers: number;
  totalStudents: number;
  publishedCourses: number;
  monthlyRevenue: number;
}

export interface CachedActivityEvent {
  id: string;
  type: string;
  actor: string;
  timestamp: string;
}

export interface DashboardTenantCache {
  metrics: Record<DashboardDateRangePreset, DashboardMetricsSnapshot>;
  recentActivity: CachedActivityEvent[];
  updatedAt: string;
}

export interface DashboardMetricsUpdatedEvent {
  tenantId: string;
  dateRange: DashboardDateRangePreset;
  metrics: DashboardMetrics;
}
