import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class UserError {
  @Field(() => String)
  code: string;

  @Field(() => String)
  message: string;

  @Field(() => String, { nullable: true })
  field?: string;
}

export interface UserErrorDescriptor {
  code: string;
  message: string;
  field?: string;
}
