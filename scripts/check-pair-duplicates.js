const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const all = await prisma.enrollment.findMany();
  console.log('Total enrollments:', all.length);
  const seen = new Set();
  const duplicates = [];
  for (const e of all) {
    const key = `${e.studentId}_${e.courseId}`;
    if (seen.has(key)) {
      duplicates.push(e);
    } else {
      seen.add(key);
    }
  }
  console.log('Duplicate (studentId, courseId) rows:', duplicates.length);
  if (duplicates.length > 0) {
    console.table(duplicates);
  }
}

check().finally(() => prisma.$disconnect());
