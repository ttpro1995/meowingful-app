import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { RoleName } from '@prisma/client';

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
