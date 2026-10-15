const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { id: { in: [0, 10001, 10002, 2022012701] } },
    select: { id: true, email: true, role: true, departmentId: true, passwordHash: true },
  });

  const candidates = ['admin123', 'head123', 'faculty123', 'student123', 'Giangwapo123?'];

  for (const u of users) {
    console.log(`\nUser ${u.id} (${u.role}):`);
    for (const c of candidates) {
      if (bcrypt.compareSync(c, u.passwordHash)) {
        console.log(`  MATCH: "${c}"`);
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
