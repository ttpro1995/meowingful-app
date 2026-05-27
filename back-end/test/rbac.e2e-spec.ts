import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
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
    const testTenants = await prismaService.tenant.findMany({
      where: {
        slug: {
          startsWith: testSlug,
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

    const staffRole = await prismaService.role.create({
      data: {
        tenantId: tenant.id,
        name: 'STAFF',
      },
    });

    await prismaService.userTenantRole.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        roleId: staffRole.id,
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

    const tenantManagePermission = await prismaService.permission.upsert({
      where: { code: 'tenant:manage' },
      update: { description: 'Manage tenant' },
      create: {
        code: 'tenant:manage',
        description: 'Manage tenant',
      },
    });

    const superAdminRole = await prismaService.role.create({
      data: {
        tenantId: tenant.id,
        name: 'SUPER_ADMIN',
      },
    });

    await prismaService.rolePermission.create({
      data: {
        roleId: superAdminRole.id,
        permissionId: tenantManagePermission.id,
      },
    });

    await prismaService.userTenantRole.create({
      data: {
        userId: adminUser.id,
        tenantId: tenant.id,
        roleId: superAdminRole.id,
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

  it('supports E01-07 style pagination/orderBy/filter on rolePermissions', async () => {
    const tenant = await prismaService.tenant.create({
      data: {
        name: `${testSlug}-matrix`,
        slug: `${testSlug}-matrix`,
        contactEmail: `matrix@${testSlug}.com`,
      },
    });

    const staffPermission = await prismaService.permission.upsert({
      where: { code: 'lead:create' },
      update: { description: 'Create lead' },
      create: {
        code: 'lead:create',
        description: 'Create lead',
      },
    });

    const leadDeletePermission = await prismaService.permission.upsert({
      where: { code: 'lead:delete' },
      update: { description: 'Delete lead' },
      create: {
        code: 'lead:delete',
        description: 'Delete lead',
      },
    });

    const tenantManagePermission = await prismaService.permission.upsert({
      where: { code: 'tenant:manage' },
      update: { description: 'Manage tenant' },
      create: {
        code: 'tenant:manage',
        description: 'Manage tenant',
      },
    });

    const staffRole = await prismaService.role.create({
      data: {
        tenantId: tenant.id,
        name: 'STAFF',
      },
    });

    const salesManagerRole = await prismaService.role.create({
      data: {
        tenantId: tenant.id,
        name: 'SALES_MANAGER',
      },
    });

    const tenantAdminRole = await prismaService.role.create({
      data: {
        tenantId: tenant.id,
        name: 'TENANT_ADMIN',
      },
    });

    await prismaService.rolePermission.createMany({
      data: [
        {
          roleId: staffRole.id,
          permissionId: staffPermission.id,
        },
        {
          roleId: salesManagerRole.id,
          permissionId: staffPermission.id,
        },
        {
          roleId: salesManagerRole.id,
          permissionId: leadDeletePermission.id,
        },
        {
          roleId: tenantAdminRole.id,
          permissionId: tenantManagePermission.id,
        },
      ],
      skipDuplicates: true,
    });

    const user = await prismaService.user.create({
      data: {
        tenantId: tenant.id,
        username: `${testUserPrefix}matrix`,
        name: 'RBAC Matrix User',
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

    await prismaService.userTenantRole.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        roleId: staffRole.id,
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
            username: user.username,
            password: 'password123',
            tenantSlug: tenant.slug,
          },
        },
      });

    const accessToken = (
      loginRes.body as GraphQLResponse<{ login: { accessToken: string } }>
    ).data?.login.accessToken;
    expect(accessToken).toBeDefined();

    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/graphql')
      .set('Authorization', `Bearer ${accessToken ?? ''}`)
      .send({
        query: `
          query RolePermissions($tenantId: String!, $query: RolePermissionsQueryInput) {
            rolePermissions(tenantId: $tenantId, query: $query) {
              data {
                roleName
                permissions
              }
              rolePermissions {
                roleName
              }
              totalCount
              pageInfo {
                total
                page
                limit
                totalPages
              }
            }
          }
        `,
        variables: {
          tenantId: tenant.id,
          query: {
            pagination: { page: 1, limit: 2 },
            orderBy: { field: 'permissionCount', direction: 'DESC' },
            filter: {
              permissionCode: {
                contains: 'lead:',
              },
            },
          },
        },
      })
      .expect(200)
      .expect((res: request.Response) => {
        const body = res.body as GraphQLResponse<{
          rolePermissions: {
            data: Array<{ roleName: string; permissions: string[] }>;
            rolePermissions: Array<{ roleName: string }>;
            totalCount: number;
            pageInfo: {
              total: number;
              page: number;
              limit: number;
              totalPages: number;
            };
          };
        }>;

        expect(body.errors).toBeUndefined();
        expect(body.data?.rolePermissions.totalCount).toBe(2);
        expect(body.data?.rolePermissions.pageInfo).toEqual({
          total: 2,
          page: 1,
          limit: 2,
          totalPages: 1,
        });

        const roleNames =
          body.data?.rolePermissions.data.map((entry) => entry.roleName) ?? [];
        expect(roleNames).toEqual(['SALES_MANAGER', 'STAFF']);
      });
  });

  it('returns VALIDATION_ERROR when rolePermissions pagination.limit is above max', async () => {
    const tenant = await prismaService.tenant.create({
      data: {
        name: `${testSlug}-validation`,
        slug: `${testSlug}-validation`,
        contactEmail: `validation@${testSlug}.com`,
      },
    });

    const staffRole = await prismaService.role.create({
      data: {
        tenantId: tenant.id,
        name: 'STAFF',
      },
    });

    const validationUsername = `rval${String(uniquePart).slice(-6)}`;

    const user = await prismaService.user.create({
      data: {
        tenantId: tenant.id,
        username: validationUsername,
        name: 'RBAC Validation User',
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

    await prismaService.userTenantRole.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        roleId: staffRole.id,
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
            username: user.username,
            password: 'password123',
            tenantSlug: tenant.slug,
          },
        },
      });

    const accessToken = (
      loginRes.body as GraphQLResponse<{ login: { accessToken: string } }>
    ).data?.login.accessToken;
    expect(accessToken).toBeDefined();

    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/graphql')
      .set('Authorization', `Bearer ${accessToken ?? ''}`)
      .send({
        query: `
          query RolePermissions($tenantId: String!, $query: RolePermissionsQueryInput) {
            rolePermissions(tenantId: $tenantId, query: $query) {
              totalCount
            }
          }
        `,
        variables: {
          tenantId: tenant.id,
          query: {
            pagination: {
              page: 1,
              limit: 200,
            },
          },
        },
      })
      .expect(200)
      .expect((res: request.Response) => {
        const body = res.body as GraphQLResponse<{
          rolePermissions: null;
        }>;

        expect(body.errors).toBeDefined();
        const firstError = body.errors?.[0];
        expect(firstError?.extensions?.code).toBe('VALIDATION_ERROR');
        expect(firstError?.extensions?.errors?.[0].field).toBe(
          'pagination.limit',
        );
      });
  });
});
