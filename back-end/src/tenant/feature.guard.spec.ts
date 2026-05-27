import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { REQUIRE_PERMISSION_KEY } from '../rbac/permission.guard';
import { FeatureGuard, REQUIRE_FEATURE_KEY } from './feature.guard';
import { TenantConfigService } from './tenant-config.service';

describe('FeatureGuard', () => {
  let guard: FeatureGuard;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const mockTenantConfigService = {
    getTenantConfigByTenantId: jest.fn(),
  } as unknown as TenantConfigService;

  const createGraphqlContext = (
    tenantId: string | null,
    handler: Function = jest.fn(),
  ): ExecutionContext => {
    const req = {
      tenantContext: tenantId
        ? {
            tenantId,
          }
        : undefined,
    };

    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({ req }),
    } as never);

    return {
      getType: () => 'graphql',
      getHandler: () => handler,
      getClass: () => class TestResolver {},
    } as ExecutionContext;
  };

  beforeEach(() => {
    guard = new FeatureGuard(mockReflector, mockTenantConfigService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows when no feature metadata is present', async () => {
    mockReflector.getAllAndOverride = jest
      .fn()
      .mockImplementation((key: string) => {
        if (key === REQUIRE_FEATURE_KEY) {
          return undefined;
        }

        if (key === REQUIRE_PERMISSION_KEY) {
          return undefined;
        }

        return undefined;
      });

    const context = createGraphqlContext('tenant-1');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(
      mockTenantConfigService.getTenantConfigByTenantId,
    ).not.toHaveBeenCalled();
  });

  it('allows when required feature is enabled', async () => {
    mockReflector.getAllAndOverride = jest
      .fn()
      .mockImplementation((key: string) => {
        if (key === REQUIRE_FEATURE_KEY) {
          return 'crm';
        }

        return undefined;
      });

    mockTenantConfigService.getTenantConfigByTenantId = jest
      .fn()
      .mockResolvedValue({
        features: {
          crm: true,
        },
      });

    const context = createGraphqlContext('tenant-1');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('throws FEATURE_DISABLED when required feature is disabled', async () => {
    mockReflector.getAllAndOverride = jest
      .fn()
      .mockImplementation((key: string) => {
        if (key === REQUIRE_FEATURE_KEY) {
          return 'crm';
        }

        return undefined;
      });

    mockTenantConfigService.getTenantConfigByTenantId = jest
      .fn()
      .mockResolvedValue({
        features: {
          crm: false,
        },
      });

    const context = createGraphqlContext('tenant-1');

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(context)).rejects.toThrow('FEATURE_DISABLED');
  });

  it('maps lead permission metadata to crm feature enforcement', async () => {
    mockReflector.getAllAndOverride = jest
      .fn()
      .mockImplementation((key: string) => {
        if (key === REQUIRE_FEATURE_KEY) {
          return undefined;
        }

        if (key === REQUIRE_PERMISSION_KEY) {
          return 'lead:create';
        }

        return undefined;
      });

    mockTenantConfigService.getTenantConfigByTenantId = jest
      .fn()
      .mockResolvedValue({
        features: {
          crm: false,
        },
      });

    const context = createGraphqlContext('tenant-1');

    await expect(guard.canActivate(context)).rejects.toThrow('FEATURE_DISABLED');
  });

  it('rejects when tenant context is missing', async () => {
    mockReflector.getAllAndOverride = jest
      .fn()
      .mockImplementation((key: string) => {
        if (key === REQUIRE_FEATURE_KEY) {
          return 'crm';
        }

        return undefined;
      });

    const context = createGraphqlContext(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
