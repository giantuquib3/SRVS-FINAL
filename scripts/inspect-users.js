const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspect() {
  console.log('--- USJ-R DEPARTMENTS ---');
  const depts = await prisma.department.findMany({ orderBy: { id: 'asc' } });
  console.table(depts.map(d => ({ id: d.id, code: d.code, name: d.name })));

  console.log('\n--- USJ-R USERS & DEPT ASSIGNMENTS ---');
  const users = await prisma.user.findMany({
    select: {
      id: true,
      idNumber: true,
      fullName: true,
      email: true,
      role: true,
      departmentId: true,
      department: { select: { id: true, code: true, name: true } },
      deptHeadProfile: true,
      facultyProfile: true,
      studentProfile: true,
    },
    orderBy: { id: 'asc' },
  });

  console.table(
    users.map(u => ({
      id: u.id,
      idNumber: u.idNumber,
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      user_departmentId: u.departmentId,
      resolved_deptCode:
        u.department?.code ||
        u.deptHeadProfile?.department ||
        u.facultyProfile?.department ||
        u.studentProfile?.department ||
        'None (Admin)',
    }))
  );

  console.log('\n--- SUBJECTS & DEPARTMENTS ---');
  const subjects = await prisma.subject.findMany({
    include: { department: true },
    orderBy: { id: 'asc' },
  });
  console.table(
    subjects.map(s => ({
      id: s.id,
      code: s.code,
      title: s.title,
      deptId: s.departmentId,
      deptCode: s.department?.code,
    }))
  );
}

inspect()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
