import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, RoleName, UserRole } from '@prisma/client';
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
  MembersFilterInput,
  MembersPayload,
  MembersQueryInput,
  MyTenantsPayload,
  TenantMember,
  TenantMembership,
  UpdateMemberRolesInput,
} from './membership.types';
import {
  DateFilter,
  EnumFilter,
  StringFilter,
} from '../shared/pagination/filter.types';
import { SortDirection } from '../shared/pagination/pagination.args';
import { paginate } from '../shared/pagination/paginate';

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
  private readonly memberSortableFields = new Set([
    'createdAt',
    'updatedAt',
    'username',
    'name',
    'email',
  ]);

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

  private toStringFilter(
    filter?: StringFilter,
  ): Prisma.StringFilter | undefined {
    if (!filter) {
      return undefined;
    }

    const where: Prisma.StringFilter = {
      mode: 'insensitive',
    };

    if (filter.equals) {
      where.equals = filter.equals;
    }

    if (filter.contains) {
      where.contains = filter.contains;
    }

    if (filter.startsWith) {
      where.startsWith = filter.startsWith;
    }

    if (filter.endsWith) {
      where.endsWith = filter.endsWith;
    }

    if (filter.in && filter.in.length > 0) {
      where.in = filter.in;
    }

    return Object.keys(where).length > 1 ? where : undefined;
  }

  private toDateFilter(filter?: DateFilter): Prisma.DateTimeFilter | undefined {
    if (!filter) {
      return undefined;
    }

    const where: Prisma.DateTimeFilter = {};

    if (filter.equals) {
      where.equals = new Date(filter.equals);
    }

    if (filter.gt) {
      where.gt = new Date(filter.gt);
    }

    if (filter.gte) {
      where.gte = new Date(filter.gte);
    }

    if (filter.lt) {
      where.lt = new Date(filter.lt);
    }

    if (filter.lte) {
      where.lte = new Date(filter.lte);
    }

    return Object.keys(where).length > 0 ? where : undefined;
  }

  private parseRoleName(value: string): RoleName {
    const parsed = Object.values(RoleName).find((role) => role === value);
    if (!parsed) {
      throw new BadRequestException(`Invalid role filter value: ${value}`);
    }

    return parsed;
  }

  private toRoleNameFilter(
    filter?: EnumFilter,
  ): Prisma.EnumRoleNameFilter | undefined {
    if (!filter) {
      return undefined;
    }

    const where: Prisma.EnumRoleNameFilter = {};

    if (filter.equals) {
      where.equals = this.parseRoleName(filter.equals);
    }

    if (filter.in && filter.in.length > 0) {
      where.in = filter.in.map((value) => this.parseRoleName(value));
    }

    return Object.keys(where).length > 0 ? where : undefined;
  }

  private buildMembersWhereInput(
    tenantId: string,
    filter: MembersFilterInput | undefined,
    includeDeleted: boolean,
  ): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {
      userRoles: {
        some: {
          tenantId,
        },
      },
      ...(includeDeleted ? {} : { deletedAt: null }),
    };

    const usernameFilter = this.toStringFilter(filter?.username);
    if (usernameFilter) {
      where.username = usernameFilter;
    }

    const nameFilter = this.toStringFilter(filter?.name);
    if (nameFilter) {
      where.name = nameFilter;
    }

    const emailFilter = this.toStringFilter(filter?.email);
    if (emailFilter) {
      where.email = emailFilter;
    }

    const createdAtFilter = this.toDateFilter(filter?.createdAt);
    if (createdAtFilter) {
      where.createdAt = createdAtFilter;
    }

    const roleNameFilter = this.toRoleNameFilter(filter?.roleName);
    if (roleNameFilter) {
      where.AND = [
        {
          userRoles: {
            some: {
              tenantId,
              role: {
                name: roleNameFilter,
              },
            },
          },
        },
      ];
    }

    return where;
  }

  private resolveMembersOrderBy(
    orderField: string | undefined,
    direction: SortDirection | undefined,
  ): Prisma.UserOrderByWithRelationInput {
    const field = orderField ?? 'createdAt';
    if (!this.memberSortableFields.has(field)) {
      throw new BadRequestException(`Unsupported orderBy.field: ${field}`);
    }

    const prismaDirection: Prisma.SortOrder =
      direction === SortDirection.DESC ? 'desc' : 'asc';

    return {
      [field]: prismaDirection,
    };
  }

  async members(query: MembersQueryInput = {}): Promise<MembersPayload> {
    const context = await this.assertTenantAdminAccess();
    const requestedLimit =
      query.pagination?.limit ?? query.first ?? query.last ?? undefined;
    const requestedPage = query.pagination?.page ?? 1;
    const { page, limit, skip, take } = paginate(requestedPage, requestedLimit);

    const includeDeleted =
      query.filter?.includeDeleted ?? query.includeDeleted ?? false;
    const where = this.buildMembersWhereInput(
      context.tenantId,
      query.filter,
      includeDeleted,
    );

    const orderBy = this.resolveMembersOrderBy(
      query.orderBy?.field,
      query.orderBy?.direction,
    );

    const totalCount = await this.prisma.user.count({ where });

    const users = await this.prisma.user.findMany({
      where,
      include: {
        userRoles: {
          where: { tenantId: context.tenantId },
          include: { role: true },
        },
      },
      orderBy,
      skip,
      take,
    });

    const data = users.map((user) => this.mapMember(user as UserWithRoles));

    return {
      data,
      members: data,
      totalCount,
      pageInfo: {
        total: totalCount,
        page,
        limit,
        totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / limit),
      },
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

    const existingMembership = await this.prisma.userTenantRole.findFirst({
      where: {
        tenantId: context.tenantId,
        userId: input.userId,
      },
      select: {
        userId: true,
      },
    });

    if (!existingMembership) {
      throw new BadRequestException('Member not found');
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
