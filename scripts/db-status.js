const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  console.log('🔍 Checking PostgreSQL Database Connection & Unified Table Schema...\n');
  const start = Date.now();

  try {
    const [
      totalUsers,
      totalAdmins,
      totalDeptHeads,
      totalEducators,
      totalStudents,
      courses,
      enrollments,
      syllabi,
      versions,
      logs,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'Admin' } }),
      prisma.user.count({ where: { role: 'DepartmentHead' } }),
      prisma.user.count({ where: { role: 'Educator' } }),
      prisma.user.count({ where: { role: 'Student' } }),
      prisma.course.count(),
      prisma.enrollment.count(),
      prisma.syllabus.count(),
      prisma.syllabusVersion.count(),
      prisma.auditLog.count(),
    ]);

    const latency = Date.now() - start;

    console.log('====================================================');
    console.log('       USJ-R SRVS DATABASE STATUS & SUMMARY         ');
    console.log('====================================================');
    console.log(`Database Engine: PostgreSQL (Supabase Pooled Connection)`);
    console.log(`Roundtrip Latency: ${latency} ms`);
    console.log(`Connection Status: HEALTHY & ONLINE\n`);

    console.log('Simplified & Non-Redundant Database Tables (6 tables):');
    console.table({
      'admin (users)': { Records: totalUsers, PK_Type: 'String (ID Number)', Description: `Unified User Directory: Admins (${totalAdmins}), DeptHeads (${totalDeptHeads}), Educators (${totalEducators}), Students (${totalStudents})` },
      'courses': { Records: courses, PK_Type: 'String (Course Code)', Description: 'Course Catalog with facultyName & facultyId of syllabus author' },
      'enrollments': { Records: enrollments, PK_Type: 'Compound (studentId INT, courseId)', Description: 'Student enrollments with numeric StudentId (INT) & direct StudentName' },
      'syllabi': { Records: syllabi, PK_Type: 'String (CUID)', Description: 'Course Syllabi Master Records' },
      'syllabus_versions': { Records: versions, PK_Type: 'String (CUID)', Description: 'Immutable Revision History' },
      'audit_logs': { Records: logs, PK_Type: 'String (CUID)', Description: 'System Security & Activity Trail' },
    });

    const admin = await prisma.user.findFirst({
      where: { role: 'Admin' },
    });

    console.log('\nSystem Administrator Account:');
    if (admin) {
      console.log(`  ✓ Database ID: ${admin.id}`);
      console.log(`  ✓ Email: ${admin.email}`);
      console.log(`  ✓ Name: ${admin.fullName}`);
      console.log(`  ✓ Status: ${admin.accountStatus}`);
    } else {
      console.log('  ⚠️ No Admin user found! Run "node prisma/seed.js" to seed.');
    }

    const sampleUsers = await prisma.user.findMany({
      take: 10,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        fullName: true,
        role: true,
        departmentId: true,
        accountStatus: true,
      },
    });

    console.log('\nRegistered Accounts Sample (users table):');
    console.table(sampleUsers);

    console.log('\n✅ Database and schema verification completed successfully!');
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
