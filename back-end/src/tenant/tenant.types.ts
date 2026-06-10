import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DateFilter, StringFilter } from '../shared/pagination/filter.types';
import {
  OrderByArgs,
  PaginationArgs,
} from '../shared/pagination/pagination.args';
import { PaginatedResult } from '../shared/pagination/paginated-result.type';

@ObjectType()
export class Tenant {
  @Field(() => String)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String)
  slug: string;

  @Field(() => String)
  planTier: string;

  @Field(() => String)
  contactEmail: string;

  @Field(() => String, { nullable: true })
  logoUrl?: string;

  @Field(() => Boolean)
  isActive: boolean;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@ObjectType()
export class TenantListItem extends Tenant {
  @Field(() => Int)
  userCount: number;

  @Field(() => Int)
  activeCourses: number;
}

@InputType()
export class TenantsFilterInput {
  @Field(() => StringFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => StringFilter)
  name?: StringFilter;

  @Field(() => StringFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => StringFilter)
  slug?: StringFilter;

  @Field(() => StringFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => StringFilter)
  planTier?: StringFilter;

  @Field(() => StringFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => StringFilter)
  contactEmail?: StringFilter;

  @Field(() => DateFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DateFilter)
  createdAt?: DateFilter;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;
}

@ObjectType('PaginatedTenants')
export class TenantsPayload extends PaginatedResult(TenantListItem) {
  @Field(() => [TenantListItem])
  tenants: TenantListItem[];

  @Field(() => Int)
  totalCount: number;
}

@InputType()
export class TenantsQueryInput {
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

  @Field(() => TenantsFilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => TenantsFilterInput)
  filter?: TenantsFilterInput;
}

@InputType()
export class CreateTenantInput {
  @Field(() => String)
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name: string;

  @Field(() => String)
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'slug must be URL-safe and include only lowercase letters, numbers and dashes',
  })
  slug: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  planTier?: string;

  @Field(() => String)
  @IsEmail()
  contactEmail: string;
}

@InputType()
export class UpdateTenantInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'slug must be URL-safe and include only lowercase letters, numbers and dashes',
  })
  slug?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  planTier?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
