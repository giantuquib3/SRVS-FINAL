const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Cleaning and Standardizing Supabase Database Schema ===\n');

  // 1. Drop obsolete views
  console.log('1. Dropping obsolete views "admin" and "Enrollees"...');
  await prisma.$executeRawUnsafe(`DROP VIEW IF EXISTS "admin" CASCADE;`);
  await prisma.$executeRawUnsafe(`DROP VIEW IF EXISTS "Enrollees" CASCADE;`);
  console.log('   Views dropped successfully.');

  // 2. Check and remove legacy columns on courses
  console.log('2. Checking and removing legacy columns on "courses"...');
  const courseCols = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'courses';
  `);
  const colNames = courseCols.map(c => c.column_name);
  console.log('   Current columns in courses:', colNames);

  if (colNames.includes('facultyName')) {
    await prisma.$executeRawUnsafe(`
      UPDATE "courses" 
      SET "professorName" = "facultyName" 
      WHERE "professorName" IS NULL AND "facultyName" IS NOT NULL;
    `);
    await prisma.$executeRawUnsafe(`ALTER TABLE "courses" DROP COLUMN IF EXISTS "facultyName";`);
    console.log('   Dropped facultyName from courses.');
  }

  if (colNames.includes('facultyId')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "courses" DROP COLUMN IF EXISTS "facultyId";`);
    console.log('   Dropped facultyId from courses.');
  }

  // 3. Clean up indexes and constraint names on users
  console.log('3. Standardizing constraint and index names on "users"...');
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "admin_role_idx";`);
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "admin_departmentId_idx";`);
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "admin_accountStatus_idx";`);
  
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_pkey') THEN
        ALTER TABLE "users" RENAME CONSTRAINT "admin_pkey" TO "users_pkey";
      END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_email_key') THEN
        ALTER TABLE "users" RENAME CONSTRAINT "admin_email_key" TO "users_email_key";
      END IF;
    END $$;
  `);
  console.log('   Users constraints and indexes standardized.');

  // 4. Ensure all indexes on users exist
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" ("role");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "users_departmentId_idx" ON "users" ("departmentId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "users_accountStatus_idx" ON "users" ("accountStatus");`);

  console.log('\n=== Supabase Database Schema Successfully Standardized! ===');
}

main()
  .catch(err => {
    console.error('Migration error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
