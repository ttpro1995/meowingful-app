import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import {
  RegisterInput,
  LoginInput,
  UpdateUserInput,
  ChangePasswordInput,
  UpdateUserProfileInput,
  UsersQueryInput,
  UsersPayload,
  PageInfo,
  User,
} from './auth.types';
import { CacheService } from '../redis/cache.service';

interface SessionTokenPayload extends JwtPayload {
  sub: string;
  tenantId: string;
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
  private readonly accessTokenTtlSeconds = 15 * 60;
  private readonly refreshTokenTtlSeconds = 7 * 24 * 60 * 60;
  private readonly refreshTokenKeyPrefix = 'refresh_token:';

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
      username: user.username,
      name: user.name,
      bio: user.bio ?? undefined,
      email: user.email ?? undefined,
      deletedAt: user.deletedAt ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
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
    tenantId = 'default',
  ): Promise<{ accessToken: string; refreshToken: string; jti: string }> {
    const jti = randomUUID();
    const basePayload = { sub: userId, tenantId, jti };
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

    const tokenPair = await this.generateTokenPair(user.id);

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      user: this.mapUser(user),
    };
  }

  async register(input: RegisterInput) {
    const { username, password, name } = input;

    // Check if username already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { username },
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
          username,
          name,
        },
      });

      await tx.auth.create({
        data: {
          userId: newUser.id,
          username,
          passwordHash,
          salt,
        },
      });

      return newUser;
    });

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      bio: user.bio ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async login(input: LoginInput): Promise<SessionAuthPayload> {
    const { username, password } = input;

    // Find auth record
    const auth = await this.prisma.auth.findUnique({
      where: { username },
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

    const tokenPair = await this.generateTokenPair(auth.userId);

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

    const tokenPair = await this.generateTokenPair(
      payload.sub,
      payload.tenantId,
    );

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      user: this.mapUser(user),
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
    const user = await this.prisma.user.findUnique({
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

  // New method for paginated users query
  async getUsers(query: UsersQueryInput): Promise<UsersPayload> {
    const { first, last, after, before, includeDeleted = false } = query;

    // Determine pagination direction
    const isForward = first !== undefined || (!last && !before);
    const take = first ?? last ?? 20;

    // Build where clause for soft-delete filtering
    const whereClause = includeDeleted ? {} : { deletedAt: null };

    // Build cursor conditions
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

    // Get total count (non-deleted)
    const totalCount = await this.prisma.user.count({
      where: { deletedAt: null },
    });

    // Fetch users with pagination
    const users = await this.prisma.user.findMany({
      where: cursorWhere,
      orderBy: { createdAt: isForward ? 'asc' : 'desc' },
      take: isForward ? take : -take,
    });

    // If querying backwards, reverse to maintain natural order
    const orderedUsers = isForward ? users : [...users].reverse();

    // Build page info
    const pageInfo: PageInfo = {
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

      // Check for next page
      if (isForward) {
        const nextUser = await this.prisma.user.findFirst({
          where: {
            ...whereClause,
            createdAt: { gt: orderedUsers[orderedUsers.length - 1].createdAt },
          },
          orderBy: { createdAt: 'asc' },
        });
        pageInfo.hasNextPage = !!nextUser;

        // Check for previous page
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
        // Backward pagination
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
      users: orderedUsers.map(
        (user): User => ({
          ...this.mapUser(user),
        }),
      ),
      pageInfo,
      totalCount,
    };
  }
}
