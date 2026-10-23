const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  console.log('🔍 Checking PostgreSQL Database Connection & Unified Table Schema...\n');
  const start = Date.now();

  try {
    const [
      totalDepts,
      totalUsers,
      totalAdmins,
      totalDeptHeads,
      totalEducators,
      totalStudents,
      subjects,
      studentSubjects,
      syllabi,
      versions,
      logs,
    ] = await Promise.all([
      prisma.department.count(),
      prisma.user.count(),
      prisma.user.count({ where: { role: 'Admin' } }),
      prisma.user.count({ where: { role: 'DepartmentHead' } }),
      prisma.user.count({ where: { role: 'Educator' } }),
      prisma.user.count({ where: { role: 'Student' } }),
      prisma.subject.count(),
      prisma.studentSubject.count(),
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

    console.log('Organized Relational Database Tables (7 Core Tables):');
    console.table({
      'departments': { Records: totalDepts, PK_Type: 'String (Code: CPE, EE, CE, etc.)', Description: 'Academic Engineering Departments' },
      'users': { Records: totalUsers, PK_Type: 'INTEGER (University ID)', Description: `Master User Directory: Admins (${totalAdmins}), DeptHeads (${totalDeptHeads}), Educators (${totalEducators}), Students (${totalStudents})` },
      'subjects': { Records: subjects, PK_Type: 'INTEGER (SERIAL)', Description: 'Curriculum Catalog linked to departments(id)' },
      'student_subjects': { Records: studentSubjects, PK_Type: 'INTEGER (IDENTITY)', Description: 'Student ↔ subject associations linked to users(id) & subjects(id), UNIQUE(studentId, subjectId)' },
      'syllabi': { Records: syllabi, PK_Type: 'INTEGER (SERIAL)', Description: 'Master Syllabi linked to subjects(id) & users(id)' },
      'syllabus_versions': { Records: versions, PK_Type: 'INTEGER (SERIAL)', Description: 'Revision History linked to syllabi(id) & users(id)' },
      'audit_logs': { Records: logs, PK_Type: 'INTEGER (SERIAL)', Description: 'Security & Audit Trail linked to users(id)' },
    });

    const admin = await prisma.user.findFirst({
      where: { role: 'Admin' },
    });

    console.log('\nSystem Administrator Account:');
    if (admin) {
      console.log(`  ✓ Database ID: ${admin.id}`);
      console.log(`  ✓ Email: ${admin.email}`);
      console.log(`  ✓ Name: ${admin.fullName}`);
      console.log(`  ✓ Role: ${admin.role}`);
      console.log(`  ✓ Status: ${admin.accountStatus}`);
    }

    console.log('\nSample Users by Role:');
    const sampleUsers = await prisma.user.findMany({
      take: 10,
      select: {
        id: true,
        fullName: true,
        role: true,
        departmentId: true,
        accountStatus: true,
      },
      orderBy: { id: 'asc' },
    });
    console.table(sampleUsers);

    console.log('\n✅ Database and schema verification completed successfully!');
  } catch (error) {
    console.error('❌ Database check failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
