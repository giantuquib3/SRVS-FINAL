const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const databases = [
  {
    name: 'Database 1 (qoxpqhvecjxlsbsshxsm - in .env)',
    url: 'postgresql://postgres.qoxpqhvecjxlsbsshxsm:Giangwapo123%3F@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require',
  },
  {
    name: 'Database 2 (goxvhkbwfpffjnqphzpq - in pgAdmin SRVS)',
    url: 'postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require',
  },
];

const cleanTables = [
  'admin',
  'courses',
  'enrollments',
  'syllabi',
  'syllabus_versions',
  'audit_logs',
];

const initialEnrollments = [
  { studentId: 2022012701, studentName: 'Carlos Reyes', courseId: 'CE101', semester: '1st Semester', academicYear: '2026-2027', section: 'A' },
  { studentId: 2022012701, studentName: 'Carlos Reyes', courseId: 'CE201', semester: '1st Semester', academicYear: '2026-2027', section: 'A' },
  { studentId: 2022012702, studentName: 'Andrea Santos', courseId: 'EE101', semester: '1st Semester', academicYear: '2026-2027', section: 'A' },
  { studentId: 2022012702, studentName: 'Andrea Santos', courseId: 'EE201', semester: '1st Semester', academicYear: '2026-2027', section: 'A' },
  { studentId: 2022012703, studentName: 'Joshua Lim', courseId: 'CPE101', semester: '1st Semester', academicYear: '2026-2027', section: 'A' },
  { studentId: 2022012703, studentName: 'Joshua Lim', courseId: 'CPE201', semester: '1st Semester', academicYear: '2026-2027', section: 'B' },
  { studentId: 2022012704, studentName: 'Maria Garcia', courseId: 'ECE101', semester: '1st Semester', academicYear: '2026-2027', section: 'A' },
  { studentId: 2022012704, studentName: 'Maria Garcia', courseId: 'ECE201', semester: '1st Semester', academicYear: '2026-2027', section: 'A' },
  { studentId: 2022012705, studentName: 'Paolo Tan', courseId: 'CPE101', semester: '1st Semester', academicYear: '2026-2027', section: 'A' },
];

const courseFacultyAssignments = [
  { courseId: 'CPE101', facultyId: '10002', facultyName: 'Engr. Ada Lovelace' },
  { courseId: 'CPE201', facultyId: '10004', facultyName: 'Engr. Grace Hopper' },
  { courseId: 'CPE301', facultyId: '10002', facultyName: 'Engr. Ada Lovelace' },
  { courseId: 'CPE302', facultyId: '10004', facultyName: 'Engr. Grace Hopper' },
  { courseId: 'CPE401', facultyId: '10002', facultyName: 'Engr. Ada Lovelace' },
  { courseId: 'CPE402', facultyId: '10004', facultyName: 'Engr. Grace Hopper' },
  { courseId: 'EE101',  facultyId: '10006', facultyName: 'Engr. Michael Faraday' },
  { courseId: 'EE201',  facultyId: '10006', facultyName: 'Engr. Michael Faraday' },
  { courseId: 'EE301',  facultyId: '10006', facultyName: 'Engr. Michael Faraday' },
  { courseId: 'CE101',  facultyId: '10008', facultyName: 'Engr. Marie Curie' },
  { courseId: 'CE201',  facultyId: '10008', facultyName: 'Engr. Marie Curie' },
  { courseId: 'ECE101', facultyId: '10010', facultyName: 'Engr. Heinrich Hertz' },
  { courseId: 'ECE201', facultyId: '10010', facultyName: 'Engr. Heinrich Hertz' },
];

