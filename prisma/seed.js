/**
 * SRVS Full Database Seed Script
 * Seeds: Departments, Admin, DepartmentHeads, Educators, Students, Subjects, Student Subjects, AuditLog
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

  // ─── 2. SUBJECTS (ACADEMIC CURRICULUM CATALOG) ─────────────────────────────────
  console.log('\n2. Seeding Subjects (Academic Curriculum Catalog)...');
  const subjectDefs = [
    // CPE
    { code: 'CPE101', title: 'Computer Programming 1', units: 3, lecHours: 2, labHours: 3, departmentId: 'CPE', yearLevel: '1st Year', semester: '1st Semester', prerequisite: 'None', professorName: null },
    { code: 'CPE201', title: 'Data Structures and Algorithms', units: 3, lecHours: 2, labHours: 3, departmentId: 'CPE', yearLevel: '2nd Year', semester: '1st Semester', prerequisite: 'CPE101', professorName: null },
    { code: 'CPE301', title: 'Computer Architecture and Organization', units: 3, lecHours: 3, labHours: 0, departmentId: 'CPE', yearLevel: '3rd Year', semester: '1st Semester', prerequisite: 'CPE201', professorName: null },
    { code: 'CPE401', title: 'Operating Systems', units: 3, lecHours: 3, labHours: 0, departmentId: 'CPE', yearLevel: '4th Year', semester: '1st Semester', prerequisite: 'CPE301', professorName: null },
    { code: 'CPE102', title: 'Computer Programming 2', units: 3, lecHours: 2, labHours: 3, departmentId: 'CPE', yearLevel: '1st Year', semester: '2nd Semester', prerequisite: 'CPE101', professorName: null },
    { code: 'CPE202', title: 'Object-Oriented Programming', units: 3, lecHours: 2, labHours: 3, departmentId: 'CPE', yearLevel: '2nd Year', semester: '2nd Semester', prerequisite: 'CPE102', professorName: null },
    // EE
    { code: 'EE101',  title: 'Basic Electrical Engineering', units: 3, lecHours: 3, labHours: 0, departmentId: 'EE',  yearLevel: '1st Year', semester: '1st Semester', prerequisite: 'None', professorName: null },
    { code: 'EE201',  title: 'Electric Circuit Analysis', units: 3, lecHours: 3, labHours: 0, departmentId: 'EE',  yearLevel: '2nd Year', semester: '1st Semester', prerequisite: 'EE101', professorName: null },
    { code: 'EE301',  title: 'Power Systems Engineering', units: 3, lecHours: 3, labHours: 0, departmentId: 'EE',  yearLevel: '3rd Year', semester: '1st Semester', prerequisite: 'EE201', professorName: null },
    // CE
    { code: 'CE101',  title: 'Engineering Drawing', units: 2, lecHours: 1, labHours: 3, departmentId: 'CE',  yearLevel: '1st Year', semester: '1st Semester', prerequisite: 'None', professorName: null },
    { code: 'CE201',  title: 'Structural Analysis', units: 3, lecHours: 3, labHours: 0, departmentId: 'CE',  yearLevel: '2nd Year', semester: '1st Semester', prerequisite: 'CE101', professorName: null },
    // ECE
    { code: 'ECE101', title: 'Electronics Engineering Fundamentals', units: 3, lecHours: 3, labHours: 0, departmentId: 'ECE', yearLevel: '1st Year', semester: '1st Semester', prerequisite: 'None', professorName: null },
    { code: 'ECE201', title: 'Electronic Circuits and Devices', units: 3, lecHours: 2, labHours: 3, departmentId: 'ECE', yearLevel: '2nd Year', semester: '1st Semester', prerequisite: 'ECE101', professorName: null },
  ];

  const subjectMap = {};
  for (const s of subjectDefs) {
    const subject = await prisma.subject.upsert({
      where: { code: s.code },
      update: { title: s.title, units: s.units, lecHours: s.lecHours, labHours: s.labHours, professorName: s.professorName },
      create: s,
    });
    subjectMap[s.code] = subject.id;
    console.log(`   ✓ Subject: [${s.code}] ${s.title} (ID: ${subject.id}, ${s.departmentId})`);
  }

  // ─── 3. AUDIT LOG ENTRY ──────────────────────────────────────────────────────
  console.log('\n3. Adding seed audit log...');
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
  const subjectCount   = await prisma.subject.count();
  const enrollCount    = await prisma.studentSubject.count();
  const auditCount     = await prisma.auditLog.count();

  const byRole = await prisma.user.groupBy({ by: ['role'], _count: { _all: true } });
  console.log(`Users      : ${userCount}`);
  byRole.forEach(r => console.log(`  [${r.role}] → ${r._count._all}`));
  console.log(`Subjects   : ${subjectCount}`);
  console.log(`Enrollments: ${enrollCount}`);
  console.log(`Audit Logs : ${auditCount}`);
  console.log('=================================\n');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
