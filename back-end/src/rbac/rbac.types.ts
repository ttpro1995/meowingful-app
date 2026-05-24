import { Field, ObjectType } from '@nestjs/graphql';

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

  @Field(() => String)
  name: string;
}

@ObjectType()
export class RolePermissionsMatrix {
  @Field(() => String)
  roleName: string;

  @Field(() => [String])
  permissions: string[];
}
