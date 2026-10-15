const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({
    orderBy: { id: 'asc' },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      departmentId: true,
      accountStatus: true,
      mustChangePassword: true,
      passwordHash: true
    }
  });

  const commonPasswords = [
    'admin123',
    'student123',
    'Giangwapo123?',
    'Admin123!',
    'Password123!',
    'Student123!',
    'Faculty123!',
    'Head123!',
    'password',
    '123456',
    'usjr1234',
    'AdminPass123!',
    'DeptHeadPass123!',
    'FacultyPass123!',
    'StudentPass123!',
    'SecurePass123!',
    'TempPass123!'
  ];

  console.log('Total accounts found:', users.length);
  const results = [];

  for (const u of users) {
    let matchedPw = null;
    for (const pw of commonPasswords) {
      if (u.passwordHash && bcrypt.compareSync(pw, u.passwordHash)) {
        matchedPw = pw;
        break;
      }
    }
    results.push({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      dept: u.departmentId || '-',
      status: u.accountStatus,
      mustChangePw: u.mustChangePassword ? 'YES' : 'NO',
      password: matchedPw || '(Unknown hash)'
    });
  }

  console.table(results);
}

check().finally(() => prisma.$disconnect());
