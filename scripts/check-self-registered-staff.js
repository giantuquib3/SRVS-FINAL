const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const byRoleStatus = await prisma.user.groupBy({
    by: ['role', 'accountStatus'],
    _count: { _all: true },
    orderBy: [{ role: 'asc' }],
  });
  console.log('Users by role / status:');
  console.table(byRoleStatus.map((r) => ({ role: r.role, status: r.accountStatus, count: r._count._all })));

  // Staff accounts that were created via public self-registration (audit actionType = Register)
  const selfRegLogs = await prisma.auditLog.findMany({
    where: { actionType: 'Register' },
    select: { entityId: true, description: true, createdAt: true },
  });
  const ids = selfRegLogs.map((l) => parseInt(l.entityId || '', 10)).filter((n) => !isNaN(n));
  const selfRegStaff = await prisma.user.findMany({
    where: { id: { in: ids }, role: { not: 'Student' } },
    select: { id: true, fullName: true, email: true, role: true, accountStatus: true },
  });
  console.log(`\nStaff (non-Student) accounts that were self-registered: ${selfRegStaff.length}`);
  if (selfRegStaff.length) console.table(selfRegStaff);
}

main().finally(() => prisma.$disconnect());
