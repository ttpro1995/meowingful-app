import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersQueryInput, User } from './auth.types';

describe('AuthService', () => {
  let authService: AuthService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    auth: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
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
        username: registerInput.username,
        name: registerInput.name,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.user.create.mockResolvedValue(newUser);
      mockPrismaService.auth.create.mockResolvedValue({});

      mockPrismaService.$transaction.mockImplementation(
        async (
          fn: (arg: typeof mockPrismaService) => Promise<{
            id: string;
            username: string;
            name: string;
            bio: null;
            createdAt: Date;
            updatedAt: Date;
          }>,
        ) => {
          return fn(mockPrismaService);
        },
      );

      const result = await authService.register(registerInput);

      expect(result.username).toBe(registerInput.username);
      expect(result.name).toBe(registerInput.name);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username: registerInput.username },
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
        username: loginInput.username,
        passwordHash: hashedPassword,
        salt: 'salt',
        user: {
          id: 'user-uuid',
          username: loginInput.username,
          name: 'Test User',
          bio: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const result = await authService.login(loginInput);

      expect(result.token).toBeDefined();
      expect(result.user.username).toBe(loginInput.username);
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
        username: loginInput.username,
        passwordHash: hashedPassword,
        salt: 'salt',
        user: {
          id: 'user-uuid',
          username: loginInput.username,
          name: 'Test User',
          bio: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await expect(authService.login(loginInput)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getUser', () => {
    it('should return user by id', async () => {
      const userId = 'user-uuid';

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        username: 'testuser',
        name: 'Test User',
        bio: 'Test bio',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await authService.getUser(userId);

      expect(result.id).toBe(userId);
      expect(result.username).toBe('testuser');
    });

    it('should throw BadRequestException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

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

      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        username: 'testuser',
        name: updateInput.name,
        bio: updateInput.bio,
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

      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        username: 'testuser',
        name: updateInput.name,
        bio: null,
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

      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        username: 'testuser',
        name: 'Test User',
        bio: updateInput.bio,
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

      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        username: 'testuser',
        name: updateInput.name,
        bio: updateInput.bio,
        email: updateInput.email,
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

      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        username: 'testuser',
        name: updateInput.name,
        bio: updateInput.bio,
        email: null,
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

      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        username: 'testuser',
        name: 'Existing Name',
        bio: 'Existing Bio',
        email: 'onlyemail@example.com',
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

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        username: 'testuser',
        name: 'Test User',
        bio: 'Test bio',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await authService.getMe(userId);

      expect(result.id).toBe(userId);
      expect(result.username).toBe('testuser');
    });

    it('should throw BadRequestException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(authService.getMe('nonexistent')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getUsers', () => {
    const mockUsers: User[] = [
      {
        id: 'user-uuid-1',
        username: 'user1',
        name: 'User One',
        bio: null,
        deletedAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'user-uuid-2',
        username: 'user2',
        name: 'User Two',
        bio: 'Bio for user 2',
        deletedAt: null,
        createdAt: new Date('2026-01-02T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
      },
    ];

    it('should return paginated users excluding deleted', async () => {
      mockPrismaService.user.count.mockResolvedValue(2);
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const query: UsersQueryInput = { first: 10 };
      const result = await authService.getUsers(query);

      expect(result.users.length).toBe(2);
      expect(result.totalCount).toBe(2);
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(mockPrismaService.user.count).toHaveBeenCalledWith({
        where: { deletedAt: null },
      });
    });

    it('should include deleted users when includeDeleted is true', async () => {
      mockPrismaService.user.count.mockResolvedValue(3);
      const deletedUser: User = {
        ...mockUsers[0],
        id: 'deleted-user',
        username: 'deleted',
        name: 'Deleted User',
        deletedAt: new Date('2026-05-01T00:00:00Z'),
      };

      mockPrismaService.user.findMany.mockResolvedValue([
        ...mockUsers,
        deletedUser,
      ]);
      mockPrismaService.user.count.mockResolvedValue(3);

      const query: UsersQueryInput = { first: 10, includeDeleted: true };
      const result = await authService.getUsers(query);

      expect(result.users.length).toBe(3);
      expect(result.users.some((u) => u.deletedAt)).toBe(true);
    });

    it('should filter out deleted users by default', async () => {
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.user.count.mockResolvedValue(2);

      const query: UsersQueryInput = { first: 10 };
      const result = await authService.getUsers(query);

      expect(result.users.every((u) => !u.deletedAt)).toBe(true);

      // Check findMany was called with correct where clause
      const findManyCalls = mockPrismaService.user.findMany.mock.calls;
      expect(findManyCalls.length).toBeGreaterThan(0);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const firstCallArgs = findManyCalls[0][0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(firstCallArgs.where).toEqual(
        expect.objectContaining({
          deletedAt: null,
        }),
      );
    });

    it('should support forward pagination with after cursor', async () => {
      mockPrismaService.user.count.mockResolvedValue(2);
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const afterCursor = Buffer.from(
        new Date('2026-01-01T00:00:00Z').toISOString(),
      ).toString('base64');

      const query: UsersQueryInput = {
        first: 10,
        after: afterCursor,
      };

      const result = await authService.getUsers(query);

      expect(result.pageInfo.startCursor).toBeDefined();
      expect(result.pageInfo.endCursor).toBeDefined();
    });

    it('should support backward pagination with before cursor', async () => {
      mockPrismaService.user.count.mockResolvedValue(2);
      mockPrismaService.user.findMany.mockResolvedValue(
        [...mockUsers].reverse(),
      );

      const beforeCursor = Buffer.from(
        new Date('2026-01-02T00:00:00Z').toISOString(),
      ).toString('base64');

      const query: UsersQueryInput = {
        last: 10,
        before: beforeCursor,
      };

      const result = await authService.getUsers(query);

      expect(result.users.length).toBe(2);
      expect(result.pageInfo.startCursor).toBeDefined();
      expect(result.pageInfo.endCursor).toBeDefined();
    });

    it('should set hasNextPage correctly', async () => {
      mockPrismaService.user.count.mockResolvedValue(3);
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 'user-uuid-3',
        username: 'user3',
        name: 'User Three',
        bio: null,
        deletedAt: null,
        createdAt: new Date('2026-01-03T00:00:00Z'),
        updatedAt: new Date('2026-01-03T00:00:00Z'),
      });
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const query: UsersQueryInput = { first: 2 };
      const result = await authService.getUsers(query);

      expect(result.pageInfo.hasNextPage).toBe(true);
    });

    it('should return empty results when no users exist', async () => {
      mockPrismaService.user.count.mockResolvedValue(0);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const query: UsersQueryInput = { first: 10 };
      const result = await authService.getUsers(query);

      expect(result.users).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    });

    it('should include deletedAt in User response when present', async () => {
      const deletedUser: User = {
        ...mockUsers[0],
        id: 'deleted-user',
        username: 'deleted',
        name: 'Deleted User',
        deletedAt: new Date('2026-05-01T00:00:00Z'),
      };

      mockPrismaService.user.count.mockResolvedValue(1);
      mockPrismaService.user.findMany.mockResolvedValue([deletedUser]);

      const query: UsersQueryInput = { first: 10, includeDeleted: true };
      const result = await authService.getUsers(query);

      expect(result.users[0].deletedAt).toBeInstanceOf(Date);
    });

    it('should set hasPreviousPage correctly when after cursor is provided', async () => {
      mockPrismaService.user.count.mockResolvedValue(3);
      mockPrismaService.user.findFirst.mockResolvedValueOnce({
        id: 'user-uuid-3',
        username: 'user3',
        name: 'User Three',
        bio: null,
        deletedAt: null,
        createdAt: new Date('2026-01-03T00:00:00Z'),
        updatedAt: new Date('2026-01-03T00:00:00Z'),
      });
      mockPrismaService.user.findFirst.mockResolvedValueOnce({
        id: 'user-uuid-0',
        username: 'user0',
        name: 'User Zero',
        bio: null,
        deletedAt: null,
        createdAt: new Date('2025-12-31T00:00:00Z'),
        updatedAt: new Date('2025-12-31T00:00:00Z'),
      });
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const afterCursor = Buffer.from(
        new Date('2026-01-01T00:00:00Z').toISOString(),
      ).toString('base64');

      const query: UsersQueryInput = { first: 2, after: afterCursor };
      const result = await authService.getUsers(query);

      expect(result.pageInfo.hasPreviousPage).toBe(true);
    });

    it('should set hasNextPage correctly in backward pagination', async () => {
      mockPrismaService.user.count.mockResolvedValue(3);
      mockPrismaService.user.findFirst.mockResolvedValueOnce({
        id: 'user-uuid-1',
        username: 'user1',
        name: 'User One',
        bio: null,
        deletedAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      });
      mockPrismaService.user.findMany.mockResolvedValue([
        mockUsers[0],
        mockUsers[1],
      ]);

      const beforeCursor = Buffer.from(
        new Date('2026-01-03T00:00:00Z').toISOString(),
      ).toString('base64');

      const query: UsersQueryInput = { last: 2, before: beforeCursor };
      const result = await authService.getUsers(query);

      expect(result.pageInfo.hasNextPage).toBe(true);
    });

    it('should handle last parameter without before cursor', async () => {
      mockPrismaService.user.count.mockResolvedValue(2);
      mockPrismaService.user.findMany.mockResolvedValue([...mockUsers].reverse());

      const query: UsersQueryInput = { last: 10 };
      const result = await authService.getUsers(query);

      expect(result.users.length).toBe(2);
      expect(result.pageInfo.startCursor).toBeDefined();
      expect(result.pageInfo.endCursor).toBeDefined();
    });
  });
});
