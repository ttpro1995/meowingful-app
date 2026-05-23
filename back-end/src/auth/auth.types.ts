import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import {
  IsAlphanumeric,
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';

@ObjectType()
export class User {
  @Field(() => String)
  id: string;

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

@ObjectType()
export class PageInfo {
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
export class UsersPayload {
  @Field(() => [User])
  users: User[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}

@InputType()
export class UsersQueryInput {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt({ message: 'first must be a number' })
  first?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt({ message: 'last must be a number' })
  last?: number;

  @Field(() => String, { nullable: true })
  after?: string;

  @Field(() => String, { nullable: true })
  before?: string;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  includeDeleted?: boolean;
}
