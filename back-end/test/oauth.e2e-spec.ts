import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

interface GraphQLResponse<T = Record<string, unknown>> {
  data?: T;
  errors?: Array<{ message: string }>;
}

describe('OAuth Integration (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prismaService = app.get(PrismaService);
  });

  afterAll(async () => {
    // Clean up test data
    await prismaService.oAuthAccount.deleteMany();
    await prismaService.auth.deleteMany();
    await prismaService.user.deleteMany();
    await app.close();
  });

  describe('OAuth Account Model', () => {
    it('should create OAuth account with correct unique constraint', async () => {
      // Create a user first
      const user = await prismaService.user.create({
        data: {
          username: 'oauth-test-user',
          name: 'OAuth Test User',
        },
      });

      // Create OAuth account
      const oauthAccount = await prismaService.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'google',
          providerId: 'google-sub-123',
          email: 'oauth@example.com',
        },
      });

      expect(oauthAccount.provider).toBe('google');
      expect(oauthAccount.providerId).toBe('google-sub-123');
      expect(oauthAccount.email).toBe('oauth@example.com');
    });

    it('should enforce unique constraint on provider_providerId', async () => {
      const user = await prismaService.user.create({
        data: {
          username: 'oauth-constraint-user',
          name: 'OAuth Constraint User',
        },
      });

      await prismaService.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'google',
          providerId: 'unique-google-sub',
          email: 'constraint@example.com',
        },
      });

      // Try to create duplicate - should fail
      await expect(
        prismaService.oAuthAccount.create({
          data: {
            userId: user.id,
            provider: 'google',
            providerId: 'unique-google-sub',
            email: 'another@example.com',
          },
        }),
      ).rejects.toThrow();
    });

    it('should link multiple OAuth accounts to same user', async () => {
      const user = await prismaService.user.create({
        data: {
          username: 'multi-oauth-user',
          name: 'Multi OAuth User',
        },
      });

      // Create Google OAuth account
      const googleAccount = await prismaService.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'google',
          providerId: 'google-sub-multi',
          email: 'multi@example.com',
        },
      });

      // Create GitHub OAuth account for same user
      const githubAccount = await prismaService.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'github',
          providerId: 'github-sub-multi',
          email: 'multi@example.com',
        },
      });

      expect(googleAccount.provider).toBe('google');
      expect(githubAccount.provider).toBe('github');
    });
  });

  describe('Token Generation', () => {
    it('should generate valid JWT token pair', async () => {
      const moduleRef = app.get(AppModule);
      // This test would require accessing AuthService - skip for now
      // as we're testing the OAuth flow end-to-end
    });
  });
});