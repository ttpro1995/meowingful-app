import { UnauthorizedException } from '@nestjs/common';
import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { getTenantContext } from '../tenant/tenant-context.storage';
import {
  User,
  AuthPayload,
  MePayload,
  UsersPayload,
  UsersQueryInput,
  RegisterInput,
  LoginInput,
  UpdateUserInput,
  UpdateUserProfileInput,
  ChangePasswordInput,
} from './auth.types';

@Resolver(() => User)
export class AuthResolver {
  private readonly refreshTokenTtlMs = 7 * 24 * 60 * 60 * 1000;

  constructor(private authService: AuthService) {}

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: this.refreshTokenTtlMs,
      path: '/',
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    });
  }

  private readRefreshTokenFromCookieHeader(
    cookieHeader: string | undefined,
  ): string | null {
    if (!cookieHeader) {
      return null;
    }

    for (const pair of cookieHeader.split(';')) {
      const [rawName, ...rawValue] = pair.trim().split('=');
      if (rawName === 'refreshToken') {
        return rawValue.join('=');
      }
    }

    return null;
  }

  private extractRefreshToken(req: Request): string {
    const cookieToken =
      (req.cookies?.refreshToken as string | undefined) ||
      this.readRefreshTokenFromCookieHeader(req.headers.cookie);

    if (!cookieToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    return cookieToken;
  }

  private extractAccessToken(req: Request): string {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Access token missing');
    }

    return authHeader.slice('Bearer '.length).trim();
  }

  @Query(() => MePayload)
  async getMe(@Args('userId') userId: string) {
    const user = await this.authService.getMe(userId);
    return { user };
  }

  @Mutation(() => AuthPayload)
  async register(
    @Args('input') input: RegisterInput,
    @Context('res') res: Response,
  ) {
    const user = await this.authService.register(input);
    const session = await this.authService.issueSessionForUser(user.id);
    this.setRefreshTokenCookie(res, session.refreshToken);
    return { accessToken: session.accessToken, user: session.user };
  }

  @Mutation(() => AuthPayload)
  async login(@Args('input') input: LoginInput, @Context('res') res: Response) {
    const session = await this.authService.login(input);
    this.setRefreshTokenCookie(res, session.refreshToken);

    return {
      accessToken: session.accessToken,
      user: session.user,
    };
  }

  @Mutation(() => AuthPayload)
  async switchTenant(
    @Args('tenantId') tenantId: string,
    @Context('res') res: Response,
  ) {
    const context = getTenantContext();
    if (!context?.userId) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }

    const session = await this.authService.switchTenant(
      context.userId,
      tenantId,
    );
    this.setRefreshTokenCookie(res, session.refreshToken);

    return {
      accessToken: session.accessToken,
      user: session.user,
    };
  }

  @Mutation(() => AuthPayload)
  async refreshToken(
    @Context('req') req: Request,
    @Context('res') res: Response,
  ) {
    const refreshToken = this.extractRefreshToken(req);
    const session = await this.authService.refreshSession(refreshToken);
    this.setRefreshTokenCookie(res, session.refreshToken);

    return {
      accessToken: session.accessToken,
      user: session.user,
    };
  }

  @Mutation(() => Boolean)
  async logout(@Context('req') req: Request, @Context('res') res: Response) {
    const accessToken = this.extractAccessToken(req);
    await this.authService.logout(accessToken);
    this.clearRefreshTokenCookie(res);
    return true;
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

  @Mutation(() => User)
  async updateUserProfile(
    @Args('userId') userId: string,
    @Args('input') input: UpdateUserProfileInput,
  ) {
    return this.authService.updateUserProfile(userId, input);
  }

  @Mutation(() => Boolean)
  async changePassword(
    @Args('userId') userId: string,
    @Args('input') input: ChangePasswordInput,
  ) {
    return this.authService.changePassword(userId, input);
  }

  @Query(() => UsersPayload)
  async users(
    @Args('query', { nullable: true }) query?: UsersQueryInput,
  ): Promise<UsersPayload> {
    return this.authService.getUsers(query ?? {});
  }
}
