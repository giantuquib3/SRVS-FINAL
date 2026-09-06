const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  console.log('🧹 Starting cleanup of seeded accounts (retaining only Admin)...');

  let nonAdminUsers = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      nonAdminUsers = await prisma.user.findMany({
        where: {
          role: { not: 'Admin' },
        },
        select: { id: true, email: true, username: true, role: true },
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
    // 1. Delete notifications for non-admin users
    const notifs = await prisma.notification.deleteMany({
      where: { userId: { in: nonAdminIds } },
    });
    console.log(`✓ Deleted ${notifs.count} notifications`);

    // 2. Delete enrollments for non-admin students
    const enrollments = await prisma.enrollment.deleteMany({
      where: { studentId: { in: nonAdminIds } },
    });
    console.log(`✓ Deleted ${enrollments.count} enrollments`);

    // 3. Delete syllabus versions edited by non-admin users
    const versions = await prisma.syllabusVersion.deleteMany({
      where: { editorId: { in: nonAdminIds } },
    });
    console.log(`✓ Deleted ${versions.count} syllabus versions`);

    // 4. Delete syllabi created by non-admin instructors
    const syllabi = await prisma.syllabus.deleteMany({
      where: { instructorId: { in: nonAdminIds } },
    });
    console.log(`✓ Deleted ${syllabi.count} syllabi`);

    // 5. Nullify userId in audit logs
    const audits = await prisma.auditLog.updateMany({
      where: { userId: { in: nonAdminIds } },
      data: { userId: null },
    });
    console.log(`✓ Disconnected ${audits.count} audit logs from removed users`);

    // 6. Delete the non-admin users
    const deletedUsers = await prisma.user.deleteMany({
      where: { id: { in: nonAdminIds } },
    });
    console.log(`✓ Deleted ${deletedUsers.count} non-admin users.`);
  }

  // Ensure Admin user has username '00000'
  const admin = await prisma.user.findFirst({
    where: { role: 'Admin' },
  });

  if (admin) {
    await prisma.user.update({
      where: { id: admin.id },
      data: {
        username: '00000',
        accountStatus: 'Active',
      },
    });
    console.log(`✓ Verified Admin user: username: '00000' | email: '${admin.email}' | role: 'Admin'`);
  }

  // Final count
  const remainingUsers = await prisma.user.findMany({
    select: { id: true, email: true, username: true, role: true, fullName: true },
  });
  console.log('\nRemaining Users in Database:');
  console.table(remainingUsers);

  console.log('✅ Cleanup complete! Only the admin account remains.');
}

cleanup()
  .catch((e) => {
    console.error('Error during cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
