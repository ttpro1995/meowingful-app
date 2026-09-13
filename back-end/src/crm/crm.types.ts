import {
  Field,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
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
import { PageInfo } from '../shared/pagination/page-info.type';
import { LeadStatus } from '@prisma/client';

registerEnumType(LeadStatus, {
  name: 'LeadStatus',
});

@ObjectType()
export class Lead {
  @Field(() => String)
  id: string;

  @Field(() => String)
  tenantId: string;

  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => String, { nullable: true })
  source?: string;

  @Field(() => LeadStatus)
  status: LeadStatus;

  @Field(() => Int, { nullable: true })
  score?: number;

  @Field(() => String, { nullable: true })
  assignedToId?: string;

  @Field(() => String, { nullable: true })
  pipelineStageId?: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => [LeadNote])
  notes: LeadNote[];
}

@ObjectType()
export class Customer {
  @Field(() => String)
  id: string;

  @Field(() => String)
  tenantId: string;

  @Field(() => String, { nullable: true })
  leadId?: string;

  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => Date)
  createdAt: Date;
}

@ObjectType()
export class LeadNote {
  @Field(() => String)
  id: string;

  @Field(() => String)
  leadId: string;

  @Field(() => String)
  authorId: string;

  @Field(() => String)
  content: string;

  @Field(() => Date)
  createdAt: Date;
}

@InputType()
export class LeadsFilterInput {
  @Field(() => EnumFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnumFilter)
  status?: EnumFilter;

  @Field(() => StringFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => StringFilter)
  assignedToId?: StringFilter;

  @Field(() => StringFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => StringFilter)
  source?: StringFilter;

  @Field(() => DateFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DateFilter)
  from?: DateFilter;

  @Field(() => DateFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DateFilter)
  to?: DateFilter;
}

@ObjectType('PaginatedLeads')
export class LeadsPayload {
  @Field(() => [Lead])
  data: Lead[];

  @Field(() => [Lead])
  leads: Lead[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}

@InputType()
export class LeadsQueryInput {
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

  @Field(() => LeadsFilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => LeadsFilterInput)
  filter?: LeadsFilterInput;
}

@InputType()
export class CreateLeadInput {
  @Field(() => String)
  @IsNotEmpty()
  @IsString()
  name: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  phone?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  source?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  score?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  assignedToId?: string;
}

@InputType()
export class UpdateLeadInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  phone?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  source?: string;

  @Field(() => LeadStatus, { nullable: true })
  @IsOptional()
  status?: LeadStatus;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  score?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  assignedToId?: string;
}

@InputType()
export class AssignLeadInput {
  @Field(() => String)
  @IsNotEmpty()
  @IsString()
  leadId: string;

  @Field(() => String)
  @IsNotEmpty()
  @IsString()
  userId: string;
}

@InputType()
export class AddLeadNoteInput {
  @Field(() => String)
  @IsNotEmpty()
  @IsString()
  leadId: string;

  @Field(() => String)
  @IsNotEmpty()
  @IsString()
  content: string;
}
