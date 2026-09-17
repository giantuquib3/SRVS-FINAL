const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  console.log('🔍 Checking PostgreSQL Database Connection & Table Schema...\n');
  const start = Date.now();

  try {
    const [
      departments,
      subjects,
      users,
      admins,
      deptHeads,
      faculties,
      students,
      syllabi,
      versions,
      enrollments,
    ] = await Promise.all([
      prisma.department.count(),
      prisma.subject.count(),
      prisma.user.count(),
      prisma.admin.count(),
      prisma.departmentHead.count(),
      prisma.faculty.count(),
      prisma.student.count(),
      prisma.syllabus.count(),
      prisma.syllabusVersion.count(),
      prisma.enrollment.count(),
    ]);

    const latency = Date.now() - start;

    console.log('====================================================');
    console.log('       USJ-R SRVS DATABASE STATUS & SUMMARY         ');
    console.log('====================================================');
    console.log(`Database Engine: PostgreSQL (Supabase Pooled Connection)`);
    console.log(`Roundtrip Latency: ${latency} ms`);
    console.log(`Connection Status: HEALTHY & ONLINE\n`);

    console.log('Streamlined & Segregated Table Record Counts:');
    console.table({
      'srvs_departments': { Records: departments, PK_Type: 'Integer (SERIAL)', Description: 'Engineering Departments' },
      'srvs_subjects': { Records: subjects, PK_Type: 'Integer (SERIAL)', Description: 'Academic Subjects Curriculum' },
      'srvs_users': { Records: users, PK_Type: 'Integer (SERIAL)', Description: 'Central User Accounts & Credentials' },
      'srvs_admins': { Records: admins, PK_Type: 'Integer (SERIAL)', Description: 'Segregated Admin Profiles' },
      'srvs_department_heads': { Records: deptHeads, PK_Type: 'Integer (SERIAL)', Description: 'Segregated Dept Head Profiles' },
      'srvs_faculties': { Records: faculties, PK_Type: 'Integer (SERIAL)', Description: 'Segregated Faculty Profiles' },
      'srvs_students': { Records: students, PK_Type: 'Integer (SERIAL)', Description: 'Segregated Student Profiles' },
      'srvs_syllabi': { Records: syllabi, PK_Type: 'Integer (SERIAL)', Description: 'Course Syllabi Master Records' },
      'srvs_syllabus_versions': { Records: versions, PK_Type: 'Integer (SERIAL)', Description: 'Immutable Version Snapshots (v1, v2...)' },
      'srvs_enrollments': { Records: enrollments, PK_Type: 'Integer (SERIAL)', Description: 'Student Subject Enrollments' },
    });

    const admin = await prisma.user.findFirst({
      where: { role: 'Admin' },
      include: { adminProfile: true },
    });

    console.log('\nSystem Administrator Status:');
    if (admin) {
      console.log(`  ✓ Database ID (PK id): ${admin.id} [Type: Integer]`);
      console.log(`  ✓ University ID Number: ${admin.idNumber}`);
      console.log(`  ✓ Email: ${admin.email}`);
      console.log(`  ✓ Name: ${admin.fullName}`);
      console.log(`  ✓ Admin Profile Link: ${admin.adminProfile ? 'Linked (PK ID: ' + admin.adminProfile.id + ')' : 'None'}`);
    } else {
      console.log('  ⚠️ No Admin user found! Run "npm run db:seed" to create the initial admin account.');
    }

    // Inspect srvs_students records
    const studentRecords = await prisma.student.findMany({
      orderBy: { id: 'asc' },
    });

    console.log('\nStudent Table Records (srvs_students):');
    console.table(
      studentRecords.map((s) => ({
        'PK_id': s.id,
        'Student_ID_Number': s.studentIdNumber,
        'Full_Name': s.fullName,
        'Department': s.department, // "CPE" (not an ID or number)
        'Enrolled_Subjects (Codes Only)': s.enrolledSubjects || 'None',
        'Year_Level': s.yearLevel,
      }))
    );

    console.log('\n✅ Database verification completed successfully!');
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
