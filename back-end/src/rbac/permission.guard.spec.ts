/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { PermissionService } from './permission.service';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: Reflector;

  const mockPermissionService = {
    getUserPermissions: jest.fn(),
  };

  const createMockContext = (
    user: { id: string; tenantId: string } | null,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
      getHandler: jest.fn(),
    } as any;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        {
          provide: Reflector,
          useValue: new Reflector(),
        },
        {
          provide: PermissionService,
          useValue: mockPermissionService,
        },
      ],
    }).compile();

    guard = module.get<PermissionGuard>(PermissionGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should allow access when no permission is required', async () => {
    const context = createMockContext({ id: 'user-1', tenantId: 'tenant-1' });
    jest.spyOn(reflector, 'get').mockReturnValue(null);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access when permission is in user permissions', async () => {
    const context = createMockContext({ id: 'user-1', tenantId: 'tenant-1' });
    jest.spyOn(reflector, 'get').mockReturnValue('lead:create');
    mockPermissionService.getUserPermissions.mockResolvedValue([
      'lead:create',
      'lead:delete',
    ]);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockPermissionService.getUserPermissions).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
    );
  });

  it('should deny access when permission is missing', async () => {
    const context = createMockContext({ id: 'user-1', tenantId: 'tenant-1' });
    jest.spyOn(reflector, 'get').mockReturnValue('lead:delete');
    mockPermissionService.getUserPermissions.mockResolvedValue(['lead:create']);

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      'FORBIDDEN: missing permission lead:delete',
    );
  });

  it('should deny access when user context is missing tenantId', async () => {
    const context = createMockContext(null);
    (context as any).switchToHttp().getRequest = () => ({
      user: { id: 'user-1' },
    });
    jest.spyOn(reflector, 'get').mockReturnValue('lead:create');

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Missing tenant or user context',
    );
  });

  it('should deny access when user context is missing userId', async () => {
    const context = createMockContext(null);
    (context as any).switchToHttp().getRequest = () => ({
      user: { tenantId: 'tenant-1' },
    });
    jest.spyOn(reflector, 'get').mockReturnValue('lead:create');

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Missing tenant or user context',
    );
  });
});
