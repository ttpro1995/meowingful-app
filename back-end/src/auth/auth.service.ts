import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, RoleName, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import {
  RegisterInput,
  LoginInput,
  UpdateUserInput,
  ChangePasswordInput,
  UpdateUserProfileInput,
  UsersFilterInput,
  UsersQueryInput,
  UsersPayload,
  User,
} from './auth.types';
import { CacheService } from '../redis/cache.service';
import { getTenantContext } from '../tenant/tenant-context.storage';
import {
  DateFilter,
  EnumFilter,
  StringFilter,
} from '../shared/pagination/filter.types';
import { SortDirection } from '../shared/pagination/pagination.args';
import { paginate } from '../shared/pagination/paginate';

interface SessionTokenPayload extends JwtPayload {
  sub: string;
  tenantId: string;
  role?: UserRole;
  jti: string;
  type?: 'refresh';
}

interface SessionAuthPayload {
  accessToken: string;
  refreshToken: string;
  user: User;
}

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;
  private readonly defaultTenantSlug = 'default';
  private readonly accessTokenTtlSeconds = 15 * 60;
  private readonly refreshTokenTtlSeconds = 7 * 24 * 60 * 60;
  private readonly refreshTokenKeyPrefix = 'refresh_token:';
  private readonly userSortableFields = new Set([
    'createdAt',
    'updatedAt',
    'username',
    'name',
    'role',
  ]);

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  private getJwtSecret(): string {
    return process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
  }

  private getRefreshTokenKey(jti: string): string {
    return `${this.refreshTokenKeyPrefix}${jti}`;
  }

  private mapUser(user: {
    id: string;
    tenantId: string;
    role: UserRole;
    username: string;
    name: string;
    bio: string | null;
    email?: string | null;
    deletedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return {
      id: user.id,
      tenantId: user.tenantId,
      username: user.username,
      name: user.name,
      bio: user.bio ?? undefined,
      email: user.email ?? undefined,
      role: user.role,
      deletedAt: user.deletedAt ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private mapUserRoleToRoleName(role: UserRole): RoleName {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return RoleName.SUPER_ADMIN;
      case UserRole.TENANT_ADMIN:
        return RoleName.TENANT_ADMIN;
      default:
        return RoleName.DEVELOPER;
    }
  }

  private async ensureMembershipForUserTx(
    tx: Prisma.TransactionClient,
    user: {
      id: string;
      tenantId: string;
      role: UserRole;
    },
  ): Promise<void> {
    const roleName = this.mapUserRoleToRoleName(user.role);
    const role = await tx.role.upsert({
      where: {
        tenantId_name: {
          tenantId: user.tenantId,
          name: roleName,
        },
      },
      update: {},
      create: {
        tenantId: user.tenantId,
        name: roleName,
      },
    });

    await tx.userTenantRole.createMany({
      data: [
        {
          userId: user.id,
          tenantId: user.tenantId,
          roleId: role.id,
        },
      ],
      skipDuplicates: true,
    });
  }

  private async userHasTenantMembership(
    userId: string,
    tenantId: string,
  ): Promise<boolean> {
    const membership = await this.prisma.userTenantRole.findFirst({
      where: {
        userId,
        tenantId,
      },
      select: {
        userId: true,
      },
    });

    return !!membership;
  }

  private async resolveTenantBySlug(tenantSlug?: string) {
    const slug = tenantSlug ?? this.defaultTenantSlug;

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });

    if (!tenant) {
      throw new UnauthorizedException('Invalid tenant context');
    }

    return tenant;
  }

  private async ensureTenantIsActive(
    tenantId: string,
    allowInactiveForSuperAdmin = false,
  ): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new UnauthorizedException('Invalid tenant context');
    }

    if (!tenant.isActive && !allowInactiveForSuperAdmin) {
      throw new UnauthorizedException('Tenant is deactivated');
    }
  }

  private verifyToken(token: string): SessionTokenPayload {
    try {
      const decoded = jwt.verify(token, this.getJwtSecret());

      if (typeof decoded === 'string') {
        throw new UnauthorizedException('Invalid token');
      }

      const payload = decoded as SessionTokenPayload;
      if (!payload.sub || !payload.jti || !payload.tenantId) {
        throw new UnauthorizedException('Invalid token payload');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private async generateTokenPair(
    userId: string,
    tenantId: string,
    role: UserRole,
  ): Promise<{ accessToken: string; refreshToken: string; jti: string }> {
    const jti = randomUUID();
    const basePayload = { sub: userId, tenantId, role, jti };
    const jwtSecret = this.getJwtSecret();

    const accessToken = jwt.sign(basePayload, jwtSecret, {
      expiresIn: this.accessTokenTtlSeconds,
    });

    const refreshToken = jwt.sign(
      {
        ...basePayload,
        type: 'refresh',
      },
      jwtSecret,
      {
        expiresIn: this.refreshTokenTtlSeconds,
      },
    );

    await this.cacheService.set(
      this.getRefreshTokenKey(jti),
      userId,
      this.refreshTokenTtlSeconds,
    );

    return { accessToken, refreshToken, jti };
  }

  async issueSessionForUser(userId: string): Promise<SessionAuthPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    await this.ensureTenantIsActive(
      user.tenantId,
      user.role === UserRole.SUPER_ADMIN,
    );
    const hasMembership = await this.userHasTenantMembership(
      user.id,
      user.tenantId,
    );

    if (!hasMembership) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }

    const tokenPair = await this.generateTokenPair(
      user.id,
      user.tenantId,
      user.role,
    );

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      user: this.mapUser(user),
    };
  }

  async register(input: RegisterInput) {
    const { username, password, name, tenantSlug } = input;
    const tenant = await this.resolveTenantBySlug(tenantSlug);

    if (!tenant.isActive) {
      throw new UnauthorizedException('Tenant is deactivated');
    }

    // Check if username already exists
    const existingUser = await this.prisma.user.findUnique({
      where: {
        tenantId_username: {
          tenantId: tenant.id,
          username,
        },
      },
    });

    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    // Generate salt and hash password
    const salt = await bcrypt.genSalt(this.saltRounds);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user and auth in a transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          username,
          name,
        },
      });

      await tx.auth.create({
        data: {
          userId: newUser.id,
          tenantId: tenant.id,
          username,
          passwordHash,
          salt,
        },
      });

      await this.ensureMembershipForUserTx(tx, newUser);

      return newUser;
    });

    return this.mapUser(user);
  }

  async login(input: LoginInput): Promise<SessionAuthPayload> {
    const { username, password, tenantSlug } = input;
    const tenant = await this.resolveTenantBySlug(tenantSlug);

    if (!tenant.isActive) {
      throw new UnauthorizedException('Tenant is deactivated');
    }

    // Find auth record
    const auth = await this.prisma.auth.findUnique({
      where: {
        tenantId_username: {
          tenantId: tenant.id,
          username,
        },
      },
      include: { user: true },
    });

    if (!auth) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, auth.passwordHash);

    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const hasMembership = await this.userHasTenantMembership(
      auth.userId,
      auth.tenantId,
    );

    if (!hasMembership) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }

    const tokenPair = await this.generateTokenPair(
      auth.userId,
      auth.tenantId,
      auth.user.role,
    );

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      user: this.mapUser(auth.user),
    };
  }

  async refreshSession(refreshToken: string): Promise<SessionAuthPayload> {
    const payload = this.verifyToken(refreshToken);

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const refreshKey = this.getRefreshTokenKey(payload.jti);
    const cachedUserId = await this.cacheService.get(refreshKey);

    if (!cachedUserId || cachedUserId !== payload.sub) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    await this.cacheService.del(refreshKey);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const hasMembership = await this.userHasTenantMembership(
      payload.sub,
      payload.tenantId,
    );

    if (!hasMembership) {
      throw new UnauthorizedException('Invalid tenant context');
    }

    await this.ensureTenantIsActive(
      payload.tenantId,
      (payload.role ?? user.role) === UserRole.SUPER_ADMIN,
    );

    const tokenPair = await this.generateTokenPair(
      payload.sub,
      payload.tenantId,
      payload.role ?? user.role,
    );

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      user: {
        ...this.mapUser(user),
        tenantId: payload.tenantId,
      },
    };
  }

  async switchTenant(
    userId: string,
    tenantId: string,
  ): Promise<SessionAuthPayload> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const hasMembership = await this.userHasTenantMembership(userId, tenantId);
    if (!hasMembership) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }

    await this.ensureTenantIsActive(
      tenantId,
      user.role === UserRole.SUPER_ADMIN,
    );

    const tokenPair = await this.generateTokenPair(
      user.id,
      tenantId,
      user.role,
    );

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      user: {
        ...this.mapUser(user),
        tenantId,
      },
    };
  }

  async logout(accessToken: string): Promise<boolean> {
    const payload = this.verifyToken(accessToken);

    if (payload.type === 'refresh') {
      throw new UnauthorizedException('Invalid access token');
    }

    await this.cacheService.del(this.getRefreshTokenKey(payload.jti));
    return true;
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return {
      ...this.mapUser(user),
    };
  }

  // New method for getMe query
  async getMe(userId: string) {
    const context = getTenantContext();
    if (context?.userId) {
      return this.getUser(context.userId);
    }

    return this.getUser(userId);
  }

  async updateUser(userId: string, input: UpdateUserInput) {
    const { name, bio } = input;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name,
        bio,
      },
    });

    return {
      ...this.mapUser(user),
    };
  }

  // New method for updating profile including email
  async updateUserProfile(userId: string, input: UpdateUserProfileInput) {
    const { name, bio, email } = input;

    const data: UpdateUserProfileInput = { name, bio };
    if (email !== undefined) {
      data.email = email;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    return {
      ...this.mapUser(user),
    };
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const { currentPassword, newPassword } = input;

    // Get auth record
    const auth = await this.prisma.auth.findFirst({
      where: { userId },
    });

    if (!auth) {
      throw new BadRequestException('Auth record not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, auth.passwordHash);

    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Generate new salt and hash
    const newSalt = await bcrypt.genSalt(this.saltRounds);
    const newPasswordHash = await bcrypt.hash(newPassword, newSalt);

    // Update auth record
    await this.prisma.auth.update({
      where: { id: auth.id },
      data: {
        passwordHash: newPasswordHash,
        salt: newSalt,
      },
    });

    return true;
  }

  private parseUserRole(value: string): UserRole {
    const parsedRole = Object.values(UserRole).find((role) => role === value);
    if (!parsedRole) {
      throw new BadRequestException(`Invalid role filter value: ${value}`);
    }

    return parsedRole;
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

  private toRoleFilter(
    filter?: EnumFilter,
  ): Prisma.EnumUserRoleFilter | undefined {
    if (!filter) {
      return undefined;
    }

    const where: Prisma.EnumUserRoleFilter = {};

    if (filter.equals) {
      where.equals = this.parseUserRole(filter.equals);
    }

    if (filter.in && filter.in.length > 0) {
      where.in = filter.in.map((value) => this.parseUserRole(value));
    }

    return Object.keys(where).length > 0 ? where : undefined;
  }

  private buildUsersWhereInput(
    filter: UsersFilterInput | undefined,
    includeDeleted: boolean,
  ): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = includeDeleted
      ? {}
      : { deletedAt: null };

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

    const roleFilter = this.toRoleFilter(filter?.role);
    if (roleFilter) {
      where.role = roleFilter;
    }

    return where;
  }

  private resolveUsersOrderBy(
    orderField: string | undefined,
    direction: SortDirection | undefined,
  ): Prisma.UserOrderByWithRelationInput {
    const field = orderField ?? 'createdAt';
    if (!this.userSortableFields.has(field)) {
      throw new BadRequestException(`Unsupported orderBy.field: ${field}`);
    }

    const prismaDirection: Prisma.SortOrder =
      direction === SortDirection.DESC ? 'desc' : 'asc';

    return {
      [field]: prismaDirection,
    };
  }

  async getUsers(query: UsersQueryInput = {}): Promise<UsersPayload> {
    const requestedLimit =
      query.pagination?.limit ?? query.first ?? query.last ?? undefined;
    const requestedPage = query.pagination?.page ?? 1;
    const { page, limit, skip, take } = paginate(requestedPage, requestedLimit);

    const includeDeleted =
      query.filter?.includeDeleted ?? query.includeDeleted ?? false;
    const where = this.buildUsersWhereInput(query.filter, includeDeleted);
    const orderBy = this.resolveUsersOrderBy(
      query.orderBy?.field,
      query.orderBy?.direction,
    );

    const totalCount = await this.prisma.user.count({ where });

    const users = await this.prisma.user.findMany({
      where,
      orderBy,
      skip,
      take,
    });

    const data = users.map(
      (user): User => ({
        ...this.mapUser(user),
      }),
    );

    return {
      data,
      users: data,
      totalCount,
      pageInfo: {
        total: totalCount,
        page,
        limit,
        totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / limit),
      },
    };
  }
}
