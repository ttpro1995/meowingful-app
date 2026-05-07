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
                token
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
              token: string;
              user: { username: string; name: string };
            };
          }>;
          expect(body.data?.register).toBeDefined();
          expect(body.data?.register.user.username).toBe('testuser');
          expect(body.data?.register.user.name).toBe('Test User');
        });
    });

    it('should fail to register with existing username', () => {
      return request(app.getHttpServer() as Parameters<typeof request>[0])
        .post('/graphql')
        .send({
          query: `
            mutation Register($input: RegisterInput!) {
              register(input: $input) {
                token
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
  });

  describe('/graphql (POST) - Login', () => {
    it('should login with valid credentials', () => {
      return request(app.getHttpServer() as Parameters<typeof request>[0])
        .post('/graphql')
        .send({
          query: `
            mutation Login($input: LoginInput!) {
              login(input: $input) {
                token
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
            login: { token: string; user: { username: string } };
          }>;
          expect(body.data?.login).toBeDefined();
          expect(body.data?.login.token).toBeDefined();
          expect(body.data?.login.user.username).toBe('testuser');
        });
    });

    it('should fail to login with invalid credentials', () => {
      return request(app.getHttpServer() as Parameters<typeof request>[0])
        .post('/graphql')
        .send({
          query: `
            mutation Login($input: LoginInput!) {
              login(input: $input) {
                token
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
});
