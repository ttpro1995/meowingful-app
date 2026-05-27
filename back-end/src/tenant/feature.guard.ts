import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { REQUIRE_PERMISSION_KEY } from '../rbac/permission.guard';
import { RequestWithTenantContext } from './tenant.request';
import { TenantConfigService } from './tenant-config.service';
import { TenantFeatureKey } from './tenant-config.types';

export const REQUIRE_FEATURE_KEY = 'require_feature';

export const RequireFeature = (feature: TenantFeatureKey) =>
  SetMetadata(REQUIRE_FEATURE_KEY, feature);

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantConfigService: TenantConfigService,
  ) {}

  private inferFeatureFromPermission(permission: string): TenantFeatureKey | null {
    if (permission.startsWith('lead:')) {
      return 'crm';
    }

    return null;
  }

  private resolveRequiredFeature(
    context: ExecutionContext,
  ): TenantFeatureKey | null {
    const explicitFeature = this.reflector.getAllAndOverride<TenantFeatureKey>(
      REQUIRE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (explicitFeature) {
      return explicitFeature;
    }

    const requiredPermission = this.reflector.getAllAndOverride<string>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) {
      return null;
    }

    return this.inferFeatureFromPermission(requiredPermission);
  }

  private getRequest(context: ExecutionContext): RequestWithTenantContext {
    if (context.getType<'graphql' | 'http'>() === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      const ctx = gqlContext.getContext<{ req: RequestWithTenantContext }>();

      return ctx.req;
    }

    return context.switchToHttp().getRequest<RequestWithTenantContext>();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.resolveRequiredFeature(context);
    if (!requiredFeature) {
      return true;
    }

    const request = this.getRequest(context);
    const tenantId = request.tenantContext?.tenantId;

    if (!tenantId) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }

    const tenantConfig = await this.tenantConfigService.getTenantConfigByTenantId(
      tenantId,
    );

    if (!tenantConfig.features[requiredFeature]) {
      throw new ForbiddenException('FEATURE_DISABLED');
    }

    return true;
  }
}
