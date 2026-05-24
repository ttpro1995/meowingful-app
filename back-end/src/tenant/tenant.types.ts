import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

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

@ObjectType()
export class TenantsPayload {
  @Field(() => [TenantListItem])
  tenants: TenantListItem[];

  @Field(() => Int)
  totalCount: number;
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
