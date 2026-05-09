import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import {
  User,
  AuthPayload,
  RegisterInput,
  LoginInput,
  UpdateUserInput,
  ChangePasswordInput,
} from './auth.types';
import * as jwt from 'jsonwebtoken';

@Resolver(() => User)
export class AuthResolver {
  constructor(private authService: AuthService) {}

  @Mutation(() => AuthPayload)
  async register(@Args('input') input: RegisterInput) {
    const user = await this.authService.register(input);
    // Generate a token for auto-login after registration
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    return { token, user };
  }

  @Mutation(() => AuthPayload)
  async login(@Args('input') input: LoginInput) {
    return this.authService.login(input);
  }

  @Query(() => User)
  async getUser(@Args('userId') userId: string) {
    return this.authService.getUser(userId);
  }

  @Query(() => User, { nullable: true })
  async me(@Context() context: any) {
    const req = context.req;
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return null;
    }

    try {
      const token = authHeader.replace('Bearer ', '');
      const secret = process.env.JWT_SECRET || 'default-secret-change-in-production';
      const payload = jwt.verify(token, secret) as { sub: string };
      return this.authService.getUser(payload.sub);
    } catch {
      return null;
    }
  }

  @Mutation(() => User)
  async updateUser(
    @Args('userId') userId: string,
    @Args('input') input: UpdateUserInput,
  ) {
    return this.authService.updateUser(userId, input);
  }

  @Mutation(() => Boolean)
  async changePassword(
    @Args('userId') userId: string,
    @Args('input') input: ChangePasswordInput,
  ) {
    return this.authService.changePassword(userId, input);
  }
}
