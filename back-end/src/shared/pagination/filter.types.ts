import { Field, InputType } from '@nestjs/graphql';
import { IsArray, IsDateString, IsOptional, IsString } from 'class-validator';

@InputType()
export class StringFilter {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString({ message: 'equals must be a string' })
  equals?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString({ message: 'contains must be a string' })
  contains?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString({ message: 'startsWith must be a string' })
  startsWith?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString({ message: 'endsWith must be a string' })
  endsWith?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray({ message: 'in must be a string array' })
  @IsString({ each: true, message: 'in must contain only strings' })
  in?: string[];
}

@InputType()
export class DateFilter {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString({}, { message: 'equals must be a valid ISO date string' })
  equals?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString({}, { message: 'gt must be a valid ISO date string' })
  gt?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString({}, { message: 'gte must be a valid ISO date string' })
  gte?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString({}, { message: 'lt must be a valid ISO date string' })
  lt?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString({}, { message: 'lte must be a valid ISO date string' })
  lte?: string;
}

@InputType()
export class EnumFilter {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString({ message: 'equals must be a string' })
  equals?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray({ message: 'in must be a string array' })
  @IsString({ each: true, message: 'in must contain only strings' })
  in?: string[];
}
