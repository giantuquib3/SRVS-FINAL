const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Adding Explicit Foreign Keys to Supabase PostgreSQL Database ===\n');

  const fks = [
    {
      name: 'users_departmentId_fkey',
      table: 'users',
      sql: `ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;`
    },
    {
      name: 'courses_departmentId_fkey',
      table: 'courses',
      sql: `ALTER TABLE "courses" ADD CONSTRAINT "courses_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`
    },
    {
      name: 'enrollments_studentId_fkey',
      table: 'enrollments',
      sql: `ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;`
    },
    {
      name: 'enrollments_courseId_fkey',
      table: 'enrollments',
      sql: `ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;`
    },
    {
      name: 'syllabi_courseId_fkey',
      table: 'syllabi',
      sql: `ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;`
    },
    {
      name: 'syllabi_departmentId_fkey',
      table: 'syllabi',
      sql: `ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;`
    },
    {
      name: 'syllabi_instructorId_fkey',
      table: 'syllabi',
      sql: `ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;`
    },
    {
      name: 'syllabi_reviewedByUserId_fkey',
      table: 'syllabi',
      sql: `ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;`
    },
    {
      name: 'syllabus_versions_syllabusId_fkey',
      table: 'syllabus_versions',
      sql: `ALTER TABLE "syllabus_versions" ADD CONSTRAINT "syllabus_versions_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "syllabi"("id") ON DELETE CASCADE ON UPDATE CASCADE;`
    },
    {
      name: 'syllabus_versions_editorId_fkey',
      table: 'syllabus_versions',
      sql: `ALTER TABLE "syllabus_versions" ADD CONSTRAINT "syllabus_versions_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;`
    },
    {
      name: 'syllabus_versions_submittedById_fkey',
      table: 'syllabus_versions',
      sql: `ALTER TABLE "syllabus_versions" ADD CONSTRAINT "syllabus_versions_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;`
    },
    {
      name: 'syllabus_versions_reviewedById_fkey',
      table: 'syllabus_versions',
      sql: `ALTER TABLE "syllabus_versions" ADD CONSTRAINT "syllabus_versions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;`
    },
    {
      name: 'audit_logs_userId_fkey',
      table: 'audit_logs',
      sql: `ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;`
    }
  ];

  for (const fk of fks) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "${fk.table}" DROP CONSTRAINT IF EXISTS "${fk.name}";`);
      await prisma.$executeRawUnsafe(fk.sql);
      console.log(`✓ Added FK: ${fk.name}`);
    } catch (e) {
      console.error(`✗ Error adding FK ${fk.name}:`, e.message);
    }
  }

  console.log('\n=== Finished Adding Foreign Keys! ===');
}

main().finally(() => prisma.$disconnect());
