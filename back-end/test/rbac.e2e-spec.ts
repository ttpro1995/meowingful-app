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

describe('RBAC (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  const uniquePart = Date.now();
  const testSlug = `rbac-test-${uniquePart}`;
  const testUserPrefix = `rbactest${uniquePart}`;

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
    await prismaService.rolePermission.deleteMany({});
    await prismaService.role.deleteMany({});
    await prismaService.permission.deleteMany({});
    await prismaService.user.deleteMany({
      where: { username: { startsWith: testUserPrefix } },
    });
    await prismaService.tenant.deleteMany({
      where: { slug: { startsWith: testSlug } },
    });

    await app.close();
  });

  it('USER role cannot call tenant:manage mutation', async () => {
    const tenant = await prismaService.tenant.create({
      data: {
        name: testSlug,
        slug: testSlug,
        contactEmail: `admin@${testSlug}.com`,
      },
    });

    const user = await prismaService.user.create({
      data: {
        tenantId: tenant.id,
        username: `${testUserPrefix}user`,
        name: 'User',
        role: 'USER',
      },
    });

    await prismaService.auth.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        username: user.username,
        passwordHash: await bcrypt.hash('password123', 10),
        salt: 'salt',
      },
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
            username: `${testUserPrefix}user`,
            password: 'password123',
            tenantSlug: testSlug,
          },
        },
      });

    const accessToken = (
      loginRes.body as GraphQLResponse<{ login: { accessToken: string } }>
    )?.data?.login?.accessToken;
    expect(accessToken).toBeDefined();

    const createTenantRes = await request(
      app.getHttpServer() as Parameters<typeof request>[0],
    )
      .post('/graphql')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        query: `
          mutation CreateTenant($input: CreateTenantInput!) {
            createTenant(input: $input) {
              id
              name
            }
          }
        `,
        variables: {
          input: {
            name: 'New Tenant',
            slug: 'new-tenant',
            contactEmail: 'new@test.com',
          },
        },
      });

    const body = createTenantRes.body as GraphQLResponse;
    expect(body.errors).toBeDefined();
  });

  it('TENANT_ADMIN can call tenant:manage mutation', async () => {
    const tenant = await prismaService.tenant.create({
      data: {
        name: `${testSlug}-admin`,
        slug: `${testSlug}-admin`,
        contactEmail: `admin@${testSlug}-admin.com`,
      },
    });

    const adminUser = await prismaService.user.create({
      data: {
        tenantId: tenant.id,
        username: `${testUserPrefix}admin`,
        name: 'Admin User',
        role: 'SUPER_ADMIN',
      },
    });

    await prismaService.auth.create({
      data: {
        userId: adminUser.id,
        tenantId: tenant.id,
        username: adminUser.username,
        passwordHash: await bcrypt.hash('password123', 10),
        salt: 'salt',
      },
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
            username: `${testUserPrefix}admin`,
            password: 'password123',
            tenantSlug: `${testSlug}-admin`,
          },
        },
      });

    const accessToken = (
      loginRes.body as GraphQLResponse<{ login: { accessToken: string } }>
    )?.data?.login?.accessToken;
    expect(accessToken).toBeDefined();

    const createTenantRes = await request(
      app.getHttpServer() as Parameters<typeof request>[0],
    )
      .post('/graphql')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        query: `
          mutation CreateTenant($input: CreateTenantInput!) {
            createTenant(input: $input) {
              id
              name
            }
          }
        `,
        variables: {
          input: {
            name: 'Another Tenant',
            slug: `${testSlug}-new`,
            contactEmail: 'new@tenant.com',
          },
        },
      });

    const createTenantBody = createTenantRes.body as GraphQLResponse;
    expect(createTenantBody.errors).toBeUndefined();
    expect(createTenantBody.data?.createTenant).toBeDefined();
  });

  it('default permissions are correct after seed', async () => {
    const defaultPermissions = [
      { code: 'lead:create', description: 'Create lead' },
      { code: 'lead:delete', description: 'Delete lead' },
      { code: 'course:create', description: 'Create course' },
      { code: 'course:enroll', description: 'Enroll in course' },
      { code: 'tenant:manage', description: 'Manage tenant' },
    ];

    for (const perm of defaultPermissions) {
      await prismaService.permission.upsert({
        where: { code: perm.code },
        update: {},
        create: perm,
      });
    }

    const tenant = await prismaService.tenant.create({
      data: {
        name: `${testSlug}-seeded`,
        slug: `${testSlug}-seeded`,
        contactEmail: `seed@${testSlug}-seeded.com`,
      },
    });

    const rolePermissionMatrix: Record<string, string[]> = {
      SUPER_ADMIN: [
        'lead:create',
        'lead:delete',
        'course:create',
        'course:enroll',
        'tenant:manage',
      ],
      TENANT_ADMIN: [
        'lead:create',
        'lead:delete',
        'course:create',
        'course:enroll',
        'tenant:manage',
      ],
      DEVELOPER: [],
      DIRECTOR: [],
      SALES_MANAGER: ['lead:create', 'lead:delete'],
      STAFF: ['lead:create'],
      ACCOUNTANT: [],
      HR: [],
      INSTRUCTOR: ['course:create'],
      STUDENT: ['course:enroll'],
    };

    for (const roleName of Object.keys(rolePermissionMatrix)) {
      const role = await prismaService.role.create({
        data: {
          tenantId: tenant.id,
          name: roleName,
        },
      });

      const permCodes = rolePermissionMatrix[roleName];
      for (const code of permCodes) {
        const perm = await prismaService.permission.findUnique({
          where: { code },
        });
        if (perm) {
          await prismaService.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: perm.id,
            },
          });
        }
      }
    }

    const roles = await prismaService.role.findMany({
      where: { tenantId: tenant.id },
      include: { permissions: { include: { permission: true } } },
    });

    expect(roles.length).toBeGreaterThan(0);

    const staffRole = roles.find((r) => r.name === 'STAFF');
    expect(staffRole).toBeDefined();
    expect(
      staffRole?.permissions.some((p) => p.permission.code === 'lead:create'),
    ).toBe(true);
    expect(
      staffRole?.permissions.some((p) => p.permission.code === 'lead:delete'),
    ).toBe(false);

    const salesRole = roles.find((r) => r.name === 'SALES_MANAGER');
    expect(salesRole).toBeDefined();
    expect(
      salesRole?.permissions.some((p) => p.permission.code === 'lead:create'),
    ).toBe(true);
    expect(
      salesRole?.permissions.some((p) => p.permission.code === 'lead:delete'),
    ).toBe(true);
  });
});
