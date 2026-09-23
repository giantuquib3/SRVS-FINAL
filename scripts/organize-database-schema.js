const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const databases = [
  {
    name: 'DB 1 (qoxpqhvecjxlsbsshxsm - Primary in .env)',
    url: 'postgresql://postgres.qoxpqhvecjxlsbsshxsm:Giangwapo123%3F@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require',
  },
  {
    name: 'DB 2 (goxvhkbwfpffjnqphzpq - Secondary in pgAdmin)',
    url: 'postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require',
  },
];

const DEPARTMENTS = [
  { id: 'CPE', code: 'CPE', name: 'Computer Engineering Department', description: 'College of Engineering' },
  { id: 'EE', code: 'EE', name: 'Electrical Engineering Department', description: 'College of Engineering' },
  { id: 'CE', code: 'CE', name: 'Civil Engineering Department', description: 'College of Engineering' },
  { id: 'ECE', code: 'ECE', name: 'Electronics Engineering Department', description: 'College of Engineering' },
  { id: 'IE', code: 'IE', name: 'Industrial Engineering Department', description: 'College of Engineering' },
  { id: 'ME', code: 'ME', name: 'Mechanical Engineering Department', description: 'College of Engineering' },
];

async function organizeDatabase(db) {
  console.log(`\n================================================================`);
  console.log(`Organizing Database Schema: ${db.name}`);
  console.log(`================================================================`);

  const client = new Client({ connectionString: db.url });
  await client.connect();

  try {
    // 1. Drop existing foreign keys across public schema
    console.log('1. Dropping existing foreign key constraints...');
    await client.query(`
      DO $$ 
      DECLARE 
        r RECORD;
      BEGIN
        FOR r IN (
          SELECT constraint_name, table_name 
          FROM information_schema.table_constraints 
          WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'
        ) LOOP
          EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE;';
        END LOOP;
      END $$;
    `);
    console.log('   ✓ Foreign keys cleared.');

    // 2. Drop legacy views
    console.log('2. Dropping legacy views...');
    await client.query(`DROP VIEW IF EXISTS "users" CASCADE;`);
    await client.query(`DROP VIEW IF EXISTS "admins" CASCADE;`);
    // If admin is a view (not a base table), drop it
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'admin') THEN
          EXECUTE 'DROP VIEW "admin" CASCADE;';
        END IF;
      END $$;
    `);
    console.log('   ✓ Legacy views dropped.');

    // 3. Create departments table with string PK
    console.log('3. Creating "departments" table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "departments" (
        "id" VARCHAR(10) NOT NULL,
        "code" VARCHAR(10) NOT NULL UNIQUE,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
      );
    `);

    // Seed departments
    for (const d of DEPARTMENTS) {
      await client.query(`
        INSERT INTO "departments" ("id", "code", "name", "description", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("id") DO UPDATE SET
          "code" = EXCLUDED."code",
          "name" = EXCLUDED."name",
          "description" = EXCLUDED."description",
          "updatedAt" = CURRENT_TIMESTAMP;
      `, [d.id, d.code, d.name, d.description]);
    }
    console.log('   ✓ "departments" table ready with 6 departments.');

    // 4. Rename base table "admin" to "users"
    console.log('4. Organizing base user table as "users"...');
    const checkTable = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('admin', 'users');
    `);

    const hasBaseAdmin = checkTable.rows.some(r => r.table_name === 'admin' && r.table_type === 'BASE TABLE');
    const hasBaseUsers = checkTable.rows.some(r => r.table_name === 'users' && r.table_type === 'BASE TABLE');

    if (hasBaseAdmin && !hasBaseUsers) {
      await client.query(`ALTER TABLE "admin" RENAME TO "users";`);
      console.log('   ✓ Renamed table "admin" -> "users".');
    } else if (hasBaseUsers) {
      console.log('   ✓ Table "users" already exists as base table.');
    } else {
      throw new Error('Neither "admin" nor "users" base table found!');
    }

    // Clean up primary key constraint name if needed
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'admin_pkey' AND table_name = 'users') THEN
          ALTER TABLE "users" RENAME CONSTRAINT "admin_pkey" TO "users_pkey";
        END IF;
      END $$;
    `);

    // 5. Create backwards compatibility views
    console.log('5. Creating backwards compatibility views...');
    await client.query(`CREATE OR REPLACE VIEW "admin" AS SELECT * FROM "users";`);
    await client.query(`CREATE OR REPLACE VIEW "admins" AS SELECT * FROM "users" WHERE "role" = 'Admin';`);
    console.log('   ✓ Views "admin" and "admins" created.');

    // 6. Ensure departmentId values in users, courses, syllabi conform to departments table
    console.log('6. Sanitizing departmentId references...');
    await client.query(`
      UPDATE "users" 
      SET "departmentId" = UPPER(TRIM("departmentId"))
      WHERE "departmentId" IS NOT NULL;
    `);
    await client.query(`
      UPDATE "users" 
      SET "departmentId" = NULL 
      WHERE "departmentId" IS NOT NULL AND "departmentId" NOT IN ('CPE', 'EE', 'CE', 'ECE', 'IE', 'ME');
    `);

    await client.query(`
      UPDATE "courses" 
      SET "departmentId" = UPPER(TRIM("departmentId"))
      WHERE "departmentId" IS NOT NULL;
    `);
    await client.query(`
      UPDATE "courses" 
      SET "departmentId" = 'CPE' 
      WHERE "departmentId" IS NULL OR "departmentId" NOT IN ('CPE', 'EE', 'CE', 'ECE', 'IE', 'ME');
    `);

    await client.query(`
      UPDATE "syllabi" 
      SET "departmentId" = UPPER(TRIM("departmentId"))
      WHERE "departmentId" IS NOT NULL;
    `);
    await client.query(`
      UPDATE "syllabi" 
      SET "departmentId" = 'CPE' 
      WHERE "departmentId" IS NULL OR "departmentId" NOT IN ('CPE', 'EE', 'CE', 'ECE', 'IE', 'ME');
    `);
    console.log('   ✓ departmentId values sanitized.');

    // 7. Establish all clean relational foreign keys
    console.log('7. Creating relational foreign keys...');
    
    // users -> departments
    await client.query(`
      ALTER TABLE "users" 
      ADD CONSTRAINT "users_departmentId_fkey" 
      FOREIGN KEY ("departmentId") REFERENCES "departments"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    // courses -> departments
    await client.query(`
      ALTER TABLE "courses" 
      ADD CONSTRAINT "courses_departmentId_fkey" 
      FOREIGN KEY ("departmentId") REFERENCES "departments"("id") 
      ON DELETE RESTRICT ON UPDATE CASCADE;
    `);

    // courses -> users (faculty)
    await client.query(`
      ALTER TABLE "courses" 
      ADD CONSTRAINT "courses_facultyId_fkey" 
      FOREIGN KEY ("facultyId") REFERENCES "users"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    // enrollments -> users (student)
    await client.query(`
      ALTER TABLE "enrollments" 
      ADD CONSTRAINT "enrollments_studentId_fkey" 
      FOREIGN KEY ("studentId") REFERENCES "users"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `);

    // enrollments -> courses
    await client.query(`
      ALTER TABLE "enrollments" 
      ADD CONSTRAINT "enrollments_courseId_fkey" 
      FOREIGN KEY ("courseId") REFERENCES "courses"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `);

    // syllabi -> courses
    await client.query(`
      ALTER TABLE "syllabi" 
      ADD CONSTRAINT "syllabi_courseId_fkey" 
      FOREIGN KEY ("courseId") REFERENCES "courses"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `);

    // syllabi -> users (instructor)
    await client.query(`
      ALTER TABLE "syllabi" 
      ADD CONSTRAINT "syllabi_instructorId_fkey" 
      FOREIGN KEY ("instructorId") REFERENCES "users"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `);

    // syllabi -> departments
    await client.query(`
      ALTER TABLE "syllabi" 
      ADD CONSTRAINT "syllabi_departmentId_fkey" 
      FOREIGN KEY ("departmentId") REFERENCES "departments"("id") 
      ON DELETE RESTRICT ON UPDATE CASCADE;
    `);

    // syllabi -> users (reviewer)
    await client.query(`
      ALTER TABLE "syllabi" 
      ADD CONSTRAINT "syllabi_reviewedByUserId_fkey" 
      FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    // syllabus_versions -> syllabi
    await client.query(`
      ALTER TABLE "syllabus_versions" 
      ADD CONSTRAINT "syllabus_versions_syllabusId_fkey" 
      FOREIGN KEY ("syllabusId") REFERENCES "syllabi"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `);

    // syllabus_versions -> users (editor)
    await client.query(`
      ALTER TABLE "syllabus_versions" 
      ADD CONSTRAINT "syllabus_versions_editorId_fkey" 
      FOREIGN KEY ("editorId") REFERENCES "users"("id") 
      ON DELETE RESTRICT ON UPDATE CASCADE;
    `);

    // syllabus_versions -> users (submittedBy)
    await client.query(`
      ALTER TABLE "syllabus_versions" 
      ADD CONSTRAINT "syllabus_versions_submittedById_fkey" 
      FOREIGN KEY ("submittedById") REFERENCES "users"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    // syllabus_versions -> users (reviewedBy)
    await client.query(`
      ALTER TABLE "syllabus_versions" 
      ADD CONSTRAINT "syllabus_versions_reviewedById_fkey" 
      FOREIGN KEY ("reviewedById") REFERENCES "users"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    // audit_logs -> users
    await client.query(`
      ALTER TABLE "audit_logs" 
      ADD CONSTRAINT "audit_logs_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    console.log('   ✓ All 14 foreign keys established successfully.');

    // 8. Rebuild indexes
    console.log('8. Ensuring indexes...');
    await client.query(`CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "users_departmentId_idx" ON "users"("departmentId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "users_accountStatus_idx" ON "users"("accountStatus");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "courses_departmentId_idx" ON "courses"("departmentId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "courses_facultyId_idx" ON "courses"("facultyId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "enrollments_studentId_idx" ON "enrollments"("studentId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "enrollments_courseId_idx" ON "enrollments"("courseId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "syllabi_courseId_idx" ON "syllabi"("courseId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "syllabi_departmentId_idx" ON "syllabi"("departmentId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "syllabi_instructorId_idx" ON "syllabi"("instructorId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "syllabi_status_idx" ON "syllabi"("status");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "syllabus_versions_syllabusId_idx" ON "syllabus_versions"("syllabusId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "syllabus_versions_approvalStatus_idx" ON "syllabus_versions"("approvalStatus");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx" ON "audit_logs"("userId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "audit_logs_actionType_idx" ON "audit_logs"("actionType");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "audit_logs_resultStatus_idx" ON "audit_logs"("resultStatus");`);
    console.log('   ✓ Indexes verified.');

    // 9. Notify PostgREST cache reload
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    console.log('   ✓ PostgREST schema cache reloaded.');

    // 10. Summary verification counts
    const deptCount = await client.query(`SELECT COUNT(*) FROM "departments";`);
    const userCount = await client.query(`SELECT COUNT(*) FROM "users";`);
    const courseCount = await client.query(`SELECT COUNT(*) FROM "courses";`);
    const enrollCount = await client.query(`SELECT COUNT(*) FROM "enrollments";`);
    const syllabusCount = await client.query(`SELECT COUNT(*) FROM "syllabi";`);
    const auditCount = await client.query(`SELECT COUNT(*) FROM "audit_logs";`);

    console.log(`\nVerified Table Counts in ${db.name}:`);
    console.log(`   - departments: ${deptCount.rows[0].count}`);
    console.log(`   - users:       ${userCount.rows[0].count}`);
    console.log(`   - courses:     ${courseCount.rows[0].count}`);
    console.log(`   - enrollments: ${enrollCount.rows[0].count}`);
    console.log(`   - syllabi:     ${syllabusCount.rows[0].count}`);
    console.log(`   - audit_logs:  ${auditCount.rows[0].count}`);

    console.log(`✅ SUCCESS: ${db.name} schema organized!`);
  } catch (err) {
    console.error(`❌ ERROR in ${db.name}:`, err);
    throw err;
  } finally {
    await client.end();
  }
}

async function run() {
  for (const db of databases) {
    await organizeDatabase(db);
  }
  console.log('\n================================================================');
  console.log('🎉 ALL DATABASES ORGANIZED AND SYNCHRONIZED SUCCESSFULLY!');
  console.log('================================================================');
}

run().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
