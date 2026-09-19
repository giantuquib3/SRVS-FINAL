const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- TABLES CHECK ---');
  const userCount = await prisma.user.count();
  const courseCount = await prisma.course.count();
  const enrollmentCount = await prisma.enrollment.count();
  const syllabusCount = await prisma.syllabus.count();
  const auditLogCount = await prisma.auditLog.count();

  console.log({ userCount, courseCount, enrollmentCount, syllabusCount, auditLogCount });

  console.log('\n--- ADMIN & USER ACCOUNTS ---');
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      departmentId: true,
      accountStatus: true,
      passwordHash: true,
    }
  });

  users.forEach(u => {
    console.log(`[${u.role}] ID: ${u.id} | Email: ${u.email} | Name: ${u.fullName} | Status: ${u.accountStatus} | Hash: ${u.passwordHash ? u.passwordHash.substring(0, 15) + '...' : 'NONE'}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
