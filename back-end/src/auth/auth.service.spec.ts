import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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
    prismaService = module.get<PrismaService>(PrismaService);
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

      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        return fn(mockPrismaService);
      });

      const result = await authService.register(registerInput);

      expect(result.username).toBe(registerInput.username);
      expect(result.name).toBe(registerInput.name);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
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
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const userId = 'user-uuid';
      const changePasswordInput = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword',
      };

      const hashedPassword = await bcrypt.hash(changePasswordInput.currentPassword, 10);

      mockPrismaService.auth.findFirst.mockResolvedValue({
        id: 'auth-uuid',
        userId,
        passwordHash: hashedPassword,
      });

      const result = await authService.changePassword(userId, changePasswordInput);

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
  });
});
