const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting SRVS database seeding...');

  // 1. Seed Required Engineering Departments
  const departmentsData = [
    { id: 'CE', code: 'CE', name: 'Civil Engineering', description: 'Department of Civil Engineering' },
    { id: 'CPE', code: 'CPE', name: 'Computer Engineering', description: 'Department of Computer Engineering' },
    { id: 'ECE', code: 'ECE', name: 'Electronics Engineering', description: 'Department of Electronics Engineering' },
    { id: 'IE', code: 'IE', name: 'Industrial Engineering', description: 'Department of Industrial Engineering' },
    { id: 'ME', code: 'ME', name: 'Mechanical Engineering', description: 'Department of Mechanical Engineering' },
    { id: 'EE', code: 'EE', name: 'Electrical Engineering', description: 'Department of Electrical Engineering' },
  ];

  const deptMap = {};
  for (const dept of departmentsData) {
    const record = await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, description: dept.description },
      create: dept,
    });
    deptMap[dept.code] = record;
    console.log(`✓ Seeded Department: [${record.code}] ${record.name} (PK id: ${record.id})`);
  }

  // Common password hash for Giangwapo123? and admin123
  const defaultUserPasswordHash = await bcrypt.hash('Giangwapo123?', 10);
  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  // 2. Seed Admin User Only (5 digits: 00000)
  const usersData = [
    {
      id: '00000',
      email: 'admin@srvs.local',
      passwordHash: adminPasswordHash,
      firstName: 'System',
      lastName: 'Administrator',
      fullName: 'System Administrator',
      role: 'Admin',
      departmentId: 'CPE',
      accountStatus: 'Active',
    },
  ];

  const userMap = {};
  for (const user of usersData) {
    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        id: user.id,
        role: user.role,
        departmentId: user.departmentId,
        accountStatus: user.accountStatus,
        fullName: user.fullName,
      },
      create: user,
    });
    userMap[user.email] = record;
    console.log(`✓ Seeded User: [${record.role}] PK id: ${record.id} | ${record.email} (${record.accountStatus})`);
  }

  // 3. Seed Courses
  const coursesData = [
    {
      id: 'CPE101',
      code: 'CPE101',
      title: 'Introduction to Computer Engineering',
      description: 'Foundations of computer engineering, digital logic, and computing paradigms.',
      departmentId: 'CPE',
    },
    {
      id: 'CPE201',
      code: 'CPE201',
      title: 'Data Structures and Algorithms',
      description: 'Design and analysis of fundamental data structures and algorithmic complexity.',
      departmentId: 'CPE',
    },
    {
      id: 'CE101',
      code: 'CE101',
      title: 'Fundamentals of Surveying',
      description: 'Measurement of distances, elevations, and directions.',
      departmentId: 'CE',
    },
    {
      id: 'ECE101',
      code: 'ECE101',
      title: 'Electronic Devices and Circuits',
      description: 'Semiconductor physics, diode and transistor circuits, amplifier design.',
      departmentId: 'ECE',
    },
    {
      id: 'IE101',
      code: 'IE101',
      title: 'Engineering Economics',
      description: 'Economic analysis of engineering decisions, cost models, and return on investment.',
      departmentId: 'IE',
    },
    {
      id: 'ME101',
      code: 'ME101',
      title: 'Thermodynamics 1',
      description: 'Principles of work, heat, energy, and entropy in thermal systems.',
      departmentId: 'ME',
    },
    {
      id: 'EE101',
      code: 'EE101',
      title: 'Electric Circuit Theory 1',
      description: 'DC circuit analysis, Kirchhoff laws, node and mesh methods.',
      departmentId: 'EE',
    },
  ];

  const courseMap = {};
  for (const course of coursesData) {
    const record = await prisma.course.upsert({
      where: { code: course.code },
      update: { title: course.title, description: course.description, departmentId: course.departmentId },
      create: course,
    });
    courseMap[course.code] = record;
    console.log(`✓ Seeded Course: [${record.code}] ${record.title} (PK id: ${record.id})`);
  }

  // 4. Seed Initial Audit Log
  await prisma.auditLog.create({
    data: {
      userId: '00000',
      userDisplayName: 'System Administrator',
      actionType: 'SystemInitialization',
      resultStatus: 'Success',
      description: 'Database initialized with standard engineering departments, foundational courses, and admin user (PK 00000).',
      entityType: 'System',
      entityId: 'Init',
    }
  });
  console.log('✓ Seeded Initial Audit Log');

  console.log('✅ SRVS database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
