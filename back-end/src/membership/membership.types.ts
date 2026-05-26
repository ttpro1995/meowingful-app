import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

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

@ObjectType('MembersPageInfo')
export class MembersPageInfo {
  @Field(() => String, { nullable: true })
  startCursor?: string;

  @Field(() => String, { nullable: true })
  endCursor?: string;

  @Field(() => Boolean)
  hasNextPage: boolean;

  @Field(() => Boolean)
  hasPreviousPage: boolean;
}

@ObjectType()
export class MembersPayload {
  @Field(() => [TenantMember])
  members: TenantMember[];

  @Field(() => MembersPageInfo)
  pageInfo: MembersPageInfo;

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
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt({ message: 'first must be a number' })
  first?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt({ message: 'last must be a number' })
  last?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString({ message: 'after must be a string' })
  after?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString({ message: 'before must be a string' })
  before?: string;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  includeDeleted?: boolean;
}
