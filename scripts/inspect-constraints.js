const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tables = ['departments', 'users', 'courses', 'enrollments', 'syllabi', 'syllabus_versions', 'audit_logs'];
  
  for (const t of tables) {
    console.log(`\n=== TABLE: ${t} ===`);
    const constraints = await prisma.$queryRawUnsafe(`
      SELECT conname, contype, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace ns ON ns.oid = cl.relnamespace
      WHERE ns.nspname = 'public' AND cl.relname = '${t}';
    `);
    console.log('Constraints:');
    console.table(constraints);

    const indexes = await prisma.$queryRawUnsafe(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = '${t}';
    `);
    console.log('Indexes:');
    console.table(indexes);
  }
}

main().finally(() => prisma.$disconnect());
