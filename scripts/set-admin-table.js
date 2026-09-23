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

async function configureAdminTable(db) {
  console.log(`\n================================================================`);
  console.log(`Setting base table to "admin": ${db.name}`);
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
    console.log('2. Dropping views...');
    await client.query(`DROP VIEW IF EXISTS "admins" CASCADE;`);
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'admin') THEN
          EXECUTE 'DROP VIEW "admin" CASCADE;';
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'users') THEN
          EXECUTE 'DROP VIEW "users" CASCADE;';
        END IF;
      END $$;
    `);
    console.log('   ✓ Views dropped.');

    // 3. Rename base table "users" to "admin"
    console.log('3. Ensuring base table is named "admin"...');
    const checkTable = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('admin', 'users');
    `);

    const hasBaseAdmin = checkTable.rows.some(r => r.table_name === 'admin' && r.table_type === 'BASE TABLE');
    const hasBaseUsers = checkTable.rows.some(r => r.table_name === 'users' && r.table_type === 'BASE TABLE');

    if (hasBaseUsers && !hasBaseAdmin) {
      await client.query(`ALTER TABLE "users" RENAME TO "admin";`);
      console.log('   ✓ Renamed base table "users" -> "admin".');
    } else if (hasBaseAdmin) {
      console.log('   ✓ Base table "admin" is already in place.');
    } else {
      throw new Error('Neither "users" nor "admin" base table found!');
    }

    // Rename constraint if named users_pkey
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'users_pkey' AND table_name = 'admin') THEN
          ALTER TABLE "admin" RENAME CONSTRAINT "users_pkey" TO "admin_pkey";
        END IF;
      END $$;
    `);

    // 4. Create compatibility view "users" pointing to "admin"
    console.log('4. Creating compatibility view "users" -> "admin"...');
    await client.query(`CREATE OR REPLACE VIEW "users" AS SELECT * FROM "admin";`);
    console.log('   ✓ View "users" created.');

    // 5. Establish all clean relational foreign keys pointing to "admin"("id") and "departments"("id")
    console.log('5. Creating relational foreign keys...');
    
    // admin -> departments
    await client.query(`
      ALTER TABLE "admin" 
      ADD CONSTRAINT "admin_departmentId_fkey" 
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

    // courses -> admin (faculty)
    await client.query(`
      ALTER TABLE "courses" 
      ADD CONSTRAINT "courses_facultyId_fkey" 
      FOREIGN KEY ("facultyId") REFERENCES "admin"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    // enrollments -> admin (student)
    await client.query(`
      ALTER TABLE "enrollments" 
      ADD CONSTRAINT "enrollments_studentId_fkey" 
      FOREIGN KEY ("studentId") REFERENCES "admin"("id") 
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

    // syllabi -> admin (instructor)
    await client.query(`
      ALTER TABLE "syllabi" 
      ADD CONSTRAINT "syllabi_instructorId_fkey" 
      FOREIGN KEY ("instructorId") REFERENCES "admin"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `);

    // syllabi -> departments
    await client.query(`
      ALTER TABLE "syllabi" 
      ADD CONSTRAINT "syllabi_departmentId_fkey" 
      FOREIGN KEY ("departmentId") REFERENCES "departments"("id") 
      ON DELETE RESTRICT ON UPDATE CASCADE;
    `);

    // syllabi -> admin (reviewer)
    await client.query(`
      ALTER TABLE "syllabi" 
      ADD CONSTRAINT "syllabi_reviewedByUserId_fkey" 
      FOREIGN KEY ("reviewedByUserId") REFERENCES "admin"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    // syllabus_versions -> syllabi
    await client.query(`
      ALTER TABLE "syllabus_versions" 
      ADD CONSTRAINT "syllabus_versions_syllabusId_fkey" 
      FOREIGN KEY ("syllabusId") REFERENCES "syllabi"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
    `);

    // syllabus_versions -> admin (editor)
    await client.query(`
      ALTER TABLE "syllabus_versions" 
      ADD CONSTRAINT "syllabus_versions_editorId_fkey" 
      FOREIGN KEY ("editorId") REFERENCES "admin"("id") 
      ON DELETE RESTRICT ON UPDATE CASCADE;
    `);

    // syllabus_versions -> admin (submittedBy)
    await client.query(`
      ALTER TABLE "syllabus_versions" 
      ADD CONSTRAINT "syllabus_versions_submittedById_fkey" 
      FOREIGN KEY ("submittedById") REFERENCES "admin"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    // syllabus_versions -> admin (reviewedBy)
    await client.query(`
      ALTER TABLE "syllabus_versions" 
      ADD CONSTRAINT "syllabus_versions_reviewedById_fkey" 
      FOREIGN KEY ("reviewedById") REFERENCES "admin"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    // audit_logs -> admin
    await client.query(`
      ALTER TABLE "audit_logs" 
      ADD CONSTRAINT "audit_logs_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "admin"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    console.log('   ✓ All 14 foreign keys linked directly to table "admin" and "departments".');

    // 6. Ensure indexes on "admin"
    console.log('6. Ensuring indexes on "admin"...');
    await client.query(`CREATE INDEX IF NOT EXISTS "admin_role_idx" ON "admin"("role");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "admin_departmentId_idx" ON "admin"("departmentId");`);
    await client.query(`CREATE INDEX IF NOT EXISTS "admin_accountStatus_idx" ON "admin"("accountStatus");`);
    console.log('   ✓ Indexes verified.');

    // 7. Notify PostgREST cache reload
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    console.log('   ✓ PostgREST schema cache reloaded.');

    // 8. Summary verification counts
    const deptCount = await client.query(`SELECT COUNT(*) FROM "departments";`);
    const adminTableCount = await client.query(`SELECT COUNT(*) FROM "admin";`);
    const courseCount = await client.query(`SELECT COUNT(*) FROM "courses";`);
    const enrollCount = await client.query(`SELECT COUNT(*) FROM "enrollments";`);
    const syllabusCount = await client.query(`SELECT COUNT(*) FROM "syllabi";`);
    const auditCount = await client.query(`SELECT COUNT(*) FROM "audit_logs";`);

    console.log(`\nVerified Table Counts in ${db.name}:`);
    console.log(`   - departments: ${deptCount.rows[0].count}`);
    console.log(`   - admin:       ${adminTableCount.rows[0].count} (All users)`);
    console.log(`   - courses:     ${courseCount.rows[0].count}`);
    console.log(`   - enrollments: ${enrollCount.rows[0].count}`);
    console.log(`   - syllabi:     ${syllabusCount.rows[0].count}`);
    console.log(`   - audit_logs:  ${auditCount.rows[0].count}`);

    console.log(`✅ SUCCESS: Base table "admin" configured in ${db.name}!`);
  } catch (err) {
    console.error(`❌ ERROR in ${db.name}:`, err);
    throw err;
  } finally {
    await client.end();
  }
}

async function run() {
  for (const db of databases) {
    await configureAdminTable(db);
  }
  console.log('\n================================================================');
  console.log('🎉 BASE TABLE "admin" SUCCESSFULLY CONFIGURED ON ALL DATABASES!');
  console.log('================================================================');
}

run().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
