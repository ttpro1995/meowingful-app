/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from './permission.service';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

export function RequirePermission(permission: string) {
  return (
    _target: unknown,
    _key?: string,
    descriptor?: PropertyDescriptor,
  ): PropertyDescriptor => {
    Reflect.defineMetadata(
      REQUIRE_PERMISSION_KEY,
      permission,
      descriptor?.value,
    );
    return descriptor as PropertyDescriptor;
  };
}

interface RequestWithUser {
  user?: {
    id: string;
    tenantId: string;
  };
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.get<string>(
      REQUIRE_PERMISSION_KEY,
      context.getHandler(),
    );
    if (!permission) return true;
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const user = req.user;
    const tenantId = user?.tenantId;
    const userId = user?.id;
    if (!tenantId || !userId)
      throw new ForbiddenException('Missing tenant or user context');
    const permissions = await this.permissionService.getUserPermissions(
      tenantId,
      userId,
    );
    if (!permissions.includes(permission)) {
      throw new ForbiddenException(
        `FORBIDDEN: missing permission ${permission}`,
      );
    }
    return true;
  }
}
