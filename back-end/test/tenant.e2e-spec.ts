import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

interface GraphQLResponse<T = Record<string, unknown>> {
  data?: T;
  errors?: Array<{ message: string }>;
}

describe('TenantManagement (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  const uniquePart = Date.now();
  const testSlugPrefix = `tenant-e2e-${uniquePart}`;
  const testUserPrefix = `te${uniquePart}`;

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
    const testTenants = await prismaService.tenant.findMany({
      where: {
        slug: {
          startsWith: testSlugPrefix,
        },
      },
      select: {
        id: true,
      },
    });
    const tenantIds = testTenants.map((tenant) => tenant.id);

    await prismaService.rolePermission.deleteMany({
      where: {
        role: {
          tenantId: {
            in: tenantIds,
          },
        },
      },
    });

    await prismaService.invitation.deleteMany({
      where: {
        tenantId: {
          in: tenantIds,
        },
      },
    });

    await prismaService.userTenantRole.deleteMany({
      where: {
        tenantId: {
          in: tenantIds,
        },
      },
    });

    await prismaService.auth.deleteMany({
      where: {
        OR: [
          {
            username: {
              startsWith: testUserPrefix,
            },
          },
          {
            tenantId: {
              in: tenantIds,
            },
          },
        ],
      },
    });

    await prismaService.user.deleteMany({
      where: {
        OR: [
          {
            username: {
              startsWith: testUserPrefix,
            },
          },
          {
            tenantId: {
              in: tenantIds,
            },
          },
        ],
      },
    });

    await prismaService.role.deleteMany({
      where: {
        tenantId: {
          in: tenantIds,
        },
      },
    });

    await prismaService.tenant.deleteMany({
      where: {
        id: {
          in: tenantIds,
        },
      },
    });

    await app.close();
  });

  it('blocks request without tenant context', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/graphql')
      .send({
        query: `
          query Users {
            users(query: {}) {
              totalCount
            }
          }
        `,
      })
      .expect(200)
      .expect((res: request.Response) => {
        const body = res.body as GraphQLResponse<{ users: null }>;
        expect(body.errors).toBeDefined();
        expect(body.errors?.[0].message).toContain('UNAUTHORIZED');
      });
  });

  it('isolates users between tenants with the same username', async () => {
    const tenantA = await prismaService.tenant.create({
      data: {
        name: `${testSlugPrefix}-A`,
        slug: `${testSlugPrefix}-a`,
        contactEmail: `${testSlugPrefix}-a@example.com`,
      },
    });

    const tenantB = await prismaService.tenant.create({
      data: {
        name: `${testSlugPrefix}-B`,
        slug: `${testSlugPrefix}-b`,
        contactEmail: `${testSlugPrefix}-b@example.com`,
      },
    });

    const sharedUsername = `${testUserPrefix}shared`;

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
            username: sharedUsername,
            password: 'password123',
            name: 'Tenant A User',
            tenantSlug: tenantA.slug,
          },
        },
      })
      .expect(200);

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
            username: `${sharedUsername}2`,
            password: 'password123',
            name: 'Tenant A User 2',
            tenantSlug: tenantA.slug,
          },
        },
      })
      .expect(200);

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
            username: sharedUsername,
            password: 'password123',
            name: 'Tenant B User',
            tenantSlug: tenantB.slug,
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
            username: sharedUsername,
            password: 'password123',
            tenantSlug: tenantA.slug,
          },
        },
      })
      .expect(200);

    const loginBody = loginRes.body as GraphQLResponse<{
      login: { accessToken: string };
    }>;

    const accessToken = loginBody.data?.login.accessToken;
    expect(accessToken).toBeDefined();

    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/graphql')
      .set('Authorization', `Bearer ${accessToken ?? ''}`)
      .send({
        query: `
          query Users {
            users(
              query: {
                pagination: { page: 2, limit: 1 }
                orderBy: { field: "createdAt", direction: ASC }
              }
            ) {
              data {
                id
                tenantId
                username
              }
              pageInfo {
                total
                page
                limit
                totalPages
              }
            }
          }
        `,
      })
      .expect(200)
      .expect((res: request.Response) => {
        const body = res.body as GraphQLResponse<{
          users: {
            data: Array<{ id: string; tenantId: string; username: string }>;
            pageInfo: {
              total: number;
              page: number;
              limit: number;
              totalPages: number;
            };
          };
        }>;

        expect(body.errors).toBeUndefined();
        const users = body.data?.users.data ?? [];
        const pageInfo = body.data?.users.pageInfo;

        expect(users.length).toBe(1);
        expect(users.every((u) => u.tenantId === tenantA.id)).toBe(true);
        expect(pageInfo?.page).toBe(2);
        expect(pageInfo?.limit).toBe(1);
        expect(pageInfo?.total).toBeGreaterThanOrEqual(2);
        expect(pageInfo?.totalPages).toBeGreaterThanOrEqual(2);
      });
  });

  it('prevents login for deactivated tenants while other tenants still login', async () => {
    const tenantA = await prismaService.tenant.create({
      data: {
        name: `${testSlugPrefix}-deactivated`,
        slug: `${testSlugPrefix}-deactivated`,
        contactEmail: `${testSlugPrefix}-deactivated@example.com`,
      },
    });

    const tenantB = await prismaService.tenant.create({
      data: {
        name: `${testSlugPrefix}-active`,
        slug: `${testSlugPrefix}-active`,
        contactEmail: `${testSlugPrefix}-active@example.com`,
      },
    });

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
            username: `${testUserPrefix}deactuser`,
            password: 'password123',
            name: 'Deactivated Tenant User',
            tenantSlug: tenantA.slug,
          },
        },
      })
      .expect(200);

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
            username: `${testUserPrefix}activeuser`,
            password: 'password123',
            name: 'Active Tenant User',
            tenantSlug: tenantB.slug,
          },
        },
      })
      .expect(200);

    await prismaService.tenant.update({
      where: { id: tenantA.id },
      data: { isActive: false },
    });

    await request(app.getHttpServer() as Parameters<typeof request>[0])
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
            username: `${testUserPrefix}deactuser`,
            password: 'password123',
            tenantSlug: tenantA.slug,
          },
        },
      })
      .expect(200)
      .expect((res: request.Response) => {
        const body = res.body as GraphQLResponse<{ login: null }>;
        expect(body.errors).toBeDefined();
        expect(body.data?.login).toBeUndefined();
      });

    await request(app.getHttpServer() as Parameters<typeof request>[0])
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
            username: `${testUserPrefix}activeuser`,
            password: 'password123',
            tenantSlug: tenantB.slug,
          },
        },
      })
      .expect(200)
      .expect((res: request.Response) => {
        const body = res.body as GraphQLResponse<{
          login: { accessToken: string };
        }>;
        expect(body.errors).toBeUndefined();
        expect(body.data?.login.accessToken).toBeDefined();
      });
  });

  it('allows super-admin to list tenants with counts', async () => {
    const defaultTenant = await prismaService.tenant.findUnique({
      where: { slug: 'default' },
    });

    expect(defaultTenant).toBeDefined();
    if (!defaultTenant) {
      throw new Error('Default tenant must exist for super-admin test');
    }

    const username = `${testUserPrefix}superadmin`;
    const passwordHash = await bcrypt.hash('password123', 10);

    const superAdmin = await prismaService.user.create({
      data: {
        tenantId: defaultTenant.id,
        username,
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
      },
    });

    await prismaService.auth.create({
      data: {
        userId: superAdmin.id,
        tenantId: defaultTenant.id,
        username,
        passwordHash,
        salt: 'seeded',
      },
    });

    const superAdminRole = await prismaService.role.upsert({
      where: {
        tenantId_name: {
          tenantId: defaultTenant.id,
          name: 'SUPER_ADMIN',
        },
      },
      update: {},
      create: {
        tenantId: defaultTenant.id,
        name: 'SUPER_ADMIN',
      },
    });

    await prismaService.userTenantRole.createMany({
      data: [
        {
          userId: superAdmin.id,
          tenantId: defaultTenant.id,
          roleId: superAdminRole.id,
        },
      ],
      skipDuplicates: true,
    });

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
            tenantSlug: 'default',
          },
        },
      })
      .expect(200);

    const loginBody = loginRes.body as GraphQLResponse<{
      login: { accessToken: string };
    }>;

    const accessToken = loginBody.data?.login.accessToken;
    expect(accessToken).toBeDefined();

    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/graphql')
      .set('Authorization', `Bearer ${accessToken ?? ''}`)
      .send({
        query: `
          query Tenants {
            tenants {
              totalCount
              tenants {
                id
                slug
                userCount
                activeCourses
              }
            }
          }
        `,
      })
      .expect(200)
      .expect((res: request.Response) => {
        const body = res.body as GraphQLResponse<{
          tenants: {
            totalCount: number;
            tenants: Array<{ id: string; userCount: number; slug: string }>;
          };
        }>;

        expect(body.errors).toBeUndefined();
        expect(body.data?.tenants.totalCount).toBeGreaterThan(0);
        expect(body.data?.tenants.tenants.length).toBeGreaterThan(0);
        expect(
          body.data?.tenants.tenants.some((tenant) => tenant.userCount >= 0),
        ).toBe(true);
      });
  });
});
