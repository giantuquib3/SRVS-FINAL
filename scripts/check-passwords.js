const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findUnique({ where: { id: 2022012701 } });
  console.log('2022012701 hash:', u.passwordHash);
}

main().catch(console.error).finally(() => prisma.$disconnect());
