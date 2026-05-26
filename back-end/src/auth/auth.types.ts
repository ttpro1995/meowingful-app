import {
  Field,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { UserRole } from '@prisma/client';
import {
  IsAlphanumeric,
  IsBoolean,
  IsEmail,
  IsLowercase,
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  Matches,
  MaxLength,
  MinLength,
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

registerEnumType(UserRole, {
  name: 'UserRole',
});

@ObjectType()
export class User {
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

  @Field(() => UserRole)
  role: UserRole;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@ObjectType()
export class AuthPayload {
  @Field(() => String)
  accessToken: string;

  @Field(() => User)
  user: User;
}

@ObjectType()
export class MePayload {
  @Field(() => User)
  user: User;
}

@InputType()
export class RegisterInput {
  @Field(() => String)
  @IsNotEmpty({ message: 'Username is required' })
  @IsAlphanumeric('en-US', {
    message: 'Username must contain only alphanumeric characters and spaces',
  })
  username: string;

  @Field(() => String)
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @Field(() => String)
  @IsNotEmpty({ message: 'Name is required' })
  @IsString({ message: 'Name must be a string' })
  @MaxLength(100, { message: 'Name must be at most 100 characters' })
  name: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Tenant slug must contain only lowercase letters, numbers, and dashes',
  })
  @IsLowercase({ message: 'Tenant slug must be lowercase' })
  tenantSlug?: string;
}

@InputType()
export class LoginInput {
  @Field(() => String)
  @IsNotEmpty({ message: 'Username is required' })
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(30, { message: 'Username must be at most 30 characters' })
  username: string;

  @Field(() => String)
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Tenant slug must contain only lowercase letters, numbers, and dashes',
  })
  @IsLowercase({ message: 'Tenant slug must be lowercase' })
  tenantSlug?: string;
}

@InputType()
export class UpdateUserInput {
  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  bio?: string;
}

@InputType()
export class UpdateUserProfileInput {
  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  bio?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsEmail({}, { message: 'Email must be valid' })
  email?: string;
}

@InputType()
export class ChangePasswordInput {
  @Field(() => String)
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword: string;

  @Field(() => String)
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  newPassword: string;
}

@InputType()
export class UsersFilterInput {
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
  role?: EnumFilter;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean({ message: 'includeDeleted must be a boolean' })
  includeDeleted?: boolean;
}

@ObjectType('PaginatedUsers')
export class UsersPayload extends PaginatedResult(User) {
  @Field(() => [User], { deprecationReason: 'Use data instead' })
  users: User[];

  @Field(() => Int, { deprecationReason: 'Use pageInfo.total instead' })
  totalCount: number;
}

@InputType()
export class UsersQueryInput {
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

  @Field(() => UsersFilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => UsersFilterInput)
  filter?: UsersFilterInput;

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
