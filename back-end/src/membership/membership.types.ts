import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
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

@ObjectType()
export class Invitation {
  @Field(() => String)
  id: string;

  @Field(() => String)
  tenantId: string;

  @Field(() => String)
  email: string;

  @Field(() => String)
  roleId: string;

  @Field(() => Date)
  expiresAt: Date;

  @Field(() => Date, { nullable: true })
  acceptedAt?: Date | null;

  @Field(() => Date, { nullable: true })
  declinedAt?: Date | null;

  @Field(() => Date)
  createdAt: Date;
}

@ObjectType()
export class InviteMemberPayload {
  @Field(() => Invitation)
  invitation: Invitation;

  @Field(() => String)
  invitationToken: string;
}

@ObjectType()
export class MemberRole {
  @Field(() => String)
  roleId: string;

  @Field(() => String)
  roleName: string;
}

@ObjectType()
export class TenantMember {
  @Field(() => String)
  id: string;

  @Field(() => String)
  tenantId: string;

  @Field(() => String)
  username: string;

  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  bio?: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => [MemberRole])
  roles: MemberRole[];
}

@InputType()
export class MembersFilterInput {
  @Field(() => StringFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => StringFilter)
  username?: StringFilter;

  @Field(() => StringFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => StringFilter)
  name?: StringFilter;

  @Field(() => StringFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => StringFilter)
  email?: StringFilter;

  @Field(() => DateFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DateFilter)
  createdAt?: DateFilter;

  @Field(() => EnumFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnumFilter)
  roleName?: EnumFilter;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean({ message: 'includeDeleted must be a boolean' })
  includeDeleted?: boolean;
}

@ObjectType('PaginatedMembers')
export class MembersPayload extends PaginatedResult(TenantMember) {
  @Field(() => [TenantMember])
  members: TenantMember[];

  @Field(() => Int)
  totalCount: number;
}

@ObjectType()
export class TenantMembership {
  @Field(() => String)
  tenantId: string;

  @Field(() => String)
  tenantName: string;

  @Field(() => String)
  tenantSlug: string;

  @Field(() => [String])
  roleNames: string[];
}

@ObjectType()
export class MyTenantsPayload {
  @Field(() => [TenantMembership])
  memberships: TenantMembership[];
}

@InputType()
export class InviteMemberInput {
  @Field(() => String)
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email must be valid' })
  email: string;

  @Field(() => String)
  @IsNotEmpty({ message: 'roleId is required' })
  @IsString({ message: 'roleId must be a string' })
  roleId: string;
}

@InputType()
export class AcceptInvitationInput {
  @Field(() => String)
  @IsNotEmpty({ message: 'Token is required' })
  @IsString({ message: 'Token must be a string' })
  token: string;
}

@InputType()
export class DeclineInvitationInput {
  @Field(() => String)
  @IsNotEmpty({ message: 'Token is required' })
  @IsString({ message: 'Token must be a string' })
  token: string;
}

@InputType()
export class UpdateMemberRolesInput {
  @Field(() => String)
  @IsNotEmpty({ message: 'userId is required' })
  @IsString({ message: 'userId must be a string' })
  userId: string;

  @Field(() => [String])
  @IsArray({ message: 'roleIds must be an array' })
  @ArrayMinSize(1, { message: 'At least one roleId is required' })
  roleIds: string[];
}

@InputType()
export class MembersQueryInput {
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

  @Field(() => MembersFilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => MembersFilterInput)
  filter?: MembersFilterInput;

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

  @IsOptional()
  @IsBoolean({ message: 'includeDeleted must be a boolean' })
  @Field(() => Boolean, {
    nullable: true,
    deprecationReason: 'Use filter.includeDeleted instead',
  })
  includeDeleted?: boolean;
}
