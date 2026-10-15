const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log('=== Starting Migration: Rename courses to subjects ===\n');

  // Verify before counts
  const coursesCount = await prisma.course.count();
  const enrollmentsCount = await prisma.enrollment.count();
  const syllabiCount = await prisma.syllabus.count();
  console.log(`Pre-migration counts: courses=${coursesCount}, enrollments=${enrollmentsCount}, syllabi=${syllabiCount}`);

  // 1. Rename table courses to subjects
  console.log('1. Renaming courses table to subjects...');
  await prisma.$executeRawUnsafe(`ALTER TABLE "courses" RENAME TO "subjects";`);
  console.log('✓ Renamed table "courses" to "subjects".');

  // 2. Rename sequence if exists
  try {
    await prisma.$executeRawUnsafe(`ALTER SEQUENCE IF EXISTS courses_id_seq RENAME TO subjects_id_seq;`);
    console.log('✓ Renamed sequence if existed.');
  } catch (e) {
    console.log('Note on sequence:', e.message);
  }

  // 3. Rename constraints and indexes on subjects table
  console.log('2. Updating constraints on subjects table...');
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "subjects" RENAME CONSTRAINT "courses_pkey" TO "subjects_pkey";`);
  } catch (e) { console.log('PK rename note:', e.message); }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "subjects" RENAME CONSTRAINT "courses_code_key" TO "subjects_code_key";`);
  } catch (e) { console.log('Code key rename note:', e.message); }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "subjects" RENAME CONSTRAINT "courses_departmentId_fkey" TO "subjects_departmentId_fkey";`);
  } catch (e) { console.log('Dept FK rename note:', e.message); }
  try {
    await prisma.$executeRawUnsafe(`ALTER INDEX IF EXISTS "courses_departmentId_idx" RENAME TO "subjects_departmentId_idx";`);
  } catch (e) { console.log('Index rename note:', e.message); }

  // 4. Update enrollments table
  console.log('3. Updating enrollments table (courseId -> subjectId)...');
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_courseId_fkey";`);
  } catch (e) { console.log('Drop enrollments FK note:', e.message); }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_pkey";`);
  } catch (e) { console.log('Drop enrollments PK note:', e.message); }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "enrollments" RENAME COLUMN "courseId" TO "subjectId";`);
  } catch (e) { console.log('Rename enrollments column note:', e.message); }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_pkey" PRIMARY KEY ("studentId", "subjectId");`);
  } catch (e) { console.log('Add enrollments PK note:', e.message); }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
  } catch (e) { console.log('Add enrollments FK note:', e.message); }
  try {
    await prisma.$executeRawUnsafe(`ALTER INDEX IF EXISTS "enrollments_courseId_idx" RENAME TO "enrollments_subjectId_idx";`);
  } catch (e) { console.log('Rename enrollments index note:', e.message); }

  // 5. Update syllabi table
  console.log('4. Updating syllabi table (courseId -> subjectId)...');
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "syllabi" DROP CONSTRAINT IF EXISTS "syllabi_courseId_fkey";`);
  } catch (e) { console.log('Drop syllabi FK note:', e.message); }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "syllabi" RENAME COLUMN "courseId" TO "subjectId";`);
  } catch (e) { console.log('Rename syllabi column note:', e.message); }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;`);
  } catch (e) { console.log('Add syllabi FK note:', e.message); }
  try {
    await prisma.$executeRawUnsafe(`ALTER INDEX IF EXISTS "syllabi_courseId_idx" RENAME TO "syllabi_subjectId_idx";`);
  } catch (e) { console.log('Rename syllabi index note:', e.message); }

  // 6. Verify post-migration state
  console.log('\n5. Verifying database state post-migration...');
  const subjects = await prisma.$queryRawUnsafe(`SELECT count(*) as cnt FROM "subjects";`);
  const enrollments = await prisma.$queryRawUnsafe(`SELECT count(*) as cnt FROM "enrollments";`);
  const syllabi = await prisma.$queryRawUnsafe(`SELECT count(*) as cnt FROM "syllabi";`);
  console.log('Post-migration counts in PostgreSQL:');
  console.log({
    subjects: subjects[0]?.cnt,
    enrollments: enrollments[0]?.cnt,
    syllabi: syllabi[0]?.cnt,
  });

  const fks = await prisma.$queryRawUnsafe(`
    SELECT tc.constraint_name, tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public'
    ORDER BY tc.table_name, kcu.column_name;
  `);
  console.log('\nForeign key constraints:');
  console.table(fks);

  console.log('\n=== Database migration completed successfully! ===');
}

migrate()
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
