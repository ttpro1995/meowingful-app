

import 'dotenv/config';
import { PrismaClient, RoleName } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const defaultPermissions = [
  { code: 'lead:create', description: 'Create lead' },
  { code: 'lead:delete', description: 'Delete lead' },
  { code: 'course:create', description: 'Create course' },
  { code: 'course:enroll', description: 'Enroll in course' },
  { code: 'tenant:manage', description: 'Manage tenant' },
];

const rolePermissionMatrix: Record<RoleName, string[]> = {
  SUPER_ADMIN: ['lead:create', 'lead:delete', 'course:create', 'course:enroll', 'tenant:manage'],
  TENANT_ADMIN: ['lead:create', 'lead:delete', 'course:create', 'course:enroll', 'tenant:manage'],
  DEVELOPER: [],
  DIRECTOR: [],
  SALES_MANAGER: ['lead:create', 'lead:delete'],
  STAFF: ['lead:create'],
  ACCOUNTANT: [],
  HR: [],
  INSTRUCTOR: ['course:create'],
  STUDENT: ['course:enroll'],
};

async function main() {
  console.log('Starting RBAC seed...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 30) + '...');

  // Seed permissions
  for (const perm of defaultPermissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
  }
  console.log('Permissions seeded');

  // For each tenant, create roles and assign permissions
  const tenants = await prisma.tenant.findMany();
  console.log(`Found ${tenants.length} tenants`);

  for (const tenant of tenants) {
    for (const roleName of Object.keys(rolePermissionMatrix) as RoleName[]) {
      const role = await prisma.role.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: roleName } },
        update: {},
        create: { tenantId: tenant.id, name: roleName },
      });
      // Assign permissions
      const perms = rolePermissionMatrix[roleName];
      for (const code of perms) {
        const perm = await prisma.permission.findUnique({ where: { code } });
        if (perm) {
          await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
            update: {},
            create: { roleId: role.id, permissionId: perm.id },
          });
        }
      }
    }
  }
  console.log('Roles and permissions seeded');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
