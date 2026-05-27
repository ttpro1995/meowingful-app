import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { RoleName } from '@prisma/client';
import {
  EnumFilter,
  StringFilter,
} from '../shared/pagination/filter.types';
import {
  OrderByArgs,
  PaginationArgs,
} from '../shared/pagination/pagination.args';
import { PaginatedResult } from '../shared/pagination/paginated-result.type';

registerEnumType(RoleName, {
  name: 'RoleName',
});

@ObjectType()
export class Permission {
  @Field(() => String)
  id: string;

  @Field(() => String)
  code: string;

  @Field(() => String)
  description: string;
}

@ObjectType()
export class Role {
  @Field(() => String)
  id: string;

  @Field(() => RoleName)
  name: RoleName;
}

@ObjectType()
export class RolePermissionsMatrix {
  @Field(() => RoleName)
  roleName: RoleName;

  @Field(() => [String])
  permissions: string[];
}

@ObjectType('PaginatedRolePermissions')
export class RolePermissionsPayload extends PaginatedResult(
  RolePermissionsMatrix,
) {
  @Field(() => [RolePermissionsMatrix])
  rolePermissions: RolePermissionsMatrix[];

  @Field(() => Int)
  totalCount: number;
}

@InputType()
export class RolePermissionsFilterInput {
  @Field(() => EnumFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => EnumFilter)
  roleName?: EnumFilter;

  @Field(() => StringFilter, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => StringFilter)
  permissionCode?: StringFilter;
}

@InputType()
export class RolePermissionsQueryInput {
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

  @Field(() => RolePermissionsFilterInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => RolePermissionsFilterInput)
  filter?: RolePermissionsFilterInput;
}
