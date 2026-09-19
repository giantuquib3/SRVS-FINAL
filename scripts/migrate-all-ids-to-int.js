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

async function migrateDatabase(db) {
  console.log(`\n================================================================`);
  console.log(`Migrating All IDs to INTEGER (except departmentId): ${db.name}`);
  console.log(`================================================================`);

  const client = new Client({ connectionString: db.url });
  await client.connect();

  try {
    // 1. Drop existing foreign keys across public schema
    console.log('1. Dropping existing foreign key constraints...');
    const dropFksQuery = `
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
    `;
    await client.query(dropFksQuery);
    console.log('   ✓ All existing foreign keys dropped cleanly.');

    // 2. Backup existing data
    console.log('2. Reading existing records from tables...');
    const usersRes = await client.query(`SELECT * FROM "admin";`);
    const coursesRes = await client.query(`SELECT * FROM "courses";`);
    const enrollmentsRes = await client.query(`SELECT * FROM "enrollments";`);
    console.log(`   ✓ Found ${usersRes.rows.length} users, ${coursesRes.rows.length} courses, ${enrollmentsRes.rows.length} enrollments.`);

    // 3. Recreate admin (users) table with id INTEGER PRIMARY KEY
    console.log('3. Recreating "admin" table with id INTEGER...');
    await client.query(`DROP TABLE IF EXISTS "admin" CASCADE;`);
    await client.query(`
      CREATE TABLE "admin" (
        "id" INTEGER NOT NULL,
        "email" TEXT NOT NULL UNIQUE,
        "passwordHash" TEXT NOT NULL,
        "fullName" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'Student',
        "departmentId" TEXT,
        "academicRank" TEXT,
        "yearLevel" TEXT,
        "accountStatus" TEXT NOT NULL DEFAULT 'Active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "admin_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX "admin_role_idx" ON "admin"("role");
      CREATE INDEX "admin_departmentId_idx" ON "admin"("departmentId");
      CREATE INDEX "admin_accountStatus_idx" ON "admin"("accountStatus");
    `);

    // Insert users converting string IDs ('00000' -> 0, '10001' -> 10001, etc.)
    for (const u of usersRes.rows) {
      const intId = parseInt(u.id, 10);
      const numericId = isNaN(intId) ? 0 : intId;
      await client.query(`
        INSERT INTO "admin" ("id", "email", "passwordHash", "fullName", "role", "departmentId", "academicRank", "yearLevel", "accountStatus", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT ("id") DO NOTHING;
      `, [numericId, u.email, u.passwordHash, u.fullName, u.role, u.departmentId, u.academicRank, u.yearLevel, u.accountStatus, u.createdAt, u.updatedAt]);
    }
    console.log(`   ✓ Migrated ${usersRes.rows.length} users to INTEGER IDs.`);

    // 4. Recreate courses table with id SERIAL PRIMARY KEY (INTEGER), code TEXT UNIQUE, facultyId INTEGER
    console.log('4. Recreating "courses" table with id INTEGER SERIAL...');
    await client.query(`DROP TABLE IF EXISTS "courses" CASCADE;`);
    await client.query(`
      CREATE TABLE "courses" (
        "id" SERIAL NOT NULL,
        "code" TEXT NOT NULL UNIQUE,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "units" INTEGER NOT NULL DEFAULT 3,
        "lecHours" INTEGER NOT NULL DEFAULT 3,
        "labHours" INTEGER NOT NULL DEFAULT 0,
        "prerequisite" TEXT DEFAULT 'None',
        "yearLevel" TEXT DEFAULT '1st Year',
        "semester" TEXT DEFAULT '1st Semester',
        "departmentId" TEXT NOT NULL,
        "facultyName" TEXT,
        "facultyId" INTEGER,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "courses_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "courses_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
      CREATE INDEX "courses_departmentId_idx" ON "courses"("departmentId");
      CREATE INDEX "courses_facultyId_idx" ON "courses"("facultyId");
    `);

    // Insert courses and build code -> int ID map
    const codeToIdMap = new Map();
    for (const c of coursesRes.rows) {
      const facultyIntId = c.facultyId ? parseInt(c.facultyId, 10) : null;
      const res = await client.query(`
        INSERT INTO "courses" ("code", "title", "description", "units", "lecHours", "labHours", "prerequisite", "yearLevel", "semester", "departmentId", "facultyName", "facultyId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING "id", "code";
      `, [c.code, c.title, c.description, c.units || 3, c.lecHours || 3, c.labHours || 0, c.prerequisite, c.yearLevel, c.semester, c.departmentId, c.facultyName, isNaN(facultyIntId) ? null : facultyIntId, c.createdAt, c.updatedAt]);
      
      codeToIdMap.set(res.rows[0].code, res.rows[0].id);
      if (c.id && c.id !== c.code) {
        codeToIdMap.set(c.id, res.rows[0].id);
      }
    }
    console.log(`   ✓ Migrated ${coursesRes.rows.length} courses to INTEGER IDs with facultyId foreign key.`);

    // 5. Recreate enrollments table with studentId INTEGER and courseId INTEGER
    console.log('5. Recreating "enrollments" table with studentId INT and courseId INT...');
    await client.query(`DROP TABLE IF EXISTS "enrollments" CASCADE;`);
    await client.query(`
      CREATE TABLE "enrollments" (
        "studentId" INTEGER NOT NULL,
        "studentName" TEXT NOT NULL,
        "courseId" INTEGER NOT NULL,
        "semester" TEXT NOT NULL DEFAULT '1st Semester',
        "academicYear" TEXT NOT NULL DEFAULT '2026-2027',
        "section" TEXT NOT NULL DEFAULT 'A',
        "status" TEXT NOT NULL DEFAULT 'ENROLLED',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "enrollments_pkey" PRIMARY KEY ("studentId", "courseId"),
        CONSTRAINT "enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "admin"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE INDEX "enrollments_studentId_idx" ON "enrollments"("studentId");
      CREATE INDEX "enrollments_courseId_idx" ON "enrollments"("courseId");
    `);

    // Insert enrollments with resolved integer courseId
    for (const e of enrollmentsRes.rows) {
      const studentIntId = parseInt(e.studentId, 10);
      let targetCourseIntId = typeof e.courseId === 'number' ? e.courseId : codeToIdMap.get(e.courseId);
      if (!targetCourseIntId) {
        // Fallback: look up by code
        const lookup = await client.query(`SELECT id FROM "courses" WHERE code = $1 LIMIT 1;`, [e.courseId]);
        if (lookup.rows.length > 0) targetCourseIntId = lookup.rows[0].id;
      }

      if (!isNaN(studentIntId) && targetCourseIntId) {
        // Guarantee student user exists in admin table before foreign key check
        await client.query(`
          INSERT INTO "admin" ("id", "email", "passwordHash", "fullName", "role", "accountStatus", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, 'Student', 'Active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT ("id") DO NOTHING;
        `, [
          studentIntId,
          `student${studentIntId}@usjr.edu.ph`,
          '$2a$10$0G4oW3f6eHwJpZqT6W5R1.l5s7H1yW1s4Xz9yOq1m7h2F9V4hVf6e',
          e.studentName || `Student ${studentIntId}`,
        ]);

        await client.query(`
          INSERT INTO "enrollments" ("studentId", "studentName", "courseId", "semester", "academicYear", "section", "status", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT ("studentId", "courseId") DO NOTHING;
        `, [studentIntId, e.studentName, targetCourseIntId, e.semester, e.academicYear, e.section, e.status, e.createdAt, e.updatedAt]);
      }
    }
    console.log(`   ✓ Migrated enrollments to INTEGER studentId and INTEGER courseId.`);

    // 6. Recreate syllabi table with id SERIAL (INTEGER), courseId INTEGER, instructorId INTEGER, reviewedByUserId INTEGER
    console.log('6. Recreating "syllabi" table with INTEGER IDs...');
    await client.query(`DROP TABLE IF EXISTS "syllabi" CASCADE;`);
    await client.query(`
      CREATE TABLE "syllabi" (
        "id" SERIAL NOT NULL,
        "courseId" INTEGER NOT NULL,
        "instructorId" INTEGER NOT NULL,
        "departmentId" TEXT NOT NULL,
        "academicYear" TEXT NOT NULL,
        "semester" TEXT NOT NULL,
        "section" TEXT NOT NULL DEFAULT 'A',
        "status" TEXT NOT NULL DEFAULT 'Draft',
        "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
        "reviewerRemarks" TEXT,
        "submittedAt" TIMESTAMP(3),
        "reviewedAt" TIMESTAMP(3),
        "reviewedByUserId" INTEGER,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "syllabi_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "syllabi_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "syllabi_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "admin"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "syllabi_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
      CREATE INDEX "syllabi_courseId_idx" ON "syllabi"("courseId");
      CREATE INDEX "syllabi_instructorId_idx" ON "syllabi"("instructorId");
      CREATE INDEX "syllabi_departmentId_idx" ON "syllabi"("departmentId");
      CREATE INDEX "syllabi_status_idx" ON "syllabi"("status");
    `);

    // 7. Recreate syllabus_versions table with id SERIAL (INTEGER), syllabusId INTEGER, editorId INTEGER, etc.
    console.log('7. Recreating "syllabus_versions" table with INTEGER IDs...');
    await client.query(`DROP TABLE IF EXISTS "syllabus_versions" CASCADE;`);
    await client.query(`
      CREATE TABLE "syllabus_versions" (
        "id" SERIAL NOT NULL,
        "syllabusId" INTEGER NOT NULL,
        "versionNumber" INTEGER NOT NULL,
        "editorId" INTEGER NOT NULL,
        "changeSummary" TEXT NOT NULL DEFAULT 'Initial creation',
        "changeType" TEXT NOT NULL DEFAULT 'Create',
        "statusAtSave" TEXT NOT NULL DEFAULT 'Draft',
        "approvalStatus" TEXT NOT NULL DEFAULT 'Draft',
        "content" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "fileName" TEXT,
        "fileUrl" TEXT,
        "fileType" TEXT,
        "fileSize" INTEGER,
        "submittedById" INTEGER,
        "submittedAt" TIMESTAMP(3),
        "reviewedById" INTEGER,
        "reviewedAt" TIMESTAMP(3),
        "rejectionReason" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "syllabus_versions_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "syllabus_versions_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "syllabi"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "syllabus_versions_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "syllabus_versions_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "syllabus_versions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "syllabus_versions_unique_version" UNIQUE ("syllabusId", "versionNumber")
      );
      CREATE INDEX "syllabus_versions_syllabusId_idx" ON "syllabus_versions"("syllabusId");
      CREATE INDEX "syllabus_versions_approvalStatus_idx" ON "syllabus_versions"("approvalStatus");
    `);

    // 8. Recreate audit_logs table with id SERIAL (INTEGER), userId INTEGER
    console.log('8. Recreating "audit_logs" table with id INTEGER SERIAL and userId INTEGER...');
    await client.query(`DROP TABLE IF EXISTS "audit_logs" CASCADE;`);
    await client.query(`
      CREATE TABLE "audit_logs" (
        "id" SERIAL NOT NULL,
        "userId" INTEGER,
        "userDisplayName" TEXT,
        "actionType" TEXT NOT NULL,
        "resultStatus" TEXT NOT NULL DEFAULT 'Success',
        "description" TEXT NOT NULL,
        "entityType" TEXT,
        "entityId" TEXT,
        "ipAddress" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
      CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
      CREATE INDEX "audit_logs_actionType_idx" ON "audit_logs"("actionType");
    `);

    // 9. Recreate compatibility views
    console.log('9. Recreating compatibility views...');
    await client.query(`
      CREATE OR REPLACE VIEW "users" AS SELECT * FROM "admin";
      CREATE OR REPLACE VIEW "admins" AS SELECT * FROM "admin";
    `);

    // 10. Enable Row Level Security (RLS) on all 6 tables with allow_all policies
    console.log('10. Enabling Row Level Security (RLS) on all tables...');
    const cleanTables = ['admin', 'courses', 'enrollments', 'syllabi', 'syllabus_versions', 'audit_logs'];
    for (const table of cleanTables) {
      await client.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      await client.query(`DROP POLICY IF EXISTS "allow_all" ON "${table}";`);
      await client.query(`CREATE POLICY "allow_all" ON "${table}" FOR ALL USING (true) WITH CHECK (true);`);
    }

    // 11. Grant permissions to Supabase roles
    console.log('11. Granting permissions to Supabase roles...');
    await client.query(`
      GRANT USAGE, CREATE ON SCHEMA public TO postgres, anon, authenticated, service_role, authenticator;
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role, authenticator;
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role, authenticator;
      GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role, authenticator;

      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role, authenticator;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role, authenticator;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role, authenticator;
    `);

    // 12. Reload PostgREST schema cache
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    console.log('   ✓ PostgREST schema reloaded.');
    console.log(`✅ Successfully completed migration for ${db.name}`);
  } finally {
    await client.end();
  }
}

(async () => {
  try {
    for (const db of databases) {
      await migrateDatabase(db);
    }
    console.log('\n🎉 ALL DATABASES MIGRATED TO INTEGER IDs (EXCEPT departmentId)!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
})();
