import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { RoleName, UserRole } from '@prisma/client';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

interface GraphQLResponse<T = Record<string, unknown>> {
  data?: T;
  errors?: Array<{ message: string }>;
}

describe('Membership (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  const uniquePart = Date.now();
  const testSlugPrefix = `membership-e2e-${uniquePart}`;
  const testUserPrefix = `membere2e${uniquePart}`;
  const testEmailPrefix = `membere2e-${uniquePart}`;
  const password = 'password123';

  const rolePermissions: Partial<Record<RoleName, string[]>> = {
    [RoleName.TENANT_ADMIN]: ['tenant:manage', 'lead:create', 'lead:delete'],
    [RoleName.SALES_MANAGER]: ['lead:create', 'lead:delete'],
    [RoleName.STAFF]: ['lead:create'],
  };

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
        OR: [
          {
            tenantId: {
              in: tenantIds,
            },
          },
          {
            email: {
              startsWith: testEmailPrefix,
            },
          },
        ],
      },
    });

    await prismaService.userTenantRole.deleteMany({
      where: {
        OR: [
          {
            tenantId: {
              in: tenantIds,
            },
          },
          {
            user: {
              username: {
                startsWith: testUserPrefix,
              },
            },
          },
        ],
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

  async function executeGraphQL<T = Record<string, unknown>>(params: {
    query: string;
    variables?: Record<string, unknown>;
    accessToken?: string;
  }): Promise<GraphQLResponse<T>> {
    const req = request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/graphql')
      .send({
        query: params.query,
        variables: params.variables,
      });

    if (params.accessToken) {
      req.set('Authorization', `Bearer ${params.accessToken}`);
    }

    const res = await req.expect(200);
    return res.body as GraphQLResponse<T>;
  }

  async function loginAndGetToken(input: {
    username: string;
    tenantSlug: string;
  }): Promise<string> {
    const body = await executeGraphQL<{
      login: {
        accessToken: string;
      };
    }>({
      query: `
        mutation Login($input: LoginInput!) {
          login(input: $input) {
            accessToken
          }
        }
      `,
      variables: {
        input: {
          username: input.username,
          password,
          tenantSlug: input.tenantSlug,
        },
      },
    });

    expect(body.errors).toBeUndefined();
    expect(body.data?.login.accessToken).toBeDefined();

    return body.data?.login.accessToken ?? '';
  }

  async function ensurePermission(code: string, description: string): Promise<void> {
    await prismaService.permission.upsert({
      where: { code },
      update: { description },
      create: {
        code,
        description,
      },
    });
  }

  async function seedTenantRoles(tenantId: string): Promise<Record<RoleName, { id: string }>> {
    const seeded: Partial<Record<RoleName, { id: string }>> = {};

    for (const roleName of Object.keys(rolePermissions) as RoleName[]) {
      const role = await prismaService.role.create({
        data: {
          tenantId,
          name: roleName,
        },
        select: {
          id: true,
        },
      });

      seeded[roleName] = role;

      const permissionCodes = rolePermissions[roleName] ?? [];
      for (const code of permissionCodes) {
        const permission = await prismaService.permission.findUnique({
          where: { code },
        });

        if (!permission) {
          continue;
        }

        await prismaService.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }

    return seeded as Record<RoleName, { id: string }>;
  }

  async function createUserWithAuthAndMembership(input: {
    tenantId: string;
    username: string;
    name: string;
    email: string;
    userRole: UserRole;
    membershipRoleId: string;
  }): Promise<{ id: string }> {
    const user = await prismaService.user.create({
      data: {
        tenantId: input.tenantId,
        username: input.username,
        name: input.name,
        email: input.email,
        role: input.userRole,
      },
      select: {
        id: true,
      },
    });

    const passwordHash = await bcrypt.hash(password, 10);

    await prismaService.auth.create({
      data: {
        userId: user.id,
        tenantId: input.tenantId,
        username: input.username,
        passwordHash,
        salt: 'salt',
      },
    });

    await prismaService.userTenantRole.create({
      data: {
        userId: user.id,
        tenantId: input.tenantId,
        roleId: input.membershipRoleId,
      },
    });

    return user;
  }

  it('covers invite->accept->switch tenant, role update permission propagation, and immediate access revocation', async () => {
    await ensurePermission('tenant:manage', 'Manage tenant');
    await ensurePermission('lead:create', 'Create lead');
    await ensurePermission('lead:delete', 'Delete lead');

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

    const rolesA = await seedTenantRoles(tenantA.id);
    const rolesB = await seedTenantRoles(tenantB.id);

    const adminUser = await createUserWithAuthAndMembership({
      tenantId: tenantA.id,
      username: `${testUserPrefix}admin`,
      name: 'Tenant Admin',
      email: `${testEmailPrefix}-admin@example.com`,
      userRole: UserRole.TENANT_ADMIN,
      membershipRoleId: rolesA.TENANT_ADMIN.id,
    });

    const invitedUser = await createUserWithAuthAndMembership({
      tenantId: tenantB.id,
      username: `${testUserPrefix}member`,
      name: 'Membership User',
      email: `${testEmailPrefix}-member@example.com`,
      userRole: UserRole.USER,
      membershipRoleId: rolesB.STAFF.id,
    });

    const adminAccessToken = await loginAndGetToken({
      username: `${testUserPrefix}admin`,
      tenantSlug: tenantA.slug,
    });

    const inviteBody = await executeGraphQL<{
      inviteMember: {
        invitationToken: string;
      };
    }>({
      query: `
        mutation InviteMember($input: InviteMemberInput!) {
          inviteMember(input: $input) {
            invitationToken
          }
        }
      `,
      variables: {
        input: {
          email: `${testEmailPrefix}-member@example.com`,
          roleId: rolesA.STAFF.id,
        },
      },
      accessToken: adminAccessToken,
    });

    expect(inviteBody.errors).toBeUndefined();
    expect(inviteBody.data?.inviteMember.invitationToken).toBeDefined();
    const invitationToken = inviteBody.data?.inviteMember.invitationToken ?? '';

    const memberTenantBToken = await loginAndGetToken({
      username: `${testUserPrefix}member`,
      tenantSlug: tenantB.slug,
    });

    const acceptBody = await executeGraphQL<{
      acceptInvitation: boolean;
    }>({
      query: `
        mutation AcceptInvitation($input: AcceptInvitationInput!) {
          acceptInvitation(input: $input)
        }
      `,
      variables: {
        input: {
          token: invitationToken,
        },
      },
      accessToken: memberTenantBToken,
    });

    expect(acceptBody.errors).toBeUndefined();
    expect(acceptBody.data?.acceptInvitation).toBe(true);

    const myTenantsBody = await executeGraphQL<{
      myTenants: {
        memberships: Array<{ tenantId: string }>;
      };
    }>({
      query: `
        query MyTenants {
          myTenants {
            memberships {
              tenantId
            }
          }
        }
      `,
      accessToken: memberTenantBToken,
    });

    expect(myTenantsBody.errors).toBeUndefined();
    const tenantIds = myTenantsBody.data?.myTenants.memberships.map((m) => m.tenantId) ?? [];
    expect(tenantIds).toContain(tenantA.id);
    expect(tenantIds).toContain(tenantB.id);

    const switchTenantBody = await executeGraphQL<{
      switchTenant: {
        accessToken: string;
        user: {
          tenantId: string;
        };
      };
    }>({
      query: `
        mutation SwitchTenant($tenantId: String!) {
          switchTenant(tenantId: $tenantId) {
            accessToken
            user {
              tenantId
            }
          }
        }
      `,
      variables: {
        tenantId: tenantA.id,
      },
      accessToken: memberTenantBToken,
    });

    expect(switchTenantBody.errors).toBeUndefined();
    expect(switchTenantBody.data?.switchTenant.user.tenantId).toBe(tenantA.id);

    const switchedToken = switchTenantBody.data?.switchTenant.accessToken ?? '';
    const decoded = jwt.decode(switchedToken) as { tenantId?: string } | null;
    expect(decoded?.tenantId).toBe(tenantA.id);

    const permissionsBeforeUpdate = await executeGraphQL<{
      myPermissions: string[];
    }>({
      query: `
        query MyPermissions {
          myPermissions
        }
      `,
      accessToken: switchedToken,
    });

    expect(permissionsBeforeUpdate.errors).toBeUndefined();
    expect(permissionsBeforeUpdate.data?.myPermissions).toContain('lead:create');
    expect(permissionsBeforeUpdate.data?.myPermissions).not.toContain('lead:delete');

    const invitedUserLookup = await executeGraphQL<{
      getUser: {
        id: string;
      };
    }>({
      query: `
        query GetUser($userId: String!) {
          getUser(userId: $userId) {
            id
          }
        }
      `,
      variables: {
        userId: invitedUser.id,
      },
      accessToken: adminAccessToken,
    });

    expect(invitedUserLookup.errors).toBeUndefined();
    expect(invitedUserLookup.data?.getUser.id).toBe(invitedUser.id);

    const updateRolesBody = await executeGraphQL<{
      updateMemberRoles: {
        id: string;
        roles: Array<{ roleName: string }>;
      };
    }>({
      query: `
        mutation UpdateMemberRoles($input: UpdateMemberRolesInput!) {
          updateMemberRoles(input: $input) {
            id
            roles {
              roleName
            }
          }
        }
      `,
      variables: {
        input: {
          userId: invitedUser.id,
          roleIds: [rolesA.SALES_MANAGER.id],
        },
      },
      accessToken: adminAccessToken,
    });

    expect(updateRolesBody.errors).toBeUndefined();
    expect(updateRolesBody.data?.updateMemberRoles.id).toBe(invitedUser.id);
    expect(updateRolesBody.data?.updateMemberRoles.roles).toEqual([
      { roleName: 'SALES_MANAGER' },
    ]);

    const permissionsAfterUpdate = await executeGraphQL<{
      myPermissions: string[];
    }>({
      query: `
        query MyPermissions {
          myPermissions
        }
      `,
      accessToken: switchedToken,
    });

    expect(permissionsAfterUpdate.errors).toBeUndefined();
    expect(permissionsAfterUpdate.data?.myPermissions).toContain('lead:create');
    expect(permissionsAfterUpdate.data?.myPermissions).toContain('lead:delete');

    const removeMemberBody = await executeGraphQL<{
      removeMember: boolean;
    }>({
      query: `
        mutation RemoveMember($userId: String!) {
          removeMember(userId: $userId)
        }
      `,
      variables: {
        userId: invitedUser.id,
      },
      accessToken: adminAccessToken,
    });

    expect(removeMemberBody.errors).toBeUndefined();
    expect(removeMemberBody.data?.removeMember).toBe(true);

    const nextRequestAfterRemoval = await executeGraphQL<{
      myTenants: null;
    }>({
      query: `
        query MyTenants {
          myTenants {
            memberships {
              tenantId
            }
          }
        }
      `,
      accessToken: switchedToken,
    });

    expect(nextRequestAfterRemoval.errors).toBeDefined();
    expect(nextRequestAfterRemoval.errors?.[0].message).toContain('UNAUTHORIZED');

    const switchAfterRemoval = await executeGraphQL<{
      switchTenant: null;
    }>({
      query: `
        mutation SwitchTenant($tenantId: String!) {
          switchTenant(tenantId: $tenantId) {
            accessToken
          }
        }
      `,
      variables: {
        tenantId: tenantA.id,
      },
      accessToken: memberTenantBToken,
    });

    expect(switchAfterRemoval.errors).toBeDefined();
    expect(switchAfterRemoval.errors?.[0].message).toContain('UNAUTHORIZED');

    expect(adminUser.id).toBeDefined();
  });
});
