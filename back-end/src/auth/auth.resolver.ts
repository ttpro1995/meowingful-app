import { UnauthorizedException } from '@nestjs/common';
import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import type { Request, Response } from 'express';
import { AuditAction as PrismaAuditAction } from '@prisma/client';
import { AuthService } from './auth.service';
import { getTenantContext } from '../tenant/tenant-context.storage';
import { Auditable, AuditAction } from '../audit/audit.decorators';
import { createUpdateDiff } from '../audit/audit.helpers';
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

  private getClientIp(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim() ?? null;
    }

    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0]?.trim() ?? null;
    }

    return req.ip ?? null;
  }

  @Query(() => MePayload)
  async getMe(@Args('userId') userId: string) {
    const user = await this.authService.getMe(userId);
    return { user };
  }

  @Mutation(() => AuthPayload)
  @Auditable('User')
  @AuditAction(({ args, result }) => ({
    action: PrismaAuditAction.CREATE,
    resourceId:
      typeof result === 'object' &&
      result !== null &&
      'user' in result &&
      typeof (result as { user?: { id?: string } }).user?.id === 'string'
        ? (result as { user: { id: string } }).user.id
        : 'unknown',
    diff: createUpdateDiff(
      null,
      typeof args.input === 'object' && args.input
        ? (args.input as Record<string, unknown>)
        : null,
    ),
  }))
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
  async login(
    @Args('input') input: LoginInput,
    @Context('req') req: Request,
    @Context('res') res: Response,
  ) {
    const session = await this.authService.login(input, {
      ipAddress: this.getClientIp(req),
    });
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
  @Auditable('User')
  @AuditAction(({ args }) => ({
    action: PrismaAuditAction.UPDATE,
    resourceId:
      typeof args.userId === 'string' && args.userId ? args.userId : 'unknown',
    diff: createUpdateDiff(
      null,
      typeof args.input === 'object' && args.input
        ? (args.input as Record<string, unknown>)
        : null,
    ),
  }))
  async updateUser(
    @Args('userId') userId: string,
    @Args('input') input: UpdateUserInput,
  ) {
    return this.authService.updateUser(userId, input);
  }

  @Mutation(() => User)
  @Auditable('User')
  @AuditAction(({ args }) => ({
    action: PrismaAuditAction.UPDATE,
    resourceId:
      typeof args.userId === 'string' && args.userId ? args.userId : 'unknown',
    diff: createUpdateDiff(
      null,
      typeof args.input === 'object' && args.input
        ? (args.input as Record<string, unknown>)
        : null,
    ),
  }))
  async updateUserProfile(
    @Args('userId') userId: string,
    @Args('input') input: UpdateUserProfileInput,
  ) {
    return this.authService.updateUserProfile(userId, input);
  }

  @Mutation(() => Boolean)
  @Auditable('User')
  @AuditAction(({ args }) => ({
    action: PrismaAuditAction.UPDATE,
    resourceId:
      typeof args.userId === 'string' && args.userId ? args.userId : 'unknown',
    diff: createUpdateDiff(null, { passwordChanged: true }),
  }))
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
