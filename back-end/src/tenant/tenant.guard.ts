import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserRole } from '@prisma/client';
import { GraphQLResolveInfo } from 'graphql';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { RequestWithTenantContext } from './tenant.request';
import { PrismaService } from '../prisma/prisma.service';

interface AccessTokenPayload extends JwtPayload {
  sub: string;
  tenantId: string;
  role?: UserRole;
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  private readonly publicMutations = new Set([
    'register',
    'login',
    'refreshToken',
  ]);
  private readonly publicQueries = new Set(['__schema', '__type']);

  private getJwtSecret(): string {
    return process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
  }

  private isPublicOperation(
    parentTypeName: string,
    fieldName: string,
  ): boolean {
    if (parentTypeName === 'Mutation' && this.publicMutations.has(fieldName)) {
      return true;
    }

    if (parentTypeName === 'Query' && this.publicQueries.has(fieldName)) {
      return true;
    }

    return false;
  }

  private extractAccessToken(req: RequestWithTenantContext): string {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }

    return authHeader.slice('Bearer '.length).trim();
  }

  private verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, this.getJwtSecret());
      if (typeof decoded === 'string') {
        throw new UnauthorizedException('UNAUTHORIZED');
      }

      const payload = decoded as AccessTokenPayload;
      if (!payload.sub || !payload.tenantId) {
        throw new UnauthorizedException('UNAUTHORIZED');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('UNAUTHORIZED');
    }
  }

  private async ensureTenantMembership(
    userId: string,
    tenantId: string,
  ): Promise<void> {
    const membership = await this.prisma.userTenantRole.findFirst({
      where: {
        userId,
        tenantId,
      },
      select: {
        userId: true,
      },
    });

    if (!membership) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType<'graphql' | 'http'>() !== 'graphql') {
      return true;
    }

    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext<{ req: RequestWithTenantContext }>();
    const info = gqlContext.getInfo<GraphQLResolveInfo>();
    const req = ctx.req;

    if (!req) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }

    if (this.isPublicOperation(info.parentType.name, info.fieldName)) {
      req.tenantContext = null;
      return true;
    }

    const accessToken = this.extractAccessToken(req);
    const payload = this.verifyAccessToken(accessToken);

    await this.ensureTenantMembership(payload.sub, payload.tenantId);

    req.tenantContext = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role ?? UserRole.USER,
      isSuperAdmin: payload.role === UserRole.SUPER_ADMIN,
    };

    return true;
  }
}
