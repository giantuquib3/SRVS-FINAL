const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const defaultPasswordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@usjr.edu.ph' },
    update: {
      id: '00000',
      fullName: 'System Administrator',
      passwordHash: defaultPasswordHash,
      role: 'Admin',
      departmentId: 'CPE',
      accountStatus: 'Active',
    },
    create: {
      id: '00000',
      email: 'admin@usjr.edu.ph',
      fullName: 'System Administrator',
      passwordHash: defaultPasswordHash,
      role: 'Admin',
      departmentId: 'CPE',
      accountStatus: 'Active',
    },
  });
  console.log('✅ Admin user upserted:', admin.id, admin.email);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
