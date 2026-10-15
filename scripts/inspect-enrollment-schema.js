// Read-only inspection of the enrollments / subjects / syllabi tables before the ClassSection migration.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tables = process.argv.slice(2).length ? process.argv.slice(2) : ['enrollments', 'subjects', 'syllabi', 'class_sections'];
  for (const table of tables) {
    const idx = await prisma.$queryRawUnsafe(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename=$1`, table);
    console.log(`\n== ${table} indexes ==`);
    console.table(idx);
    const cols = await prisma.$queryRawUnsafe(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      table
    );
    console.log(`\n== ${table} columns ==`);
    console.table(cols);
    const cons = await prisma.$queryRawUnsafe(
      `SELECT conname, pg_get_constraintdef(c.oid) AS def FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid WHERE t.relname=$1`,
      table
    );
    console.log(`== ${table} constraints ==`);
    console.table(cons);
  }
  const counts = await prisma.$queryRawUnsafe(
    `SELECT (SELECT count(*) FROM enrollments)::int AS enrollments, (SELECT count(*) FROM subjects)::int AS subjects, (SELECT count(*) FROM syllabi)::int AS syllabi,
            (SELECT count(*) FROM (SELECT DISTINCT "subjectId","academicYear","semester","section" FROM enrollments) x)::int AS distinct_enrollment_sections,
            (SELECT count(*) FROM (SELECT DISTINCT "subjectId","academicYear","semester","section" FROM syllabi) y)::int AS distinct_syllabus_sections`
  );
  console.log('\n== counts ==');
  console.table(counts);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
