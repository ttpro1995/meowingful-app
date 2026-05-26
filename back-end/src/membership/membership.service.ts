import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionService } from '../rbac/permission.service';
import { getTenantContext } from '../tenant/tenant-context.storage';
import {
  AcceptInvitationInput,
  DeclineInvitationInput,
  InviteMemberInput,
  InviteMemberPayload,
  MembersPageInfo,
  MembersPayload,
  MembersQueryInput,
  MyTenantsPayload,
  TenantMember,
  TenantMembership,
  UpdateMemberRolesInput,
} from './membership.types';

interface InvitationTokenPayload extends JwtPayload {
  sub: string;
  tenantId: string;
  roleId: string;
  email: string;
  type: 'invitation';
}

interface AuthenticatedContext {
  tenantId: string;
  userId: string;
  role: UserRole;
  isSuperAdmin: boolean;
}

interface UserWithRoles {
  id: string;
  tenantId: string;
  username: string;
  name: string;
  bio: string | null;
  email: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  userRoles: Array<{
    roleId: string;
    role: {
      name: string;
    };
  }>;
}

@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);
  private readonly invitationTtlSeconds = 72 * 60 * 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
  ) {}

  private getJwtSecret(): string {
    return process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
  }

  private getAuthenticatedContext(): AuthenticatedContext {
    const context = getTenantContext();

    if (!context?.tenantId || !context.userId) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }

    return {
      tenantId: context.tenantId,
      userId: context.userId,
      role: context.role,
      isSuperAdmin: context.isSuperAdmin,
    };
  }

  private async assertTenantAdminAccess(): Promise<AuthenticatedContext> {
    const context = this.getAuthenticatedContext();

    if (context.isSuperAdmin || context.role === UserRole.TENANT_ADMIN) {
      return context;
    }

    const permissions = await this.permissionService.getUserPermissions(
      context.tenantId,
      context.userId,
    );

    if (!permissions.includes('tenant:manage')) {
      throw new ForbiddenException(
        'FORBIDDEN: missing permission tenant:manage',
      );
    }

    return context;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private verifyInvitationToken(token: string): InvitationTokenPayload {
    try {
      const decoded = jwt.verify(token, this.getJwtSecret());
      if (typeof decoded === 'string') {
        throw new BadRequestException('INVITATION_INVALID');
      }

      const payload = decoded as InvitationTokenPayload;
      if (
        !payload.sub ||
        !payload.tenantId ||
        !payload.roleId ||
        !payload.email ||
        payload.type !== 'invitation'
      ) {
        throw new BadRequestException('INVITATION_INVALID');
      }

      return payload;
    } catch {
      throw new BadRequestException('INVITATION_INVALID');
    }
  }

  private createInvitationToken(
    tenantId: string,
    roleId: string,
    email: string,
  ): string {
    return jwt.sign(
      {
        sub: randomUUID(),
        type: 'invitation',
        tenantId,
        roleId,
        email,
      },
      this.getJwtSecret(),
      { expiresIn: this.invitationTtlSeconds },
    );
  }

  private mapMember(user: UserWithRoles): TenantMember {
    return {
      id: user.id,
      tenantId: user.tenantId,
      username: user.username,
      name: user.name,
      bio: user.bio ?? undefined,
      email: user.email ?? undefined,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.userRoles.map((row) => ({
        roleId: row.roleId,
        roleName: row.role.name,
      })),
    };
  }

  private async getTenantMemberOrThrow(
    tenantId: string,
    userId: string,
  ): Promise<TenantMember> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        userRoles: {
          some: { tenantId },
        },
      },
      include: {
        userRoles: {
          where: { tenantId },
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Member not found');
    }

    return this.mapMember(user);
  }

  private async getInvitationByTokenOrThrow(token: string) {
    const payload = this.verifyInvitationToken(token);
    const tokenHash = this.hashToken(token);

    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation) {
      throw new BadRequestException('INVITATION_INVALID');
    }

    if (
      invitation.tenantId !== payload.tenantId ||
      invitation.roleId !== payload.roleId ||
      invitation.email !== payload.email
    ) {
      throw new BadRequestException('INVITATION_INVALID');
    }

    if (invitation.acceptedAt) {
      throw new BadRequestException('INVITATION_ALREADY_ACCEPTED');
    }

    if (invitation.declinedAt) {
      throw new BadRequestException('INVITATION_ALREADY_DECLINED');
    }

    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('INVITATION_EXPIRED');
    }

    return invitation;
  }

  async inviteMember(input: InviteMemberInput): Promise<InviteMemberPayload> {
    const context = await this.assertTenantAdminAccess();
    const email = this.normalizeEmail(input.email);

    const role = await this.prisma.role.findFirst({
      where: {
        id: input.roleId,
        tenantId: context.tenantId,
      },
    });

    if (!role) {
      throw new BadRequestException('Role not found for this tenant');
    }

    const token = this.createInvitationToken(context.tenantId, role.id, email);
    const expiresAt = new Date(Date.now() + this.invitationTtlSeconds * 1000);

    const invitation = await this.prisma.invitation.create({
      data: {
        tenantId: context.tenantId,
        email,
        roleId: role.id,
        tokenHash: this.hashToken(token),
        expiresAt,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8500';
    this.logger.log(
      `Invitation email stub -> ${email}: ${frontendUrl}/invite?token=${token}`,
    );

    return {
      invitation,
      invitationToken: token,
    };
  }

  async acceptInvitation(input: AcceptInvitationInput): Promise<boolean> {
    const context = this.getAuthenticatedContext();
    const invitation = await this.getInvitationByTokenOrThrow(input.token);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: {
          id: context.userId,
          email: null,
        },
        data: {
          email: invitation.email,
        },
      });

      await tx.userTenantRole.createMany({
        data: [
          {
            userId: context.userId,
            tenantId: invitation.tenantId,
            roleId: invitation.roleId,
          },
        ],
        skipDuplicates: true,
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
    });

    await this.permissionService.invalidateUserPermissions(
      invitation.tenantId,
      context.userId,
    );

    return true;
  }

  async declineInvitation(input: DeclineInvitationInput): Promise<boolean> {
    this.getAuthenticatedContext();
    const invitation = await this.getInvitationByTokenOrThrow(input.token);

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { declinedAt: new Date() },
    });

    return true;
  }

  async members(query: MembersQueryInput = {}): Promise<MembersPayload> {
    const context = await this.assertTenantAdminAccess();
    const { first, last, after, before, includeDeleted = false } = query;

    const isForward = first !== undefined || (!last && !before);
    const take = first ?? last ?? 20;

    const whereClause: Prisma.UserWhereInput = {
      userRoles: {
        some: {
          tenantId: context.tenantId,
        },
      },
      ...(includeDeleted ? {} : { deletedAt: null }),
    };

    const cursorConditions: Prisma.UserWhereInput[] = [];

    if (after) {
      const decodedAfter = Buffer.from(after, 'base64').toString('utf-8');
      if (isForward) {
        cursorConditions.push({ createdAt: { gt: new Date(decodedAfter) } });
      } else {
        cursorConditions.push({ createdAt: { lt: new Date(decodedAfter) } });
      }
    }

    if (before) {
      const decodedBefore = Buffer.from(before, 'base64').toString('utf-8');
      if (isForward) {
        cursorConditions.push({ createdAt: { lt: new Date(decodedBefore) } });
      } else {
        cursorConditions.push({ createdAt: { gt: new Date(decodedBefore) } });
      }
    }

    const cursorWhere: Prisma.UserWhereInput =
      cursorConditions.length > 0
        ? { AND: [whereClause, ...cursorConditions] }
        : whereClause;

    const totalCount = await this.prisma.user.count({
      where: {
        userRoles: {
          some: {
            tenantId: context.tenantId,
          },
        },
        deletedAt: null,
      },
    });

    const users = await this.prisma.user.findMany({
      where: cursorWhere,
      include: {
        userRoles: {
          where: { tenantId: context.tenantId },
          include: { role: true },
        },
      },
      orderBy: { createdAt: isForward ? 'asc' : 'desc' },
      take: isForward ? take : -take,
    });

    const orderedUsers = isForward ? users : [...users].reverse();

    const pageInfo: MembersPageInfo = {
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: undefined,
      endCursor: undefined,
    };

    if (orderedUsers.length > 0) {
      pageInfo.startCursor = Buffer.from(
        orderedUsers[0].createdAt.toISOString(),
      ).toString('base64');
      pageInfo.endCursor = Buffer.from(
        orderedUsers[orderedUsers.length - 1].createdAt.toISOString(),
      ).toString('base64');

      if (isForward) {
        const nextUser = await this.prisma.user.findFirst({
          where: {
            ...whereClause,
            createdAt: { gt: orderedUsers[orderedUsers.length - 1].createdAt },
          },
          orderBy: { createdAt: 'asc' },
        });
        pageInfo.hasNextPage = !!nextUser;

        if (after) {
          const prevUser = await this.prisma.user.findFirst({
            where: {
              ...whereClause,
              createdAt: {
                lt: new Date(Buffer.from(after, 'base64').toString('utf-8')),
              },
            },
            orderBy: { createdAt: 'desc' },
          });
          pageInfo.hasPreviousPage = !!prevUser;
        }
      } else {
        const prevUser = await this.prisma.user.findFirst({
          where: {
            ...whereClause,
            createdAt: { lt: orderedUsers[0].createdAt },
          },
          orderBy: { createdAt: 'desc' },
        });
        pageInfo.hasPreviousPage = !!prevUser;

        if (before) {
          const nextUser = await this.prisma.user.findFirst({
            where: {
              ...whereClause,
              createdAt: {
                gt: new Date(Buffer.from(before, 'base64').toString('utf-8')),
              },
            },
            orderBy: { createdAt: 'asc' },
          });
          pageInfo.hasNextPage = !!nextUser;
        }
      }
    }

    return {
      members: orderedUsers.map((user) =>
        this.mapMember(user as UserWithRoles),
      ),
      pageInfo,
      totalCount,
    };
  }

  async updateMemberRoles(
    input: UpdateMemberRolesInput,
  ): Promise<TenantMember> {
    const context = await this.assertTenantAdminAccess();

    const uniqueRoleIds = [...new Set(input.roleIds)];
    if (uniqueRoleIds.length === 0) {
      throw new BadRequestException('At least one role is required');
    }

    const roleCount = await this.prisma.role.count({
      where: {
        tenantId: context.tenantId,
        id: {
          in: uniqueRoleIds,
        },
      },
    });

    if (roleCount !== uniqueRoleIds.length) {
      throw new BadRequestException(
        'One or more roles are invalid for this tenant',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userTenantRole.deleteMany({
        where: {
          tenantId: context.tenantId,
          userId: input.userId,
        },
      });

      await tx.userTenantRole.createMany({
        data: uniqueRoleIds.map((roleId) => ({
          tenantId: context.tenantId,
          userId: input.userId,
          roleId,
        })),
      });
    });

    await this.permissionService.invalidateUserPermissions(
      context.tenantId,
      input.userId,
    );

    return this.getTenantMemberOrThrow(context.tenantId, input.userId);
  }

  async removeMember(userId: string): Promise<boolean> {
    const context = await this.assertTenantAdminAccess();

    const result = await this.prisma.userTenantRole.deleteMany({
      where: {
        tenantId: context.tenantId,
        userId,
      },
    });

    await this.permissionService.invalidateUserPermissions(
      context.tenantId,
      userId,
    );

    return result.count > 0;
  }

  async myTenants(): Promise<MyTenantsPayload> {
    const context = this.getAuthenticatedContext();

    const rows = await this.prisma.userTenantRole.findMany({
      where: {
        userId: context.userId,
      },
      include: {
        tenant: true,
        role: true,
      },
      orderBy: {
        tenantId: 'asc',
      },
    });

    const membershipMap = new Map<string, TenantMembership>();

    for (const row of rows) {
      const existing = membershipMap.get(row.tenantId);
      if (existing) {
        if (!existing.roleNames.includes(row.role.name)) {
          existing.roleNames.push(row.role.name);
        }
        continue;
      }

      membershipMap.set(row.tenantId, {
        tenantId: row.tenant.id,
        tenantName: row.tenant.name,
        tenantSlug: row.tenant.slug,
        roleNames: [row.role.name],
      });
    }

    return {
      memberships: [...membershipMap.values()],
    };
  }
}
