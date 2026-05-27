import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { MembershipService } from './membership.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionService } from '../rbac/permission.service';
import { getTenantContext } from '../tenant/tenant-context.storage';
import { SortDirection } from '../shared/pagination/pagination.args';

jest.mock('../tenant/tenant-context.storage', () => ({
  getTenantContext: jest.fn(),
}));

describe('MembershipService', () => {
  let service: MembershipService;

  const mockPrismaService = {
    role: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    invitation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    userTenantRole: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockPermissionService = {
    getUserPermissions: jest.fn(),
    invalidateUserPermissions: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MembershipService(
      mockPrismaService as unknown as PrismaService,
      mockPermissionService as unknown as PermissionService,
    );
  });

  it('stores invitation token hash (not raw token) on inviteMember', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'admin-1',
      role: UserRole.TENANT_ADMIN,
      isSuperAdmin: false,
    });

    mockPrismaService.role.findFirst.mockResolvedValue({
      id: 'role-1',
      tenantId: 'tenant-1',
      name: 'TENANT_ADMIN',
    });

    mockPrismaService.invitation.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        id: 'inv-1',
        ...data,
        acceptedAt: null,
        declinedAt: null,
        createdAt: new Date(),
      }),
    );

    const result = await service.inviteMember({
      email: 'User@Example.com',
      roleId: 'role-1',
    });

    const invitationToken: string = result.invitationToken;
    const expectedHash = createHash('sha256')
      .update(invitationToken)
      .digest('hex');

    const invitationCreateMock = mockPrismaService.invitation
      .create as jest.Mock<
      unknown,
      [
        {
          data: {
            tenantId: string;
            email: string;
            roleId: string;
            tokenHash: string;
          };
        },
      ]
    >;
    const createArgs = invitationCreateMock.mock.calls[0]?.[0];

    expect(createArgs.data.tenantId).toBe('tenant-1');
    expect(createArgs.data.email).toBe('user@example.com');
    expect(createArgs.data.roleId).toBe('role-1');
    expect(createArgs.data.tokenHash).toBe(expectedHash);
    expect(result.invitationToken).toBeDefined();
  });

  it('returns INVITATION_EXPIRED when accepting an expired invitation token', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'user-1',
      role: UserRole.USER,
      isSuperAdmin: false,
    });

    const token = jwt.sign(
      {
        sub: 'token-id-1',
        type: 'invitation',
        tenantId: 'tenant-1',
        roleId: 'role-1',
        email: 'user@example.com',
      },
      'dev-secret-key-change-in-production',
      { expiresIn: '72h' },
    );

    mockPrismaService.invitation.findUnique.mockResolvedValue({
      id: 'inv-1',
      tenantId: 'tenant-1',
      roleId: 'role-1',
      email: 'user@example.com',
      expiresAt: new Date(Date.now() - 60_000),
      acceptedAt: null,
      declinedAt: null,
    });

    await expect(service.acceptInvitation({ token })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.acceptInvitation({ token })).rejects.toThrow(
      'INVITATION_EXPIRED',
    );
  });

  it('invalidates permission cache when removing a member', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'admin-1',
      role: UserRole.TENANT_ADMIN,
      isSuperAdmin: false,
    });

    const deleteManyMock = mockPrismaService.userTenantRole.deleteMany;
    deleteManyMock.mockResolvedValue({ count: 1 });
    mockPermissionService.invalidateUserPermissions.mockResolvedValue(
      undefined,
    );

    const result = await service.removeMember('member-1');

    expect(result).toBe(true);
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        userId: 'member-1',
      },
    });
    const invalidateMock = mockPermissionService.invalidateUserPermissions;
    expect(invalidateMock).toHaveBeenCalledWith('tenant-1', 'member-1');
  });

  it('throws BadRequestException for unsupported members orderBy field', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'admin-1',
      role: UserRole.TENANT_ADMIN,
      isSuperAdmin: false,
    });

    await expect(
      service.members({
        orderBy: {
          field: 'invalidField',
          direction: SortDirection.ASC,
        },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('clamps members pagination.limit to max 100', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'admin-1',
      role: UserRole.TENANT_ADMIN,
      isSuperAdmin: false,
    });

    mockPrismaService.user.count.mockResolvedValue(1);
    mockPrismaService.user.findMany.mockResolvedValue([
      {
        id: 'member-1',
        tenantId: 'tenant-1',
        username: 'member',
        name: 'Member',
        bio: null,
        email: 'member@example.com',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userRoles: [
          {
            roleId: 'role-1',
            role: {
              name: 'STAFF',
            },
          },
        ],
      },
    ]);

    const result = await service.members({
      pagination: {
        page: 1,
        limit: 500,
      },
    });

    expect(result.pageInfo.limit).toBe(100);
    expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 100,
      }),
    );
  });
});
