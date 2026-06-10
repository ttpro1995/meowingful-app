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
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockPermissionService = {
    getUserPermissions: jest.fn(),
    invalidateUserPermissions: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaService.$transaction.mockImplementation(
      async (
        arg:
          | ((tx: typeof mockPrismaService) => Promise<unknown>)
          | readonly unknown[],
      ) => {
        if (typeof arg === 'function') {
          return arg(mockPrismaService);
        }

        return arg;
      },
    );
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

  it('throws when inviteMember role does not belong to tenant', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'admin-1',
      role: UserRole.TENANT_ADMIN,
      isSuperAdmin: false,
    });
    mockPrismaService.role.findFirst.mockResolvedValue(null);

    await expect(
      service.inviteMember({
        email: 'member@example.com',
        roleId: 'missing-role',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('marks invitation as declined for valid invitation token', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'user-1',
      role: UserRole.USER,
      isSuperAdmin: false,
    });

    const token = jwt.sign(
      {
        sub: 'inv-1',
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
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      declinedAt: null,
    });
    mockPrismaService.invitation.update.mockResolvedValue({ id: 'inv-1' });

    await expect(service.declineInvitation({ token })).resolves.toBe(true);
    expect(mockPrismaService.invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1' },
      }),
    );
  });

  it('updates member roles and returns refreshed tenant member profile', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'admin-1',
      role: UserRole.TENANT_ADMIN,
      isSuperAdmin: false,
    });

    mockPrismaService.role.count.mockResolvedValue(2);
    mockPrismaService.userTenantRole.findFirst.mockResolvedValue({
      userId: 'member-1',
    });
    mockPrismaService.userTenantRole.deleteMany.mockResolvedValue({ count: 2 });
    mockPrismaService.userTenantRole.createMany.mockResolvedValue({ count: 2 });
    mockPermissionService.invalidateUserPermissions.mockResolvedValue(
      undefined,
    );
    mockPrismaService.user.findFirst.mockResolvedValue({
      id: 'member-1',
      tenantId: 'tenant-1',
      username: 'member1',
      name: 'Member One',
      bio: null,
      email: 'member1@example.com',
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      userRoles: [
        {
          roleId: 'role-1',
          role: { name: 'TENANT_ADMIN' },
        },
        {
          roleId: 'role-2',
          role: { name: 'STAFF' },
        },
      ],
    });

    const result = await service.updateMemberRoles({
      userId: 'member-1',
      roleIds: ['role-1', 'role-2', 'role-2'],
    });

    expect(mockPrismaService.role.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        id: {
          in: ['role-1', 'role-2'],
        },
      },
    });
    expect(mockPrismaService.userTenantRole.deleteMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        userId: 'member-1',
      },
    });
    expect(mockPrismaService.userTenantRole.createMany).toHaveBeenCalledWith({
      data: [
        {
          tenantId: 'tenant-1',
          userId: 'member-1',
          roleId: 'role-1',
        },
        {
          tenantId: 'tenant-1',
          userId: 'member-1',
          roleId: 'role-2',
        },
      ],
    });
    expect(
      mockPermissionService.invalidateUserPermissions,
    ).toHaveBeenCalledWith('tenant-1', 'member-1');
    expect(result.id).toBe('member-1');
    expect(result.roles).toEqual([
      {
        roleId: 'role-1',
        roleName: 'TENANT_ADMIN',
      },
      {
        roleId: 'role-2',
        roleName: 'STAFF',
      },
    ]);
  });

  it('throws when one or more requested roles are invalid for tenant', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'admin-1',
      role: UserRole.TENANT_ADMIN,
      isSuperAdmin: false,
    });

    mockPrismaService.role.count.mockResolvedValue(1);

    await expect(
      service.updateMemberRoles({
        userId: 'member-1',
        roleIds: ['role-1', 'role-2'],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('aggregates duplicate tenant rows into unique role names in myTenants payload', async () => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: 'tenant-1',
      userId: 'user-1',
      role: UserRole.USER,
      isSuperAdmin: false,
    });

    mockPrismaService.userTenantRole.findMany.mockResolvedValue([
      {
        tenantId: 'tenant-1',
        tenant: {
          id: 'tenant-1',
          name: 'Tenant One',
          slug: 'tenant-one',
        },
        role: {
          name: 'TENANT_ADMIN',
        },
      },
      {
        tenantId: 'tenant-1',
        tenant: {
          id: 'tenant-1',
          name: 'Tenant One',
          slug: 'tenant-one',
        },
        role: {
          name: 'STAFF',
        },
      },
      {
        tenantId: 'tenant-1',
        tenant: {
          id: 'tenant-1',
          name: 'Tenant One',
          slug: 'tenant-one',
        },
        role: {
          name: 'STAFF',
        },
      },
      {
        tenantId: 'tenant-2',
        tenant: {
          id: 'tenant-2',
          name: 'Tenant Two',
          slug: 'tenant-two',
        },
        role: {
          name: 'INSTRUCTOR',
        },
      },
    ]);

    const result = await service.myTenants();

    expect(result.memberships).toEqual([
      {
        tenantId: 'tenant-1',
        tenantName: 'Tenant One',
        tenantSlug: 'tenant-one',
        roleNames: ['TENANT_ADMIN', 'STAFF'],
      },
      {
        tenantId: 'tenant-2',
        tenantName: 'Tenant Two',
        tenantSlug: 'tenant-two',
        roleNames: ['INSTRUCTOR'],
      },
    ]);
  });
});
