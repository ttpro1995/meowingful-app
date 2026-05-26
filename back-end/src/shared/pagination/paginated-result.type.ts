import { Type } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';
import { PageInfo } from './page-info.type';

export function PaginatedResult<TItem>(TItemClass: Type<TItem>) {
  @ObjectType({ isAbstract: true })
  abstract class PaginatedResultType {
    @Field(() => [TItemClass])
    data: TItem[];

    @Field(() => PageInfo)
    pageInfo: PageInfo;
  }

  return PaginatedResultType;
}
