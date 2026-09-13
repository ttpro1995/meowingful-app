import { LeadStatus, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    take: 1,
  });

  if (tenants.length === 0) {
    console.log('No tenants found, skipping seed');
    return;
  }

  const tenant = tenants[0];
  const users = await prisma.user.findMany({
    where: { tenantId: tenant.id },
    take: 2,
  });

  if (users.length === 0) {
    console.log('No users found for tenant, skipping seed');
    return;
  }

  const existingLeads = await prisma.lead.count({
    where: { tenantId: tenant.id },
  });

  if (existingLeads > 0) {
    console.log(`Leads already seeded (${existingLeads} found), skipping`);
    return;
  }

  const sampleLeads = [
    {
      tenantId: tenant.id,
      name: 'Alice Johnson',
      email: 'alice@example.com',
      phone: '+1-555-0101',
      source: 'website',
      status: LeadStatus.NEW,
      score: 3,
      assignedToId: users[0].id,
    },
    {
      tenantId: tenant.id,
      name: 'Bob Smith',
      email: 'bob@example.com',
      phone: '+1-555-0102',
      source: 'referral',
      status: LeadStatus.QUALIFIED,
      score: 5,
      assignedToId: users[1]?.id ?? users[0].id,
    },
    {
      tenantId: tenant.id,
      name: 'Carol Davis',
      email: 'carol@example.com',
      phone: '+1-555-0103',
      source: 'cold_call',
      status: LeadStatus.CONTACTED,
      score: 2,
      assignedToId: users[0].id,
    },
    {
      tenantId: tenant.id,
      name: 'David Wilson',
      email: 'david@example.com',
      phone: undefined,
      source: 'website',
      status: LeadStatus.LOST,
      score: 1,
      assignedToId: users[1]?.id ?? users[0].id,
    },
  ];

  for (const lead of sampleLeads) {
    await prisma.lead.create({ data: lead });
  }

  console.log(`Seeded ${sampleLeads.length} sample leads for tenant ${tenant.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
