import {
  Field,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { AuditAction } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  DateFilter,
  EnumFilter,
  StringFilter,
} from '../shared/pagination/filter.types';
import {
  OrderByArgs,
  PaginationArgs,
} from '../shared/pagination/pagination.args';
import { PaginatedResult } from '../shared/pagination/paginated-result.type';

registerEnumType(AuditAction, {
  name: 'AuditAction',
});

@ObjectType()
export class AuditLogEntry {
  @Field(() => String)
  id: string;

  @Field(() => String)
  tenantId: string;

  @Field(() => String, { nullable: true })
  actorId?: string;

  @Field(() => String, { nullable: true })
  actorEmail?: string;

  @Field(() => AuditAction)
  action: AuditAction;

  @Field(() => String)
  resource: string;

  @Field(() => String)
  resourceId: string;

  @Field(() => String, { nullable: true })
  diff?: string;

  @Field(() => String, { nullable: true })
  ipAddress?: string;

  @Field(() => Date)
  createdAt: Date;
}

@ObjectType('PaginatedAuditLogs')
export class AuditLogsPayload extends PaginatedResult(AuditLogEntry) {
  @Field(() => [AuditLogEntry])
  auditLogs: AuditLogEntry[];

  @Field(() => Int)
  totalCount: number;
}

@InputType()
export class AuditLogFilterInput {
  @Field(() => StringFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => StringFilter)
  actorId?: StringFilter;

  @Field(() => StringFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => StringFilter)
  resource?: StringFilter;

  @Field(() => EnumFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnumFilter)
  action?: EnumFilter;

  @Field(() => DateFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DateFilter)
  createdAt?: DateFilter;
}

@InputType()
export class AuditLogsQueryInput {
  @Field(() => PaginationArgs, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => PaginationArgs)
  pagination?: PaginationArgs;

  @Field(() => OrderByArgs, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrderByArgs)
  orderBy?: OrderByArgs;

  @Field(() => AuditLogFilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => AuditLogFilterInput)
  filter?: AuditLogFilterInput;

  @IsOptional()
  @IsInt({ message: 'first must be a number' })
  @Field(() => Int, {
    nullable: true,
    deprecationReason: 'Use pagination.limit instead',
  })
  first?: number;

  @IsOptional()
  @IsInt({ message: 'last must be a number' })
  @Field(() => Int, {
    nullable: true,
    deprecationReason: 'Use pagination.limit instead',
  })
  last?: number;

  @IsOptional()
  @IsString({ message: 'after must be a string' })
  @Field(() => String, {
    nullable: true,
    deprecationReason: 'Cursor pagination is deprecated; use pagination.page',
  })
  after?: string;

  @IsOptional()
  @IsString({ message: 'before must be a string' })
  @Field(() => String, {
    nullable: true,
    deprecationReason: 'Cursor pagination is deprecated; use pagination.page',
  })
  before?: string;
}

export interface AuditLogJobPayload {
  tenantId: string;
  actorId?: string;
  actorEmail?: string;
  action: AuditAction;
  resource: string;
  resourceId: string;
  diff?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export type AuditActionResolver = (args: {
  args: Record<string, unknown>;
  result: unknown;
  requestResourceId?: string;
}) => {
  action: AuditAction;
  resourceId: string;
  diff?: Record<string, unknown> | null;
};
