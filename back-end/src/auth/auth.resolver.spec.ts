import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { User } from '@prisma/client';

describe('AuthResolver', () => {
  let authResolver: AuthResolver;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    getUser: jest.fn(),
    getMe: jest.fn(),
    getUsers: jest.fn(),
    updateUser: jest.fn(),
    changePassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    authResolver = module.get<AuthResolver>(AuthResolver);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user and return token with user', async () => {
      const registerInput = {
        username: 'testuser',
        password: 'password123',
        name: 'Test User',
      };

      const mockUser: User = {
        id: 'user-uuid',
        username: registerInput.username,
        name: registerInput.name,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuthService.register.mockResolvedValue(mockUser);

      const result = await authResolver.register(registerInput);

      expect(mockAuthService.register).toHaveBeenCalledWith(registerInput);
      expect(result.user).toEqual(mockUser);
      expect(result.token).toBeDefined();
    });
  });

  describe('login', () => {
    it('should login and return auth payload', async () => {
      const loginInput = {
        username: 'testuser',
        password: 'password123',
      };

      const mockAuthPayload = {
        token: 'token-string',
        user: {
          id: 'user-uuid',
          username: 'testuser',
          name: 'Test User',
          bio: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      mockAuthService.login.mockResolvedValue(mockAuthPayload);

      const result = await authResolver.login(loginInput);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginInput);
      expect(result).toEqual(mockAuthPayload);
    });
  });

  describe('getUser', () => {
    it('should return user by id', async () => {
      const userId = 'user-uuid';

      const mockUser: User = {
        id: userId,
        username: 'testuser',
        name: 'Test User',
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuthService.getUser.mockResolvedValue(mockUser);

      const result = await authResolver.getUser(userId);

      expect(mockAuthService.getUser).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUser);
    });
  });

  describe('getMe', () => {
    it('should return user by id', async () => {
      const userId = 'user-uuid';

      const mockUser: User = {
        id: userId,
        username: 'testuser',
        name: 'Test User',
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuthService.getMe.mockResolvedValue(mockUser);

      const result = await authResolver.getMe(userId);

      expect(mockAuthService.getMe).toHaveBeenCalledWith(userId);
      expect(result.user).toEqual(mockUser);
    });
  });

  describe('updateUser', () => {
    it('should update user and return updated user', async () => {
      const userId = 'user-uuid';
      const updateInput = {
        name: 'Updated Name',
        bio: 'Updated bio',
      };

      const mockUser: User = {
        id: userId,
        username: 'testuser',
        name: updateInput.name,
        bio: updateInput.bio,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuthService.updateUser.mockResolvedValue(mockUser);

      const result = await authResolver.updateUser(userId, updateInput);

      expect(mockAuthService.updateUser).toHaveBeenCalledWith(
        userId,
        updateInput,
      );
      expect(result).toEqual(mockUser);
    });
  });

  describe('changePassword', () => {
    it('should change password and return true', async () => {
      const userId = 'user-uuid';
      const changePasswordInput = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword',
      };

      mockAuthService.changePassword.mockResolvedValue(true);

      const result = await authResolver.changePassword(
        userId,
        changePasswordInput,
      );

      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        userId,
        changePasswordInput,
      );
      expect(result).toBe(true);
    });
  });

  describe('users', () => {
    it('should return paginated users', async () => {
      const mockResult = {
        users: [],
        pageInfo: {
          startCursor: undefined,
          endCursor: undefined,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        totalCount: 0,
      };

      mockAuthService.getUsers.mockResolvedValue(mockResult);

      const result = await authResolver.users({});

      expect(mockAuthService.getUsers).toHaveBeenCalledWith({});
      expect(result).toEqual(mockResult);
    });

    it('should pass query args to service', async () => {
      const query = {
        first: 10,
        after: 'cursor123',
        includeDeleted: false,
      };

      const mockResult = {
        users: [] as User[],
        pageInfo: {
          startCursor: undefined,
          endCursor: undefined,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        totalCount: 0,
      };

      mockAuthService.getUsers.mockResolvedValue(mockResult);

      await authResolver.users(query);

      expect(mockAuthService.getUsers).toHaveBeenCalledWith(query);
    });
  });
});
