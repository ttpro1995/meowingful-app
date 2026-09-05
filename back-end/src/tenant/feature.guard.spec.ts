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

  const getAllAndOverride = jest.fn();
  const getTenantConfigByTenantId = jest.fn();

  const mockReflector = {
    getAllAndOverride,
  } as unknown as Reflector;

  const mockTenantConfigService = {
    getTenantConfigByTenantId,
  } as unknown as TenantConfigService;

  const createGraphqlContext = (
    tenantId: string | null,
    handler: () => unknown = jest.fn(),
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

  const createHttpContext = (tenantId: string | null): ExecutionContext => {
    const req = {
      tenantContext: tenantId
        ? {
            tenantId,
          }
        : undefined,
    };

    return {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => jest.fn(),
      getClass: () => class TestController {},
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    guard = new FeatureGuard(mockReflector, mockTenantConfigService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows when no feature metadata is present', async () => {
    getAllAndOverride.mockImplementation((key: string) => {
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
    expect(getTenantConfigByTenantId).not.toHaveBeenCalled();
  });

  it('allows when required feature is enabled', async () => {
    getAllAndOverride.mockImplementation((key: string) => {
      if (key === REQUIRE_FEATURE_KEY) {
        return 'crm';
      }

      return undefined;
    });

    getTenantConfigByTenantId.mockResolvedValue({
      features: {
        crm: true,
      },
    });

    const context = createGraphqlContext('tenant-1');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('throws FEATURE_DISABLED when required feature is disabled', async () => {
    getAllAndOverride.mockImplementation((key: string) => {
      if (key === REQUIRE_FEATURE_KEY) {
        return 'crm';
      }

      return undefined;
    });

    getTenantConfigByTenantId.mockResolvedValue({
      features: {
        crm: false,
      },
    });

    const context = createGraphqlContext('tenant-1');

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'FEATURE_DISABLED',
    );
  });

  it('maps lead permission metadata to crm feature enforcement', async () => {
    getAllAndOverride.mockImplementation((key: string) => {
      if (key === REQUIRE_FEATURE_KEY) {
        return undefined;
      }

      if (key === REQUIRE_PERMISSION_KEY) {
        return 'lead:create';
      }

      return undefined;
    });

    getTenantConfigByTenantId.mockResolvedValue({
      features: {
        crm: false,
      },
    });

    const context = createGraphqlContext('tenant-1');

    await expect(guard.canActivate(context)).rejects.toThrow(
      'FEATURE_DISABLED',
    );
  });

  it('rejects when tenant context is missing', async () => {
    getAllAndOverride.mockImplementation((key: string) => {
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

  it('ignores non-lead permission metadata (no feature inference)', async () => {
    getAllAndOverride.mockImplementation((key: string) => {
      if (key === REQUIRE_FEATURE_KEY) {
        return undefined;
      }

      if (key === REQUIRE_PERMISSION_KEY) {
        return 'course:create';
      }

      return undefined;
    });

    const context = createGraphqlContext('tenant-1');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(getTenantConfigByTenantId).not.toHaveBeenCalled();
  });

  it('resolves feature from class-level metadata (getClass) when handler has none', async () => {
    getAllAndOverride.mockImplementation((key: string) => {
      if (key === REQUIRE_FEATURE_KEY) {
        return 'elearning';
      }

      return undefined;
    });

    getTenantConfigByTenantId.mockResolvedValue({
      features: {
        elearning: true,
      },
    });

    const context = createGraphqlContext('tenant-1');
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('allows elearning feature when enabled', async () => {
    getAllAndOverride.mockImplementation((key: string) => {
      if (key === REQUIRE_FEATURE_KEY) {
        return 'elearning';
      }

      return undefined;
    });

    getTenantConfigByTenantId.mockResolvedValue({
      features: {
        crm: false,
        elearning: true,
      },
    });

    const context = createGraphqlContext('tenant-1');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('throws FEATURE_DISABLED for elearning when disabled', async () => {
    getAllAndOverride.mockImplementation((key: string) => {
      if (key === REQUIRE_FEATURE_KEY) {
        return 'elearning';
      }

      return undefined;
    });

    getTenantConfigByTenantId.mockResolvedValue({
      features: {
        elearning: false,
      },
    });

    const context = createGraphqlContext('tenant-1');

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('uses HTTP context when getType returns http', async () => {
    getAllAndOverride.mockImplementation((key: string) => {
      if (key === REQUIRE_FEATURE_KEY) {
        return 'crm';
      }

      return undefined;
    });

    getTenantConfigByTenantId.mockResolvedValue({
      features: {
        crm: true,
      },
    });

    const context = createHttpContext('tenant-1');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
