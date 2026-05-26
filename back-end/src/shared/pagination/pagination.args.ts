import { Field, InputType, Int, registerEnumType } from '@nestjs/graphql';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

registerEnumType(SortDirection, {
  name: 'SortDirection',
});

@InputType()
export class PaginationArgs {
  @Field(() => Int, { defaultValue: 1 })
  @IsOptional()
  @IsInt({ message: 'page must be a number' })
  @Min(1, { message: 'page must be at least 1' })
  page?: number = 1;

  @Field(() => Int, { defaultValue: 20 })
  @IsOptional()
  @IsInt({ message: 'limit must be a number' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit must be at most 100' })
  limit?: number = 20;
}

@InputType()
export class OrderByArgs {
  @Field(() => String)
  @IsNotEmpty({ message: 'orderBy.field is required' })
  @IsString({ message: 'orderBy.field must be a string' })
  field: string;

  @Field(() => SortDirection, { defaultValue: SortDirection.ASC })
  @IsOptional()
  direction?: SortDirection = SortDirection.ASC;
}
