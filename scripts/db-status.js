const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  console.log('🔍 Checking PostgreSQL Database Connection & Table Schema...\n');
  const start = Date.now();

  try {
    const departments = await prisma.department.count();
    const courses = await prisma.course.count();
    const users = await prisma.user.count();
    const enrollments = await prisma.enrollment.count();
    const syllabi = await prisma.syllabus.count();
    const versions = await prisma.syllabusVersion.count();
    const auditLogs = await prisma.auditLog.count();
    const notifications = await prisma.notification.count();

    const latency = Date.now() - start;

    console.log('====================================================');
    console.log('       USJ-R SRVS DATABASE STATUS & SUMMARY         ');
    console.log('====================================================');
    console.log(`Database Engine: PostgreSQL (Supabase Pooled Connection)`);
    console.log(`Roundtrip Latency: ${latency} ms`);
    console.log(`Connection Status: HEALTHY & ONLINE\n`);

    console.log('Table Record Counts:');
    console.table({
      'srvs_departments': { Records: departments, Description: 'Engineering Departments (CE, CPE, ECE, EE, IE, ME)' },
      'srvs_courses': { Records: courses, Description: 'Course Catalog & Department Mapping' },
      'srvs_users': { Records: users, Description: 'System Users (Admin, Faculty, Students)' },
      'srvs_enrollments': { Records: enrollments, Description: 'Student Subject Enrollments' },
      'srvs_syllabi': { Records: syllabi, Description: 'Course Syllabi Master Records' },
      'srvs_syllabus_versions': { Records: versions, Description: 'Immutable Version Snapshots (v1, v2, v3...)' },
      'srvs_audit_logs': { Records: auditLogs, Description: 'Security & Activity Audit Trail' },
      'srvs_notifications': { Records: notifications, Description: 'In-app Notification Alerts' },
    });

    const admin = await prisma.user.findFirst({
      where: { role: 'Admin' },
      select: { id: true, email: true, fullName: true, role: true, accountStatus: true },
    });

    console.log('\nSystem Administrator Status:');
    if (admin) {
      console.log(`  ✓ University ID (PK id): ${admin.id}`);
      console.log(`  ✓ Email: ${admin.email}`);
      console.log(`  ✓ Name: ${admin.fullName}`);
      console.log(`  ✓ Status: ${admin.accountStatus}`);
    } else {
      console.log('  ⚠️ No Admin user found! Run "npm run db:seed" to create the initial admin account.');
    }

    console.log('\n✅ Database verification completed successfully!');
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
