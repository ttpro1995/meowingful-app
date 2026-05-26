import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

interface GraphQLResponse<T = Record<string, unknown>> {
  data?: T;
  errors?: Array<{
    message: string;
    extensions?: {
      code?: string;
      field?: string;
      errors?: Array<{
        code: string;
        message: string;
        field?: string;
      }>;
    };
  }>;
}

describe('AuthResolver (e2e)', () => {
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
    await prismaService.auth.deleteMany();
    await prismaService.user.deleteMany();
    await app.close();
  });

  describe('/graphql (POST) - Register', () => {
    it('should register a new user', () => {
      return request(app.getHttpServer() as Parameters<typeof request>[0])
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                accessToken
                user {
                  id
                  username
                  name
                  bio
                }
              }
            }
          `,
          variables: {
            input: {
              username: 'testuser',
              password: 'password123',
              name: 'Test User',
            },
          },
        })
        .expect(200)
        .expect((res: request.Response) => {
          const body = res.body as GraphQLResponse<{
            register: {
              accessToken: string;
              user: { username: string; name: string };
            };
          }>;
          expect(body.data?.register).toBeDefined();
          expect(body.data?.register.accessToken).toBeDefined();
          expect(body.data?.register.user.username).toBe('testuser');
          expect(body.data?.register.user.name).toBe('Test User');
          expect(res.headers['set-cookie']).toBeDefined();
          expect((res.headers['set-cookie'] as string[])[0]).toContain(
            'refreshToken=',
          );
        });
    });

    it('should fail to register with existing username', () => {
      return request(app.getHttpServer() as Parameters<typeof request>[0])
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                accessToken
                user {
                  id
                  username
                  name
                }
              }
            }
          `,
          variables: {
            input: {
              username: 'testuser',
              password: 'password123',
              name: 'Another User',
            },
          },
        })
        .expect(200)
        .expect((res: request.Response) => {
          const body = res.body as GraphQLResponse<{ register: null }>;
          expect(body.errors).toBeDefined();
          expect(body.errors?.[0].message).toContain('Username already exists');
        });
    });

    it('should return standardized field-level validation errors', () => {
      const username = `validationuser${Date.now()}`;

      return request(app.getHttpServer() as Parameters<typeof request>[0])
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                accessToken
                user {
                  id
                }
              }
            }
          `,
          variables: {
            input: {
              username,
              password: 'password123',
              name: 'Validation Test User',
            },
          },
        })
        .expect(200)
        .then((registerRes) => {
          const registerBody = registerRes.body as GraphQLResponse<{
            register: {
              accessToken: string;
              user: {
                id: string;
              };
            };
          }>;

          const accessToken = registerBody.data?.register.accessToken;
          const userId = registerBody.data?.register.user.id;
          expect(accessToken).toBeDefined();
          expect(userId).toBeDefined();

          return request(app.getHttpServer() as Parameters<typeof request>[0])
            .post('/graphql')
            .set('Authorization', `Bearer ${accessToken ?? ''}`)
            .send({
              query: `
                mutation UpdateUserProfile($userId: String!, $input: UpdateUserProfileInput!) {
                  updateUserProfile(userId: $userId, input: $input) {
                    id
                  }
                }
              `,
              variables: {
                userId,
                input: {
                  email: 'not-an-email',
                },
              },
            })
            .expect(200)
            .expect((res: request.Response) => {
              const body = res.body as GraphQLResponse<{
                updateUserProfile: null;
              }>;
              expect(body.errors).toBeDefined();

              const firstError = body.errors?.[0];
              expect(firstError?.extensions?.code).toBe('VALIDATION_ERROR');

              const userErrors = firstError?.extensions?.errors ?? [];
              expect(userErrors.length).toBeGreaterThan(0);
              expect(userErrors[0].code).toBe('VALIDATION_ERROR');
              expect(userErrors[0].field).toBe('email');
            });
        });
    });
  });

  describe('/graphql (POST) - Login', () => {
    it('should login with valid credentials', () => {
      return request(app.getHttpServer() as Parameters<typeof request>[0])
        .post('/graphql')
        .send({
          query: `
            mutation Login($input: LoginInput!) {
              login(input: $input) {
                accessToken
                user {
                  id
                  username
                  name
                }
              }
            }
          `,
          variables: {
            input: {
              username: 'testuser',
              password: 'password123',
            },
          },
        })
        .expect(200)
        .expect((res: request.Response) => {
          const body = res.body as GraphQLResponse<{
            login: { accessToken: string; user: { username: string } };
          }>;
          expect(body.data?.login).toBeDefined();
          expect(body.data?.login.accessToken).toBeDefined();
          expect(body.data?.login.user.username).toBe('testuser');
          expect(res.headers['set-cookie']).toBeDefined();
        });
    });

    it('should fail to login with invalid credentials', () => {
      return request(app.getHttpServer() as Parameters<typeof request>[0])
        .post('/graphql')
        .send({
          query: `
            mutation Login($input: LoginInput!) {
              login(input: $input) {
                accessToken
                user {
                  id
                  username
                }
              }
            }
          `,
          variables: {
            input: {
              username: 'testuser',
              password: 'wrongpassword',
            },
          },
        })
        .expect(200)
        .expect((res: request.Response) => {
          const body = res.body as GraphQLResponse<{ login: null }>;
          expect(body.errors).toBeDefined();
          expect(body.errors?.[0].message).toContain('Invalid credentials');
        });
    });
  });

  describe('/graphql (POST) - Refresh Token and Logout', () => {
    it('should refresh tokens using HttpOnly cookie', async () => {
      const username = `refreshuser${Date.now()}`;

      await request(app.getHttpServer() as Parameters<typeof request>[0])
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                user {
                  id
                }
              }
            }
          `,
          variables: {
            input: {
              username,
              password: 'password123',
              name: 'Refresh Test User',
            },
          },
        })
        .expect(200);

      const loginRes = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/graphql')
        .send({
          query: `
            mutation Login($input: LoginInput!) {
              login(input: $input) {
                accessToken
                user {
                  id
                }
              }
            }
          `,
          variables: {
            input: {
              username,
              password: 'password123',
            },
          },
        })
        .expect(200);

      const loginCookies = loginRes.headers['set-cookie'] as string[];
      expect(loginCookies).toBeDefined();
      expect(loginCookies[0]).toContain('refreshToken=');
      expect(loginCookies[0]).toContain('HttpOnly');
      expect(loginCookies[0]).toContain('Secure');
      expect(loginCookies[0]).toContain('SameSite=Strict');

      const refreshCookieHeader = loginCookies[0].split(';')[0];

      const refreshRes = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/graphql')
        .set('Cookie', refreshCookieHeader)
        .send({
          query: `
            mutation RefreshToken {
              refreshToken {
                accessToken
                user {
                  id
                }
              }
            }
          `,
        })
        .expect(200);

      const refreshBody = refreshRes.body as GraphQLResponse<{
        refreshToken: { accessToken: string };
      }>;

      expect(refreshBody.data?.refreshToken.accessToken).toBeDefined();
      expect(refreshRes.headers['set-cookie']).toBeDefined();
    });

    it('should reject refresh after logout', async () => {
      const username = `logoutrefresh${Date.now()}`;

      await request(app.getHttpServer() as Parameters<typeof request>[0])
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                user {
                  id
                }
              }
            }
          `,
          variables: {
            input: {
              username,
              password: 'password123',
              name: 'Logout Refresh User',
            },
          },
        })
        .expect(200);

      const loginRes = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/graphql')
        .send({
          query: `
            mutation Login($input: LoginInput!) {
              login(input: $input) {
                accessToken
              }
            }
          `,
          variables: {
            input: {
              username,
              password: 'password123',
            },
          },
        })
        .expect(200);

      const loginBody = loginRes.body as GraphQLResponse<{
        login: { accessToken: string };
      }>;
      const accessToken = loginBody.data?.login.accessToken;
      expect(accessToken).toBeDefined();

      const loginCookies = loginRes.headers['set-cookie'] as string[];
      const refreshCookieHeader = loginCookies[0].split(';')[0];

      await request(app.getHttpServer() as Parameters<typeof request>[0])
        .post('/graphql')
        .set('Authorization', `Bearer ${accessToken ?? ''}`)
        .send({
          query: `
            mutation Logout {
              logout
            }
          `,
        })
        .expect(200)
        .expect((res: request.Response) => {
          const body = res.body as GraphQLResponse<{ logout: boolean }>;
          expect(body.data?.logout).toBe(true);
        });

      await request(app.getHttpServer() as Parameters<typeof request>[0])
        .post('/graphql')
        .set('Cookie', refreshCookieHeader)
        .send({
          query: `
            mutation RefreshToken {
              refreshToken {
                accessToken
                user {
                  id
                }
              }
            }
          `,
        })
        .expect(200)
        .expect((res: request.Response) => {
          const body = res.body as GraphQLResponse<{ refreshToken: null }>;
          expect(body.errors).toBeDefined();
          expect(body.errors?.[0].message).toContain(
            'Refresh token has been revoked',
          );
        });
    });
  });

  describe('/graphql (POST) - GetMe', () => {
    it('should return the current user', async () => {
      // Register a user first
      const username = `getmeuser${Date.now()}`;
      const registerRes = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                user {
                  id
                }
              }
            }
          `,
          variables: {
            input: {
              username,
              password: 'password123',
              name: 'GetMe Test User',
            },
          },
        })
        .expect(200);

      const body = registerRes.body as GraphQLResponse<{
        register: { user: { id: string } };
      }>;
      const userId = body.data?.register?.user?.id;
      expect(userId).toBeDefined();

      const loginRes = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .post('/graphql')
        .send({
          query: `
            mutation Login($input: LoginInput!) {
              login(input: $input) {
                accessToken
              }
            }
          `,
          variables: {
            input: {
              username,
              password: 'password123',
            },
          },
        })
        .expect(200);

      const loginBody = loginRes.body as GraphQLResponse<{
        login: { accessToken: string };
      }>;
      const accessToken = loginBody.data?.login.accessToken;
      expect(accessToken).toBeDefined();

      // Now call getMe with the created user ID
      return request(app.getHttpServer() as Parameters<typeof request>[0])
        .post('/graphql')
        .set('Authorization', `Bearer ${accessToken ?? ''}`)
        .send({
          query: `
            query GetMe($userId: String!) {
              getMe(userId: $userId) {
                user {
                  id
                  username
                  name
                  bio
                }
              }
            }
          `,
          variables: { userId },
        })
        .expect(200)
        .expect((res: request.Response) => {
          const body = res.body as GraphQLResponse<{
            getMe: { user: { id: string; username: string; name: string } };
          }>;
          expect(body.data?.getMe).toBeDefined();
          expect(body.data?.getMe.user.id).toBe(userId);
        });
    });
  });
});
