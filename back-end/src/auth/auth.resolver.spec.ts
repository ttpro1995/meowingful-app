import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';

describe('AuthResolver', () => {
  let authResolver: AuthResolver;

  const mockAuthService = {
    register: jest.fn(),
    issueSessionForUser: jest.fn(),
    login: jest.fn(),
    refreshSession: jest.fn(),
    logout: jest.fn(),
    getUser: jest.fn(),
    getMe: jest.fn(),
    getUsers: jest.fn(),
    updateUser: jest.fn(),
    updateUserProfile: jest.fn(),
    changePassword: jest.fn(),
  };

  const createMockResponse = () => ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  });

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
    it('should register a new user and return accessToken with user', async () => {
      const registerInput = {
        username: 'testuser',
        password: 'password123',
        name: 'Test User',
      };

      const response = createMockResponse();

      const mockUser = {
        id: 'user-uuid',
        username: registerInput.username,
        name: registerInput.name,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuthService.register.mockResolvedValue(mockUser);
      mockAuthService.issueSessionForUser.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: mockUser,
      });

      const result = await authResolver.register(
        registerInput,
        response as never,
      );

      expect(mockAuthService.register).toHaveBeenCalledWith(registerInput);
      expect(mockAuthService.issueSessionForUser).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(response.cookie).toHaveBeenCalled();
      expect(result.user).toEqual(mockUser);
      expect(result.accessToken).toBeDefined();
    });
  });

  describe('login', () => {
    it('should login and return auth payload', async () => {
      const loginInput = {
        username: 'testuser',
        password: 'password123',
      };

      const response = createMockResponse();

      const mockAuthPayload = {
        accessToken: 'access-token-string',
        refreshToken: 'refresh-token-string',
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

      const result = await authResolver.login(loginInput, response as never);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginInput);
      expect(response.cookie).toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: mockAuthPayload.accessToken,
        user: mockAuthPayload.user,
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh session using refresh token cookie', async () => {
      const req = {
        cookies: { refreshToken: 'refresh-token-value' },
        headers: {},
      };
      const res = createMockResponse();

      const mockPayload = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: {
          id: 'user-uuid',
          username: 'testuser',
          name: 'Test User',
          bio: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      mockAuthService.refreshSession.mockResolvedValue(mockPayload);

      const result = await authResolver.refreshToken(
        req as never,
        res as never,
      );

      expect(mockAuthService.refreshSession).toHaveBeenCalledWith(
        'refresh-token-value',
      );
      expect(res.cookie).toHaveBeenCalled();
      expect(result.accessToken).toBe('new-access-token');
    });
  });

  describe('logout', () => {
    it('should logout and clear refresh cookie', async () => {
      const req = {
        headers: {
          authorization: 'Bearer access-token-value',
        },
      };
      const res = createMockResponse();

      mockAuthService.logout.mockResolvedValue(true);

      const result = await authResolver.logout(req as never, res as never);

      expect(mockAuthService.logout).toHaveBeenCalledWith('access-token-value');
      expect(res.clearCookie).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('getUser', () => {
    it('should return user by id', async () => {
      const userId = 'user-uuid';

      const mockUser = {
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

      const mockUser = {
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

    it('should handle getMe with different user id', async () => {
      const userId = 'another-user-uuid';

      const mockUser = {
        id: userId,
        username: 'anotheruser',
        name: 'Another User',
        bio: 'Another bio',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuthService.getMe.mockResolvedValue(mockUser);

      const result = await authResolver.getMe(userId);

      expect(mockAuthService.getMe).toHaveBeenCalledWith(userId);
      expect(result.user.id).toBe(userId);
    });
  });

  describe('updateUser', () => {
    it('should update user and return updated user', async () => {
      const userId = 'user-uuid';
      const updateInput = {
        name: 'Updated Name',
        bio: 'Updated bio',
      };

      const mockUser = {
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

    it('should update user with partial input', async () => {
      const userId = 'user-uuid';
      const updateInput = {
        name: 'Only Name Update',
      };

      const mockUser = {
        id: userId,
        username: 'testuser',
        name: updateInput.name,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuthService.updateUser.mockResolvedValue(mockUser);

      const result = await authResolver.updateUser(userId, updateInput);

      expect(mockAuthService.updateUser).toHaveBeenCalledWith(
        userId,
        updateInput,
      );
      expect(result.name).toBe(updateInput.name);
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

      const mockUser = {
        id: userId,
        username: 'testuser',
        name: updateInput.name,
        bio: updateInput.bio,
        email: updateInput.email,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuthService.updateUserProfile.mockResolvedValue(mockUser);

      const result = await authResolver.updateUserProfile(userId, updateInput);

      expect(mockAuthService.updateUserProfile).toHaveBeenCalledWith(
        userId,
        updateInput,
      );
      expect(result).toEqual(mockUser);
    });

    it('should update user profile without email', async () => {
      const userId = 'user-uuid';
      const updateInput = {
        name: 'Updated Name',
        bio: 'Updated bio',
      };

      const mockUser = {
        id: userId,
        username: 'testuser',
        name: updateInput.name,
        bio: updateInput.bio,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuthService.updateUserProfile.mockResolvedValue(mockUser);

      const result = await authResolver.updateUserProfile(userId, updateInput);

      expect(mockAuthService.updateUserProfile).toHaveBeenCalledWith(
        userId,
        updateInput,
      );
      expect(result.name).toBe(updateInput.name);
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

      await authResolver.users(query);

      expect(mockAuthService.getUsers).toHaveBeenCalledWith(query);
    });
  });
});
