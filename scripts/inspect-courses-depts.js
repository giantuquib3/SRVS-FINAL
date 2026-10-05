const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const courses = await prisma.$queryRawUnsafe('SELECT id, code, title, "professorName", "facultyName", "facultyId" FROM courses;');
  console.log('Courses (all 14):');
  console.table(courses);

  const depts = await prisma.$queryRawUnsafe('SELECT * FROM departments;');
  console.log('Departments:');
  console.table(depts);

  const deptConsts = await prisma.$queryRawUnsafe(`
    SELECT tc.constraint_name, tc.constraint_type, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = 'departments' AND tc.table_schema = 'public';
  `);
  console.log('Department constraints:');
  console.table(deptConsts);
}

main().finally(() => prisma.$disconnect());
