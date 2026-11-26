const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log('=== Starting Enrollments Primary Key Migration ===\n');

  // 1. Inspect existing data
  const beforeCount = await prisma.enrollment.count();
  console.log(`Current total enrollment records: ${beforeCount}`);

  const sampleBefore = await prisma.enrollment.findMany({ take: 3 });
  console.log('Sample before migration:', sampleBefore);

  // 2. Check for duplicate records
  const duplicates = await prisma.$queryRawUnsafe(`
    SELECT "studentId", "courseId", "semester", "academicYear", COUNT(*) as cnt
    FROM "enrollments"
    GROUP BY "studentId", "courseId", "semester", "academicYear"
    HAVING COUNT(*) > 1;
  `);

  if (duplicates.length > 0) {
    console.error('Found duplicate records that must be resolved first:', duplicates);
    throw new Error('Duplicate records detected!');
  } else {
    console.log('✓ No duplicate records found for ("studentId", "courseId", "semester", "academicYear").');
  }

  // 3. Drop existing primary key constraint
  console.log('\nDropping existing primary key constraint enrollments_pkey...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_pkey";
  `);
  console.log('✓ Dropped old enrollments_pkey.');

  // 4. Add new composite primary key constraint
  console.log('\nAdding new composite primary key on ("studentId", "courseId", "semester", "academicYear")...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "enrollments"
    ADD CONSTRAINT "enrollments_pkey"
    PRIMARY KEY ("studentId", "courseId", "semester", "academicYear");
  `);
  console.log('✓ Added new composite primary key constraint.');

  // 5. Ensure Foreign Keys exist
  console.log('\nVerifying foreign keys...');
  const fks = await prisma.$queryRawUnsafe(`
    SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'enrollments';
  `);
  console.table(fks);

  // Ensure FKs are intact, if missing re-add them
  const hasStudentFk = fks.some(f => f.column_name === 'studentId');
  const hasCourseFk = fks.some(f => f.column_name === 'courseId');

  if (!hasStudentFk) {
    console.log('Re-adding enrollments_studentId_fkey...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "enrollments"
      ADD CONSTRAINT "enrollments_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `);
  }
  if (!hasCourseFk) {
    console.log('Re-adding enrollments_courseId_fkey...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "enrollments"
      ADD CONSTRAINT "enrollments_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `);
  }

  // 6. Verify data integrity after migration
  const afterCount = await prisma.enrollment.count();
  console.log(`\nRecords after migration: ${afterCount}`);
  if (beforeCount !== afterCount) {
    throw new Error(`Data mismatch! Before: ${beforeCount}, After: ${afterCount}`);
  }
  console.log('✓ All existing enrollments remain 100% intact!');

  // 7. Verify new constraints in pg_constraint
  const constraints = await prisma.$queryRawUnsafe(`
    SELECT conname, contype, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = cl.relnamespace
    WHERE ns.nspname = 'public' AND cl.relname = 'enrollments';
  `);
  console.log('\nFinal constraints on enrollments table:');
  console.table(constraints);

  console.log('\n=== Migration completed successfully! ===');
}

migrate()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
