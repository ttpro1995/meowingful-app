import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersQueryInput } from './auth.types';
import { CacheService } from '../redis/cache.service';
import { SortDirection } from '../shared/pagination/pagination.args';

describe('AuthService', () => {
  let authService: AuthService;

  const defaultTenant = {
    id: 'tenant-default',
    name: 'Default Tenant',
    slug: 'default',
    planTier: 'basic',
    contactEmail: 'admin@default.local',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    userTenantRole: {
      createMany: jest.fn(),
      findFirst: jest.fn(),
    },
    auth: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    role: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockCacheService = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    mockPrismaService.tenant.findUnique.mockResolvedValue(defaultTenant);
    mockPrismaService.role.upsert.mockResolvedValue({
      id: 'role-1',
      tenantId: defaultTenant.id,
      name: 'DEVELOPER',
    });
    mockPrismaService.userTenantRole.createMany.mockResolvedValue({ count: 1 });
    mockPrismaService.userTenantRole.findFirst.mockResolvedValue({
      userId: 'user-uuid',
    });
    mockPrismaService.$transaction.mockImplementation(
      async (
        arg:
          | ((tx: typeof mockPrismaService) => Promise<unknown>)
          | Promise<unknown>,
      ) => {
        if (typeof arg === 'function') {
          return arg(mockPrismaService);
        }

        return arg;
      },
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const registerInput = {
        username: 'testuser',
        password: 'password123',
        name: 'Test User',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      const newUser = {
        id: 'uuid-123',
        tenantId: defaultTenant.id,
        username: registerInput.username,
        name: registerInput.name,
        bio: null,
        role: 'USER',
        email: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.user.create.mockResolvedValue(newUser);
      mockPrismaService.auth.create.mockResolvedValue({});

      const result = await authService.register(registerInput);

      expect(result.username).toBe(registerInput.username);
      expect(result.name).toBe(registerInput.name);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          tenantId_username: {
            tenantId: defaultTenant.id,
            username: registerInput.username,
          },
        },
      });
    });

    it('should throw ConflictException if username already exists', async () => {
      const registerInput = {
        username: 'existinguser',
        password: 'password123',
        name: 'Existing User',
      };

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'uuid-123',
        tenantId: defaultTenant.id,
        username: registerInput.username,
      });

      await expect(authService.register(registerInput)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const loginInput = {
        username: 'testuser',
        password: 'password123',
      };

      const hashedPassword = await bcrypt.hash(loginInput.password, 10);

      mockPrismaService.auth.findUnique.mockResolvedValue({
        id: 'auth-uuid',
        userId: 'user-uuid',
        tenantId: defaultTenant.id,
        username: loginInput.username,
        passwordHash: hashedPassword,
        salt: 'salt',
        user: {
          id: 'user-uuid',
          tenantId: defaultTenant.id,
          role: 'USER',
          username: loginInput.username,
          name: 'Test User',
          bio: null,
          email: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const result = await authService.login(loginInput);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.username).toBe(loginInput.username);
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const loginInput = {
        username: 'nonexistent',
        password: 'password123',
      };

      mockPrismaService.auth.findUnique.mockResolvedValue(null);

      await expect(authService.login(loginInput)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      const loginInput = {
        username: 'testuser',
        password: 'wrongpassword',
      };

      const hashedPassword = await bcrypt.hash('correctpassword', 10);

      mockPrismaService.auth.findUnique.mockResolvedValue({
        id: 'auth-uuid',
        userId: 'user-uuid',
        tenantId: defaultTenant.id,
        username: loginInput.username,
        passwordHash: hashedPassword,
        salt: 'salt',
        user: {
          id: 'user-uuid',
          tenantId: defaultTenant.id,
          role: 'USER',
          username: loginInput.username,
          name: 'Test User',
          bio: null,
          email: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await expect(authService.login(loginInput)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshSession', () => {
    it('should return a new token pair for a valid refresh token', async () => {
      const loginInput = {
        username: 'testuser',
        password: 'password123',
      };

      const hashedPassword = await bcrypt.hash(loginInput.password, 10);

      mockPrismaService.auth.findUnique.mockResolvedValue({
        id: 'auth-uuid',
        userId: 'user-uuid',
        tenantId: defaultTenant.id,
        username: loginInput.username,
        passwordHash: hashedPassword,
        salt: 'salt',
        user: {
          id: 'user-uuid',
          tenantId: defaultTenant.id,
          role: 'USER',
          username: loginInput.username,
          name: 'Test User',
          bio: null,
          email: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-uuid',
        tenantId: defaultTenant.id,
        role: 'USER',
        username: loginInput.username,
        name: 'Test User',
        bio: null,
        email: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockCacheService.get.mockResolvedValue('user-uuid');

      const session = await authService.login(loginInput);
      const refreshedSession = await authService.refreshSession(
        session.refreshToken,
      );

      expect(refreshedSession.accessToken).toBeDefined();
      expect(refreshedSession.refreshToken).toBeDefined();
      expect(mockCacheService.get).toHaveBeenCalled();
      expect(mockCacheService.del).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for revoked refresh token', async () => {
      const loginInput = {
        username: 'testuser',
        password: 'password123',
      };

      const hashedPassword = await bcrypt.hash(loginInput.password, 10);

      mockPrismaService.auth.findUnique.mockResolvedValue({
        id: 'auth-uuid',
        userId: 'user-uuid',
        tenantId: defaultTenant.id,
        username: loginInput.username,
        passwordHash: hashedPassword,
        salt: 'salt',
        user: {
          id: 'user-uuid',
          tenantId: defaultTenant.id,
          role: 'USER',
          username: loginInput.username,
          name: 'Test User',
          bio: null,
          email: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const session = await authService.login(loginInput);
      mockCacheService.get.mockResolvedValue(null);

      await expect(
        authService.refreshSession(session.refreshToken),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should delete refresh token key using jti from access token', async () => {
      const loginInput = {
        username: 'testuser',
        password: 'password123',
      };

      const hashedPassword = await bcrypt.hash(loginInput.password, 10);

      mockPrismaService.auth.findUnique.mockResolvedValue({
        id: 'auth-uuid',
        userId: 'user-uuid',
        tenantId: defaultTenant.id,
        username: loginInput.username,
        passwordHash: hashedPassword,
        salt: 'salt',
        user: {
          id: 'user-uuid',
          tenantId: defaultTenant.id,
          role: 'USER',
          username: loginInput.username,
          name: 'Test User',
          bio: null,
          email: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const session = await authService.login(loginInput);
      const result = await authService.logout(session.accessToken);

      expect(result).toBe(true);
      expect(mockCacheService.del).toHaveBeenCalled();
    });
  });

  describe('getUser', () => {
    it('should return user by id', async () => {
      const userId = 'user-uuid';

      mockPrismaService.user.findFirst.mockResolvedValue({
        id: userId,
        tenantId: defaultTenant.id,
        role: 'USER',
        username: 'testuser',
        name: 'Test User',
        bio: 'Test bio',
        email: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await authService.getUser(userId);

      expect(result.id).toBe(userId);
      expect(result.username).toBe('testuser');
    });

    it('should throw BadRequestException if user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(authService.getUser('nonexistent')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateUser', () => {
    it('should update user profile', async () => {
      const userId = 'user-uuid';
      const updateInput = {
        name: 'Updated Name',
        bio: 'Updated bio',
      };

      mockPrismaService.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: userId,
        tenantId: defaultTenant.id,
        role: 'USER',
        username: 'testuser',
        name: updateInput.name,
        bio: updateInput.bio,
        email: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await authService.updateUser(userId, updateInput);

      expect(result.name).toBe(updateInput.name);
      expect(result.bio).toBe(updateInput.bio);
    });

    it('should update user with only name', async () => {
      const userId = 'user-uuid';
      const updateInput = {
        name: 'Only Name Update',
      };

      mockPrismaService.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: userId,
        tenantId: defaultTenant.id,
        role: 'USER',
        username: 'testuser',
        name: updateInput.name,
        bio: null,
        email: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await authService.updateUser(userId, updateInput);

      expect(result.name).toBe(updateInput.name);
    });

    it('should update user with only bio', async () => {
      const userId = 'user-uuid';
      const updateInput = {
        bio: 'Only bio update',
      };

      mockPrismaService.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: userId,
        tenantId: defaultTenant.id,
        role: 'USER',
        username: 'testuser',
        name: 'Test User',
        bio: updateInput.bio,
        email: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await authService.updateUser(userId, updateInput);

      expect(result.bio).toBe(updateInput.bio);
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile with email', async () => {
      const userId = 'user-uuid';
      const updateInput = {
        name: 'Updated Name',
        bio: 'Updated bio',
        email: 'test@example.com',
      };

      mockPrismaService.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: userId,
        tenantId: defaultTenant.id,
        role: 'USER',
        username: 'testuser',
        name: updateInput.name,
        bio: updateInput.bio,
        email: updateInput.email,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await authService.updateUserProfile(userId, updateInput);

      expect(result.name).toBe(updateInput.name);
      expect(result.bio).toBe(updateInput.bio);
      expect(result.email).toBe(updateInput.email);
    });

    it('should update user profile without email', async () => {
      const userId = 'user-uuid';
      const updateInput = {
        name: 'Updated Name',
        bio: 'Updated bio',
        email: undefined,
      };

      mockPrismaService.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: userId,
        tenantId: defaultTenant.id,
        role: 'USER',
        username: 'testuser',
        name: updateInput.name,
        bio: updateInput.bio,
        email: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await authService.updateUserProfile(userId, updateInput);

      expect(result.name).toBe(updateInput.name);
      expect(result.email).toBeUndefined();
    });

    it('should handle email update only', async () => {
      const userId = 'user-uuid';
      const updateInput = {
        name: undefined,
        bio: undefined,
        email: 'onlyemail@example.com',
      };

      mockPrismaService.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: userId,
        tenantId: defaultTenant.id,
        role: 'USER',
        username: 'testuser',
        name: 'Existing Name',
        bio: 'Existing Bio',
        email: 'onlyemail@example.com',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await authService.updateUserProfile(userId, updateInput);

      expect(result.email).toBe('onlyemail@example.com');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const userId = 'user-uuid';
      const changePasswordInput = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword',
      };

      const hashedPassword = await bcrypt.hash(
        changePasswordInput.currentPassword,
        10,
      );

      mockPrismaService.auth.findFirst.mockResolvedValue({
        id: 'auth-uuid',
        userId,
        passwordHash: hashedPassword,
      });

      const result = await authService.changePassword(
        userId,
        changePasswordInput,
      );

      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException if current password is incorrect', async () => {
      const userId = 'user-uuid';
      const changePasswordInput = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword',
      };

      const hashedPassword = await bcrypt.hash('correctpassword', 10);

      mockPrismaService.auth.findFirst.mockResolvedValue({
        id: 'auth-uuid',
        userId,
        passwordHash: hashedPassword,
      });

      await expect(
        authService.changePassword(userId, changePasswordInput),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException if auth record not found', async () => {
      const userId = 'user-uuid';
      const changePasswordInput = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword',
      };

      mockPrismaService.auth.findFirst.mockResolvedValue(null);

      await expect(
        authService.changePassword(userId, changePasswordInput),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMe', () => {
    it('should return user by id', async () => {
      const userId = 'user-uuid';

      mockPrismaService.user.findFirst.mockResolvedValue({
        id: userId,
        tenantId: defaultTenant.id,
        role: 'USER',
        username: 'testuser',
        name: 'Test User',
        bio: 'Test bio',
        email: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await authService.getMe(userId);

      expect(result.id).toBe(userId);
      expect(result.username).toBe('testuser');
    });

    it('should throw BadRequestException if user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(authService.getMe('nonexistent')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getUsers', () => {
    const mockUsers = [
      {
        id: 'user-uuid-1',
        tenantId: defaultTenant.id,
        role: 'USER',
        username: 'user1',
        name: 'User One',
        bio: null,
        email: null,
        deletedAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'user-uuid-2',
        tenantId: defaultTenant.id,
        role: 'USER',
        username: 'user2',
        name: 'User Two',
        bio: 'Bio for user 2',
        email: null,
        deletedAt: null,
        createdAt: new Date('2026-01-02T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
      },
    ];

    it('returns paginated users with page metadata', async () => {
      mockPrismaService.user.count.mockResolvedValue(2);
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const query: UsersQueryInput = {
        pagination: {
          page: 1,
          limit: 20,
        },
      };
      const result = await authService.getUsers(query);

      expect(result.data.length).toBe(2);
      expect(result.users.length).toBe(2);
      expect(result.totalCount).toBe(2);
      expect(result.pageInfo).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });

    it('clamps limit to 100 for unbounded requests', async () => {
      mockPrismaService.user.count.mockResolvedValue(150);
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      await authService.getUsers({
        pagination: {
          page: 1,
          limit: 200,
        },
      });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
          skip: 0,
        }),
      );
    });

    it('includes deleted users when filter.includeDeleted is true', async () => {
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.user.count.mockResolvedValue(2);

      await authService.getUsers({
        filter: {
          includeDeleted: true,
        },
      });

      expect(mockPrismaService.user.count).toHaveBeenCalledWith({
        where: {},
      });
    });

    it('applies orderBy and common filters', async () => {
      mockPrismaService.user.count.mockResolvedValue(2);
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const createdAtFilter = new Date('2026-01-01T00:00:00Z').toISOString();

      const query: UsersQueryInput = {
        pagination: {
          page: 2,
          limit: 1,
        },
        orderBy: {
          field: 'username',
          direction: SortDirection.DESC,
        },
        filter: {
          username: { contains: 'user' },
          role: { equals: 'USER' },
          createdAt: { gte: createdAtFilter },
        },
      };

      await authService.getUsers(query);

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 1,
          take: 1,
          orderBy: { username: 'desc' },
        }),
      );

      const countCalls = (
        mockPrismaService.user.count as {
          mock: { calls: unknown[][] };
        }
      ).mock.calls;
      const countArgs = countCalls[0]?.[0] as {
        where: {
          username?: { contains?: string; mode?: string };
          role?: { equals?: string };
          createdAt?: { gte?: Date };
        };
      };
      expect(countArgs.where.username?.contains).toBe('user');
      expect(countArgs.where.username?.mode).toBe('insensitive');
      expect(countArgs.where.role?.equals).toBe('USER');
      expect(countArgs.where.createdAt?.gte).toEqual(new Date(createdAtFilter));
    });

    it('throws when orderBy.field is unsupported', async () => {
      await expect(
        authService.getUsers({
          orderBy: {
            field: 'unsupportedField',
            direction: SortDirection.ASC,
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