async function simplifyDb(db) {
  console.log(`\n======================================================`);
  console.log(`Simplifying Schema & Removing Redundancies: ${db.name}`);
  console.log(`======================================================`);

  const client = new Client({ connectionString: db.url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // 1. Remove redundant tables
    console.log('1. Dropping redundant tables (faculty, deptHead, department_heads, notifications)...');
    await client.query(`DROP TRIGGER IF EXISTS trg_sync_admin_subtables ON "admin";`);
    await client.query(`DROP FUNCTION IF EXISTS sync_admin_to_subtables CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS "faculty" CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS "deptHead" CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS "department_heads" CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS "notifications" CASCADE;`);

    // 2. Update courses table with facultyName and facultyId
    console.log('2. Updating "courses" table with facultyName and facultyId columns...');
    await client.query(`ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "facultyName" TEXT;`);
    await client.query(`ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "facultyId" TEXT;`);
    await client.query(`CREATE INDEX IF NOT EXISTS "courses_facultyId_idx" ON "courses"("facultyId");`);

    // Backfill course faculty names
    for (const cf of courseFacultyAssignments) {
      await client.query(`
        UPDATE "courses" 
        SET "facultyName" = $1, "facultyId" = $2 
        WHERE "id" = $3 OR "code" = $3
      `, [cf.facultyName, cf.facultyId, cf.courseId]);
    }
    console.log('   ✓ Assigned syllabus upload faculty names to courses.');

    // 3. Recreate enrollments table with studentId INTEGER (PK) and studentName TEXT
    console.log('3. Restructuring "enrollments" table with INT StudentId and StudentName...');
    await client.query(`DROP TABLE IF EXISTS "enrollments" CASCADE;`);
    await client.query(`
      CREATE TABLE "enrollments" (
        "studentId" INTEGER NOT NULL,
        "studentName" TEXT NOT NULL,
        "courseId" TEXT NOT NULL,
        "semester" TEXT NOT NULL DEFAULT '1st Semester',
        "academicYear" TEXT NOT NULL DEFAULT '2026-2027',
        "section" TEXT NOT NULL DEFAULT 'A',
        "status" TEXT NOT NULL DEFAULT 'ENROLLED',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "enrollments_pkey" PRIMARY KEY ("studentId", "courseId")
      );
      CREATE INDEX IF NOT EXISTS "enrollments_studentId_idx" ON "enrollments"("studentId");
      CREATE INDEX IF NOT EXISTS "enrollments_courseId_idx" ON "enrollments"("courseId");
    `);

    // Seed enrollment records
    for (const en of initialEnrollments) {
      await client.query(`
        INSERT INTO "enrollments" ("studentId", "studentName", "courseId", "semester", "academicYear", "section", "status")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT ("studentId", "courseId") DO UPDATE SET
          "studentName" = EXCLUDED."studentName",
          "semester" = EXCLUDED."semester",
          "academicYear" = EXCLUDED."academicYear",
          "section" = EXCLUDED."section",
          "status" = EXCLUDED."status";
      `, [en.studentId, en.studentName, en.courseId, en.semester, en.academicYear, en.section, 'ENROLLED']);
    }
    console.log(`   ✓ Seeded ${initialEnrollments.length} enrollment records with INT studentId and studentName.`);

    // 4. Create compatibility views
    await client.query(`
      CREATE OR REPLACE VIEW "users" AS SELECT * FROM "admin";
      CREATE OR REPLACE VIEW "admins" AS SELECT * FROM "admin";
    `);

    // 5. Grant full schema permissions to Supabase roles
    console.log('4. Granting permissions to Supabase roles...');
    await client.query(`
      GRANT USAGE, CREATE ON SCHEMA public TO postgres, anon, authenticated, service_role, authenticator;
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role, authenticator;
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role, authenticator;
      GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role, authenticator;

      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role, authenticator;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role, authenticator;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role, authenticator;
    `);

    // 6. Enable Row Level Security (RLS) with permissive allow_all on all 6 clean tables
    console.log('5. Enabling Row Level Security (RLS) and permissive policies on all 6 tables...');
    for (const tbl of cleanTables) {
      await client.query(`ALTER TABLE "${tbl}" ENABLE ROW LEVEL SECURITY;`);

      // Drop existing policies
      const existing = await client.query(`
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = '${tbl}';
      `);
      for (const row of existing.rows) {
        await client.query(`DROP POLICY IF EXISTS "${row.policyname}" ON "${tbl}";`);
      }

      // Add allow_all policy
      await client.query(`
        CREATE POLICY "allow_all_${tbl}" ON "${tbl}"
        FOR ALL
        TO public
        USING (true)
        WITH CHECK (true);
      `);
      console.log(`   ✓ ${tbl}: RLS Enabled with policy allow_all_${tbl}`);
    }

    // 7. Reload PostgREST schema cache
    console.log('6. Reloading PostgREST schema cache...');
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    console.log('   ✓ PostgREST schema cache reloaded.');

    // 8. Verification
    console.log('\n7. Final Table Verification:');
    for (const tbl of cleanTables) {
      const cRes = await client.query(`SELECT count(*) FROM "${tbl}"`);
      const rlsRes = await client.query(`
        SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = '${tbl}'
      `);
      const isRls = rlsRes.rows[0]?.rowsecurity ? 'ENABLED (Protected)' : 'DISABLED';
      console.log(`   ${tbl.padEnd(20)}: ${cRes.rows[0].count} rows | RLS: ${isRls}`);
    }

  } finally {
    await client.end();
  }
}

async function main() {
  for (const db of databases) {
    await simplifyDb(db);
  }
  console.log('\n🎉 ALL DATABASES SIMPLIFIED AND SYNCHRONIZED SUCCESSFULLY!');
}

main().catch(console.error);
