import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import {
  User,
  AuthPayload,
  RegisterInput,
  LoginInput,
  UpdateUserInput,
  ChangePasswordInput,
} from './auth.types';

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
