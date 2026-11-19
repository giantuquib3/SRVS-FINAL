const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  console.log('🧹 Starting cleanup of all users except System Administrator (id: 0)...');

  let nonAdminUsers = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      nonAdminUsers = await prisma.user.findMany({
        where: {
          id: { not: 0 },
        },
        select: { id: true, email: true, fullName: true, role: true },
      });
      break;
    } catch (e) {
      if (attempt === 3) throw e;
      console.log(`Connection retry ${attempt}/3...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`Found ${nonAdminUsers.length} non-admin users to remove.`);

  const nonAdminIds = nonAdminUsers.map((u) => u.id);

  if (nonAdminIds.length > 0) {
    // 1. Delete student_subjects for removed students (onDelete: NoAction on fk_student_subjects_student)
    const enrollments = await prisma.studentSubject.deleteMany({
      where: { studentId: { in: nonAdminIds } },
    });
    console.log(`✓ Deleted ${enrollments.count} student_subjects records`);

    // 2. Delete syllabus versions edited by removed users
    const versions = await prisma.syllabusVersion.deleteMany({
      where: { editorId: { in: nonAdminIds } },
    });
    console.log(`✓ Deleted ${versions.count} syllabus versions`);

    // 3. Delete syllabi created by removed instructors
    const syllabi = await prisma.syllabus.deleteMany({
      where: { instructorId: { in: nonAdminIds } },
    });
    console.log(`✓ Deleted ${syllabi.count} syllabi`);

    // 4. Delete all users except id = 0
    const users = await prisma.user.deleteMany({
      where: { id: { in: nonAdminIds } },
    });
    console.log(`✓ Deleted ${users.count} non-admin users`);
  }

  const remainingUsers = await prisma.user.findMany({
    select: { id: true, fullName: true, email: true, role: true, accountStatus: true },
  });

  console.log('\nRemaining Users in Database:');
  console.table(remainingUsers);
  console.log('✅ Cleanup completed successfully.');

  await prisma.$disconnect();
}

cleanup().catch((e) => {
  console.error('Error during cleanup:', e);
  process.exit(1);
});
