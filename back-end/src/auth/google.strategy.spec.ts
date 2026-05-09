import { Test, TestingModule } from '@nestjs/testing';
import { GoogleStrategy } from './google.strategy';
import { PrismaService } from '../prisma/prisma.service';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  const mockPrismaService = {
    oAuthAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeAll(() => {
    // Set required environment variables for Google OAuth
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleStrategy,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    strategy = module.get<GoogleStrategy>(GoogleStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should return existing user when OAuth account already exists', async () => {
      const profile = {
        id: 'google-sub-123',
        emails: [{ value: 'test@example.com' }],
        displayName: 'Test User',
        photos: [{ value: 'https://example.com/photo.jpg' }],
      };

      const existingOAuthAccount = {
        id: 'oauth-uuid',
        userId: 'user-uuid',
        provider: 'google',
        providerId: 'google-sub-123',
        email: 'test@example.com',
        user: {
          id: 'user-uuid',
          username: 'test@example.com',
          name: 'Test User',
        },
      };

      mockPrismaService.oAuthAccount.findUnique.mockResolvedValue(
        existingOAuthAccount,
      );

      return new Promise<void>((resolve, reject) => {
        strategy.validate(
          'accessToken',
          'refreshToken',
          profile,
          (err, user) => {
            if (err) {
              reject(err);
            } else {
              expect(user.userId).toBe('user-uuid');
              expect(user.email).toBe('test@example.com');
              expect(user.provider).toBe('google');
              resolve();
            }
          },
        );
      });
    });

    it('should create new user when OAuth account does not exist', async () => {
      const profile = {
        id: 'new-google-sub-456',
        emails: [{ value: 'newuser@example.com' }],
        displayName: 'New User',
        photos: [{ value: 'https://example.com/photo.jpg' }],
      };

      mockPrismaService.oAuthAccount.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-user-uuid',
        username: 'newuser@example.com',
        name: 'New User',
      });
      mockPrismaService.oAuthAccount.create.mockResolvedValue({
        id: 'new-oauth-uuid',
        userId: 'new-user-uuid',
        provider: 'google',
        providerId: 'new-google-sub-456',
        email: 'newuser@example.com',
        user: {
          id: 'new-user-uuid',
          username: 'newuser@example.com',
          name: 'New User',
        },
      });

      return new Promise<void>((resolve, reject) => {
        strategy.validate(
          'accessToken',
          'refreshToken',
          profile,
          (err, user) => {
            if (err) {
              reject(err);
            } else {
              expect(user.userId).toBe('new-user-uuid');
              expect(user.email).toBe('newuser@example.com');
              expect(mockPrismaService.user.create).toHaveBeenCalled();
              expect(mockPrismaService.oAuthAccount.create).toHaveBeenCalled();
              resolve();
            }
          },
        );
      });
    });

    it('should throw error if no email in profile', async () => {
      const profile = {
        id: 'google-sub-789',
        emails: [],
        displayName: 'No Email User',
        photos: [{ value: 'https://example.com/photo.jpg' }],
      };

      return new Promise<void>((resolve) => {
        strategy.validate(
          'accessToken',
          'refreshToken',
          profile,
          (err, user) => {
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toBe('No email found in Google profile');
            resolve();
          },
        );
      });
    });
  });
});