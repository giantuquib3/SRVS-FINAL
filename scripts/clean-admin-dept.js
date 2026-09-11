const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanAdmin() {
  await prisma.user.update({
    where: { email: 'admin@usjr.edu.ph' },
    data: { departmentId: null },
  });
  console.log('✅ Admin user departmentId set to null (unrestricted across all departments).');
}

cleanAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
