/**
 * SRVS Full Database Seed Script
 * Seeds: Departments, Admin, DepartmentHeads, Educators, Students, Courses, Enrollments, AuditLog
 * All users go into the unified `users` table with integer IDs.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// Helper: upsert a user by id (primary key), also handling email conflicts
async function upsertUser(data) {
  return await prisma.user.upsert({
    where: { id: data.id },
    update: data,
    create: data,
  });
}

async function main() {
  console.log('🌱 Starting SRVS database seeding...\n');

  const defaultHash = await bcrypt.hash('admin123', 10);
  const gianHash = await bcrypt.hash('Giangwapo123?', 10);

  // ─── 0. DEPARTMENTS ──────────────────────────────────────────────────────────
  console.log('0. Seeding Departments...');
  const departments = [
    { id: 'CPE', code: 'CPE', name: 'Computer Engineering Department', description: 'Department of Computer Engineering' },
    { id: 'EE',  code: 'EE',  name: 'Electrical Engineering Department', description: 'Department of Electrical Engineering' },
    { id: 'CE',  code: 'CE',  name: 'Civil Engineering Department', description: 'Department of Civil Engineering' },
    { id: 'ECE', code: 'ECE', name: 'Electronics Engineering Department', description: 'Department of Electronics Engineering' },
    { id: 'IE',  code: 'IE',  name: 'Industrial Engineering Department', description: 'Department of Industrial Engineering' },
    { id: 'ME',  code: 'ME',  name: 'Mechanical Engineering Department', description: 'Department of Mechanical Engineering' },
  ];
  for (const d of departments) {
    await prisma.department.upsert({
      where: { id: d.id },
      update: { name: d.name, description: d.description },
      create: d,
    });
    console.log(`   ✓ Department: [${d.code}] ${d.name}`);
  }

  // ─── 1. ADMIN ────────────────────────────────────────────────────────────────
  console.log('\n1. Seeding Admin...');
  await upsertUser({
    id: 0,
    email: 'admin@usjr.edu.ph',
    fullName: 'System Administrator',
    passwordHash: defaultHash,
    role: 'Admin',
    departmentId: null,
    accountStatus: 'Active',
  });
  console.log('   ✓ Admin: admin@usjr.edu.ph (ID: 0, pw: admin123)');

  // ─── 2. DEPARTMENT HEADS ─────────────────────────────────────────────────────
  console.log('\n2. Seeding Department Heads...');
  const deptHeads = [
    { id: 10001, email: 'depthead.cpe@usjr.edu.ph', fullName: 'Dr. Alan Turing', departmentId: 'CPE', academicRank: 'Department Chairperson' },
    { id: 10003, email: 'depthead.ee@usjr.edu.ph',  fullName: 'Dr. Nikola Tesla', departmentId: 'EE',  academicRank: 'Department Chairperson' },
    { id: 10005, email: 'depthead.ce@usjr.edu.ph',  fullName: 'Dr. Isambard Brunel', departmentId: 'CE', academicRank: 'Department Chairperson' },
    { id: 10007, email: 'depthead.ece@usjr.edu.ph', fullName: 'Dr. James Watt',   departmentId: 'ECE', academicRank: 'Department Chairperson' },
  ];
  for (const u of deptHeads) {
    await upsertUser({ ...u, passwordHash: defaultHash, role: 'DepartmentHead', accountStatus: 'Active' });
    console.log(`   ✓ DeptHead: ${u.fullName} [${u.departmentId}] (ID: ${u.id})`);
  }

  // ─── 3. EDUCATORS (FACULTY) ──────────────────────────────────────────────────
  console.log('\n3. Seeding Educators...');
  const educators = [
    { id: 10002, email: 'faculty.cpe@usjr.edu.ph',   fullName: 'Engr. Ada Lovelace',   departmentId: 'CPE', academicRank: 'Assistant Professor' },
    { id: 10004, email: 'faculty2.cpe@usjr.edu.ph',  fullName: 'Engr. Grace Hopper',   departmentId: 'CPE', academicRank: 'Instructor' },
    { id: 10006, email: 'faculty.ee@usjr.edu.ph',    fullName: 'Engr. Michael Faraday', departmentId: 'EE',  academicRank: 'Associate Professor' },
    { id: 10008, email: 'faculty.ce@usjr.edu.ph',    fullName: 'Engr. Marie Curie',    departmentId: 'CE',  academicRank: 'Assistant Professor' },
    { id: 10010, email: 'faculty.ece@usjr.edu.ph',   fullName: 'Engr. Heinrich Hertz', departmentId: 'ECE', academicRank: 'Instructor' },
  ];
  for (const u of educators) {
    await upsertUser({ ...u, passwordHash: defaultHash, role: 'Educator', accountStatus: 'Active' });
    console.log(`   ✓ Educator: ${u.fullName} [${u.departmentId}] (ID: ${u.id})`);
  }

  // ─── 4. STUDENTS ─────────────────────────────────────────────────────────────
  console.log('\n4. Seeding Students...');
  const students = [
    { id: 2022012708, email: 'gian.tuquib@usjr.edu.ph',     fullName: 'Gian Carlo Tuquib',    departmentId: 'CPE', yearLevel: '3rd Year', passwordHash: gianHash },
    { id: 2023010001, email: 'student.cpe@usjr.edu.ph',     fullName: 'Jane Doe',             departmentId: 'CPE', yearLevel: '1st Year', passwordHash: defaultHash },
    { id: 2023010002, email: 'student2.cpe@usjr.edu.ph',    fullName: 'John Smith',           departmentId: 'CPE', yearLevel: '2nd Year', passwordHash: defaultHash },
    { id: 2023020001, email: 'student.ee@usjr.edu.ph',      fullName: 'Maria Santos',         departmentId: 'EE',  yearLevel: '1st Year', passwordHash: defaultHash },
    { id: 2023030001, email: 'student.ce@usjr.edu.ph',      fullName: 'Carlos Reyes',         departmentId: 'CE',  yearLevel: '2nd Year', passwordHash: defaultHash },
    { id: 2022010099, email: 'student.pending@usjr.edu.ph', fullName: 'Pending Approval User',departmentId: 'CPE', yearLevel: '1st Year', passwordHash: defaultHash, accountStatus: 'PendingApproval' },
  ];
  for (const u of students) {
    await upsertUser({ ...u, role: 'Student', accountStatus: u.accountStatus || 'Active' });
    console.log(`   ✓ Student: ${u.fullName} [${u.departmentId}] (ID: ${u.id}) - Status: ${u.accountStatus || 'Active'}`);
  }

  // ─── 5. COURSES ──────────────────────────────────────────────────────────────
  console.log('\n5. Seeding Courses...');
  const courseDefs = [
    // CPE
    { code: 'CPE101', title: 'Computer Programming 1', units: 3, lecHours: 2, labHours: 3, departmentId: 'CPE', yearLevel: '1st Year', semester: '1st Semester', prerequisite: 'None', professorName: 'Engr. Ada Lovelace' },
    { code: 'CPE201', title: 'Data Structures and Algorithms', units: 3, lecHours: 2, labHours: 3, departmentId: 'CPE', yearLevel: '2nd Year', semester: '1st Semester', prerequisite: 'CPE101', professorName: 'Engr. Grace Hopper' },
    { code: 'CPE301', title: 'Computer Architecture and Organization', units: 3, lecHours: 3, labHours: 0, departmentId: 'CPE', yearLevel: '3rd Year', semester: '1st Semester', prerequisite: 'CPE201', professorName: 'Dr. Alan Turing' },
    { code: 'CPE401', title: 'Operating Systems', units: 3, lecHours: 3, labHours: 0, departmentId: 'CPE', yearLevel: '4th Year', semester: '1st Semester', prerequisite: 'CPE301', professorName: 'Engr. Ada Lovelace' },
    { code: 'CPE102', title: 'Computer Programming 2', units: 3, lecHours: 2, labHours: 3, departmentId: 'CPE', yearLevel: '1st Year', semester: '2nd Semester', prerequisite: 'CPE101', professorName: 'Engr. Grace Hopper' },
    { code: 'CPE202', title: 'Object-Oriented Programming', units: 3, lecHours: 2, labHours: 3, departmentId: 'CPE', yearLevel: '2nd Year', semester: '2nd Semester', prerequisite: 'CPE102', professorName: 'Dr. Alan Turing' },
    // EE
    { code: 'EE101',  title: 'Basic Electrical Engineering', units: 3, lecHours: 3, labHours: 0, departmentId: 'EE',  yearLevel: '1st Year', semester: '1st Semester', prerequisite: 'None', professorName: 'Engr. Michael Faraday' },
    { code: 'EE201',  title: 'Electric Circuit Analysis', units: 3, lecHours: 3, labHours: 0, departmentId: 'EE',  yearLevel: '2nd Year', semester: '1st Semester', prerequisite: 'EE101', professorName: 'Dr. Nikola Tesla' },
    { code: 'EE301',  title: 'Power Systems Engineering', units: 3, lecHours: 3, labHours: 0, departmentId: 'EE',  yearLevel: '3rd Year', semester: '1st Semester', prerequisite: 'EE201', professorName: 'Engr. Michael Faraday' },
    // CE
    { code: 'CE101',  title: 'Engineering Drawing', units: 2, lecHours: 1, labHours: 3, departmentId: 'CE',  yearLevel: '1st Year', semester: '1st Semester', prerequisite: 'None', professorName: 'Engr. Marie Curie' },
    { code: 'CE201',  title: 'Structural Analysis', units: 3, lecHours: 3, labHours: 0, departmentId: 'CE',  yearLevel: '2nd Year', semester: '1st Semester', prerequisite: 'CE101', professorName: 'Dr. Isambard Brunel' },
    // ECE
    { code: 'ECE101', title: 'Electronics Engineering Fundamentals', units: 3, lecHours: 3, labHours: 0, departmentId: 'ECE', yearLevel: '1st Year', semester: '1st Semester', prerequisite: 'None', professorName: 'Engr. Heinrich Hertz' },
    { code: 'ECE201', title: 'Electronic Circuits and Devices', units: 3, lecHours: 2, labHours: 3, departmentId: 'ECE', yearLevel: '2nd Year', semester: '1st Semester', prerequisite: 'ECE101', professorName: 'Dr. James Watt' },
  ];

  const courseMap = {};
  for (const c of courseDefs) {
    const course = await prisma.course.upsert({
      where: { code: c.code },
      update: { title: c.title, units: c.units, lecHours: c.lecHours, labHours: c.labHours, professorName: c.professorName },
      create: c,
    });
    courseMap[c.code] = course.id;
    console.log(`   ✓ Course: [${c.code}] ${c.title} (ID: ${course.id}, ${c.departmentId})`);
  }

  // ─── 6. ENROLLMENTS ──────────────────────────────────────────────────────────
  console.log('\n6. Seeding Enrollments...');
  const enrollmentDefs = [
    { studentId: 2022012708, studentName: 'Gian Carlo Tuquib', courseCode: 'CPE301', semester: '1st Semester', academicYear: '2026-2027', section: 'A' },
    { studentId: 2022012708, studentName: 'Gian Carlo Tuquib', courseCode: 'CPE401', semester: '1st Semester', academicYear: '2026-2027', section: 'A' },
    { studentId: 2023010001, studentName: 'Jane Doe',          courseCode: 'CPE101', semester: '1st Semester', academicYear: '2026-2027', section: 'A' },
    { studentId: 2023010001, studentName: 'Jane Doe',          courseCode: 'CPE102', semester: '2nd Semester', academicYear: '2026-2027', section: 'A' },
    { studentId: 2023010002, studentName: 'John Smith',        courseCode: 'CPE201', semester: '1st Semester', academicYear: '2026-2027', section: 'B' },
    { studentId: 2023010002, studentName: 'John Smith',        courseCode: 'CPE202', semester: '2nd Semester', academicYear: '2026-2027', section: 'B' },
    { studentId: 2023020001, studentName: 'Maria Santos',      courseCode: 'EE101',  semester: '1st Semester', academicYear: '2026-2027', section: 'A' },
    { studentId: 2023030001, studentName: 'Carlos Reyes',      courseCode: 'CE101',  semester: '1st Semester', academicYear: '2026-2027', section: 'A' },
    { studentId: 2023030001, studentName: 'Carlos Reyes',      courseCode: 'CE201',  semester: '1st Semester', academicYear: '2026-2027', section: 'A' },
  ];

  for (const e of enrollmentDefs) {
    const courseId = courseMap[e.courseCode];
    if (!courseId) continue;
    await prisma.enrollment.upsert({
      where: {
        studentId_courseId: {
          studentId: e.studentId,
          courseId: courseId,
        },
      },
      update: { status: 'ENROLLED', studentName: e.studentName },
      create: {
        studentId: e.studentId,
        studentName: e.studentName,
        courseId: courseId,
        semester: e.semester,
        academicYear: e.academicYear,
        section: e.section,
        status: 'ENROLLED',
      },
    });
    console.log(`   ✓ Enrollment: Student ${e.studentId} (${e.studentName}) → ${e.courseCode} (Course ID: ${courseId})`);
  }

  // ─── 7. AUDIT LOG ENTRY ──────────────────────────────────────────────────────
  console.log('\n7. Adding seed audit log...');
  await prisma.auditLog.create({
    data: {
      userId: 0,
      userDisplayName: 'System Administrator',
      actionType: 'SystemSeed',
      resultStatus: 'Success',
      description: 'Database seeded successfully with initial system data.',
      entityType: 'System',
    },
  });
  console.log('   ✓ Audit log entry created');

  // ─── SUMMARY ─────────────────────────────────────────────────────────────────
  console.log('\n\n========= SEED COMPLETE =========');
  const userCount      = await prisma.user.count();
  const courseCount    = await prisma.course.count();
  const enrollCount    = await prisma.enrollment.count();
  const auditCount     = await prisma.auditLog.count();

  const byRole = await prisma.user.groupBy({ by: ['role'], _count: { _all: true } });
  console.log(`Users      : ${userCount}`);
  byRole.forEach(r => console.log(`  [${r.role}] → ${r._count._all}`));
  console.log(`Courses    : ${courseCount}`);
  console.log(`Enrollments: ${enrollCount}`);
  console.log(`Audit Logs : ${auditCount}`);
  console.log('=================================\n');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
