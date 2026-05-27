import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtPayload } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { RequestWithTenantContext } from './tenant.request';
import { TenantConfigService } from './tenant-config.service';
import { UserRole } from '@prisma/client';

interface AccessTokenPayload extends JwtPayload {
  sub: string;
  tenantId: string;
  role?: UserRole;
}

@Injectable()
export class TenantLogoAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfigService: TenantConfigService,
  ) {}

  private getJwtSecret(): string {
    return process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
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
    if (context.getType<'graphql' | 'http'>() !== 'http') {
      return true;
    }

    const req = context.switchToHttp().getRequest<RequestWithTenantContext>();
    const accessToken = this.extractAccessToken(req);
    const payload = this.verifyAccessToken(accessToken);

    await this.ensureTenantMembership(payload.sub, payload.tenantId);

    const resolvedRole = payload.role ?? UserRole.USER;

    await this.tenantConfigService.assertCanManageTenant({
      tenantId: payload.tenantId,
      userId: payload.sub,
      role: resolvedRole,
      isSuperAdmin: resolvedRole === UserRole.SUPER_ADMIN,
    });

    req.tenantContext = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: resolvedRole,
      isSuperAdmin: resolvedRole === UserRole.SUPER_ADMIN,
    };

    return true;
  }
}
