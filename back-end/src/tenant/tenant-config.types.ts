import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsHexColor,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const BUSINESS_HOURS_RANGE_REGEX = /^\d{2}:\d{2}-\d{2}:\d{2}$/;

export const TENANT_FEATURE_VALUES = [
  'crm',
  'elearning',
  'call_center',
  'live_classes',
  'marketplace',
] as const;

export type TenantFeatureKey = (typeof TENANT_FEATURE_VALUES)[number];

export interface TenantFeaturesShape {
  crm: boolean;
  elearning: boolean;
  call_center: boolean;
  live_classes: boolean;
  marketplace: boolean;
}

export interface BusinessHoursShape {
  mon?: string;
  tue?: string;
  wed?: string;
  thu?: string;
  fri?: string;
  sat?: string;
  sun?: string;
}

export const DEFAULT_TENANT_FEATURES: TenantFeaturesShape = {
  crm: false,
  elearning: false,
  call_center: false,
  live_classes: false,
  marketplace: false,
};

export enum TenantFeature {
  CRM = 'crm',
  ELEARNING = 'elearning',
  CALL_CENTER = 'call_center',
  LIVE_CLASSES = 'live_classes',
  MARKETPLACE = 'marketplace',
}

registerEnumType(TenantFeature, {
  name: 'TenantFeature',
});

@ObjectType()
export class TenantFeatures implements TenantFeaturesShape {
  @Field(() => Boolean)
  crm: boolean;

  @Field(() => Boolean)
  elearning: boolean;

  @Field(() => Boolean)
  call_center: boolean;

  @Field(() => Boolean)
  live_classes: boolean;

  @Field(() => Boolean)
  marketplace: boolean;
}

@ObjectType()
export class BusinessHours implements BusinessHoursShape {
  @Field(() => String, { nullable: true })
  mon?: string;

  @Field(() => String, { nullable: true })
  tue?: string;

  @Field(() => String, { nullable: true })
  wed?: string;

  @Field(() => String, { nullable: true })
  thu?: string;

  @Field(() => String, { nullable: true })
  fri?: string;

  @Field(() => String, { nullable: true })
  sat?: string;

  @Field(() => String, { nullable: true })
  sun?: string;
}

@InputType()
export class BusinessHoursInput implements BusinessHoursShape {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(BUSINESS_HOURS_RANGE_REGEX, {
    message: 'Business hour must match HH:MM-HH:MM format',
  })
  mon?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(BUSINESS_HOURS_RANGE_REGEX, {
    message: 'Business hour must match HH:MM-HH:MM format',
  })
  tue?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(BUSINESS_HOURS_RANGE_REGEX, {
    message: 'Business hour must match HH:MM-HH:MM format',
  })
  wed?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(BUSINESS_HOURS_RANGE_REGEX, {
    message: 'Business hour must match HH:MM-HH:MM format',
  })
  thu?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(BUSINESS_HOURS_RANGE_REGEX, {
    message: 'Business hour must match HH:MM-HH:MM format',
  })
  fri?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(BUSINESS_HOURS_RANGE_REGEX, {
    message: 'Business hour must match HH:MM-HH:MM format',
  })
  sat?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(BUSINESS_HOURS_RANGE_REGEX, {
    message: 'Business hour must match HH:MM-HH:MM format',
  })
  sun?: string;
}

@ObjectType()
export class TenantConfig {
  @Field(() => String)
  id: string;

  @Field(() => String)
  tenantId: string;

  @Field(() => String, { nullable: true })
  logoUrl?: string;

  @Field(() => String)
  primaryColor: string;

  @Field(() => String, { nullable: true })
  subdomain?: string;

  @Field(() => String)
  timezone: string;

  @Field(() => String)
  defaultLanguage: string;

  @Field(() => BusinessHours, { nullable: true })
  businessHours?: BusinessHours;

  @Field(() => TenantFeatures)
  features: TenantFeatures;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@InputType()
export class UpdateTenantConfigInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsHexColor({ message: 'primaryColor must be a valid hex color value' })
  primaryColor?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'subdomain must contain only lowercase letters, numbers and dashes',
  })
  @MaxLength(63)
  subdomain?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(/^[a-z]{2}(?:-[A-Z]{2})?$/, {
    message: 'defaultLanguage must be in format like en or en-US',
  })
  defaultLanguage?: string;

  @Field(() => BusinessHoursInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessHoursInput)
  businessHours?: BusinessHoursInput;
}
