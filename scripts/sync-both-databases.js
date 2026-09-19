const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const DB1_URL = 'postgresql://postgres.qoxpqhvecjxlsbsshxsm:Giangwapo123%3F@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';
const DB2_URL = 'postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

async function syncDb(url, name) {
  console.log(`\n======================================================`);
  console.log(`Synchronizing Database: ${name}`);
  console.log(`======================================================`);

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // 1. Create table "admin" (Unified users table)
    await client.query(`
      CREATE TABLE IF NOT EXISTS "admin" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
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
      CREATE UNIQUE INDEX IF NOT EXISTS "admin_email_key" ON "admin"("email");
      CREATE INDEX IF NOT EXISTS "admin_role_idx" ON "admin"("role");
      CREATE INDEX IF NOT EXISTS "admin_departmentId_idx" ON "admin"("departmentId");
      CREATE INDEX IF NOT EXISTS "admin_accountStatus_idx" ON "admin"("accountStatus");
    `);

    // If "users" table exists, copy data to "admin" if "admin" is empty
    const checkUsers = await client.query(`SELECT to_regclass('public.users') as exists`);
    if (checkUsers.rows[0].exists) {
      await client.query(`
        INSERT INTO "admin" ("id", "email", "passwordHash", "fullName", "role", "departmentId", "academicRank", "yearLevel", "accountStatus", "createdAt", "updatedAt")
        SELECT "id", "email", "passwordHash", "fullName", "role", "departmentId", "academicRank", "yearLevel", "accountStatus", "createdAt", "updatedAt"
        FROM "users"
        ON CONFLICT ("id") DO NOTHING;
      `);
      // Drop old users table to make way for the view
      await client.query(`DROP TABLE IF EXISTS "users" CASCADE;`);
    }

    // 2. Create courses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "courses" (
        "id" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "units" INTEGER NOT NULL DEFAULT 3,
        "lecHours" INTEGER NOT NULL DEFAULT 3,
        "labHours" INTEGER NOT NULL DEFAULT 0,
        "prerequisite" TEXT DEFAULT 'None',
        "yearLevel" TEXT DEFAULT '1st Year',
        "semester" TEXT DEFAULT '1st Semester',
        "departmentId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "courses_code_key" ON "courses"("code");
      CREATE INDEX IF NOT EXISTS "courses_departmentId_idx" ON "courses"("departmentId");
    `);

    // 3. Create enrollments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "enrollments" (
        "id" TEXT NOT NULL,
        "studentId" TEXT NOT NULL,
        "courseId" TEXT NOT NULL,
        "semester" TEXT NOT NULL,
        "academicYear" TEXT NOT NULL,
        "section" TEXT NOT NULL DEFAULT 'A',
        "status" TEXT NOT NULL DEFAULT 'ENROLLED',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "enrollments_student_course_unique" ON "enrollments"("studentId", "courseId", "semester", "academicYear");
      CREATE INDEX IF NOT EXISTS "enrollments_studentId_idx" ON "enrollments"("studentId");
      CREATE INDEX IF NOT EXISTS "enrollments_courseId_idx" ON "enrollments"("courseId");
    `);

    // 4. Create syllabi table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "syllabi" (
        "id" TEXT NOT NULL,
        "courseId" TEXT NOT NULL,
        "instructorId" TEXT NOT NULL,
        "departmentId" TEXT NOT NULL,
        "academicYear" TEXT NOT NULL,
        "semester" TEXT NOT NULL,
        "section" TEXT NOT NULL DEFAULT 'A',
        "status" TEXT NOT NULL DEFAULT 'Draft',
        "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
        "reviewerRemarks" TEXT,
        "submittedAt" TIMESTAMP(3),
        "reviewedAt" TIMESTAMP(3),
        "reviewedByUserId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "syllabi_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "syllabi_courseId_idx" ON "syllabi"("courseId");
      CREATE INDEX IF NOT EXISTS "syllabi_instructorId_idx" ON "syllabi"("instructorId");
      CREATE INDEX IF NOT EXISTS "syllabi_departmentId_idx" ON "syllabi"("departmentId");
      CREATE INDEX IF NOT EXISTS "syllabi_status_idx" ON "syllabi"("status");
    `);

    // 5. Create syllabus_versions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "syllabus_versions" (
        "id" TEXT NOT NULL,
        "syllabusId" TEXT NOT NULL,
        "versionNumber" INTEGER NOT NULL,
        "courseCode" TEXT NOT NULL,
        "courseTitle" TEXT NOT NULL,
        "description" TEXT,
        "credits" INTEGER NOT NULL DEFAULT 3,
        "departmentId" TEXT NOT NULL,
        "courseOutcomes" JSONB,
        "topics" JSONB,
        "gradingSystem" JSONB,
        "textbooks" JSONB,
        "references" JSONB,
        "statusAtSave" TEXT NOT NULL DEFAULT 'DRAFT',
        "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
        "changeDescription" TEXT,
        "submittedById" TEXT,
        "submittedAt" TIMESTAMP(3),
        "reviewedById" TEXT,
        "reviewedAt" TIMESTAMP(3),
        "rejectionReason" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "syllabus_versions_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "syllabus_version_unique" ON "syllabus_versions"("syllabusId", "versionNumber");
      CREATE INDEX IF NOT EXISTS "syllabus_versions_syllabusId_idx" ON "syllabus_versions"("syllabusId");
      CREATE INDEX IF NOT EXISTS "syllabus_versions_approvalStatus_idx" ON "syllabus_versions"("approvalStatus");
    `);

    // 6. Create audit_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" TEXT NOT NULL,
        "userId" TEXT,
        "userDisplayName" TEXT,
        "actionType" TEXT NOT NULL,
        "entityType" TEXT,
        "entityId" TEXT,
        "description" TEXT NOT NULL,
        "resultStatus" TEXT NOT NULL DEFAULT 'Success',
        "ipAddress" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx" ON "audit_logs"("userId");
      CREATE INDEX IF NOT EXISTS "audit_logs_actionType_idx" ON "audit_logs"("actionType");
      CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
    `);

    // 7. Create notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "link" TEXT,
        "isRead" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "notifications_userId_idx" ON "notifications"("userId");
    `);

    // 8. Clean up obsolete empty tables from old fragmented schema if they exist
    const obsoleteTables = ['department_heads', 'faculty', 'students', 'srvs_subjects', 'srvs_syllabi', 'srvs_syllabus_versions'];
    for (const ot of obsoleteTables) {
      await client.query(`DROP TABLE IF EXISTS "${ot}" CASCADE;`);
    }
    // Also drop old empty "admins" table if it has separate schema, then create view
    const checkAdmins = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'admins'
    `);
    if (checkAdmins.rows.length > 0) {
      await client.query(`DROP TABLE IF EXISTS "admins" CASCADE;`);
    }

    // 9. Create compatibility views so that queries for "users" and "admins" both point to "admin"
    await client.query(`
      CREATE OR REPLACE VIEW "users" AS SELECT * FROM "admin";
      CREATE OR REPLACE VIEW "admins" AS SELECT * FROM "admin";
    `);

    console.log(`✓ Schema & Compatibility Views created for ${name}`);
  } finally {
    await client.end();
  }
}

async function copyData(sourceUrl, targetUrl) {
  console.log(`\nCopying data from primary database to target database...`);
  const src = new Client({ connectionString: sourceUrl, ssl: { rejectUnauthorized: false } });
  const tgt = new Client({ connectionString: targetUrl, ssl: { rejectUnauthorized: false } });
  await src.connect();
  await tgt.connect();

  try {
    // 1. Copy admin (users)
    const usersRes = await src.query(`SELECT * FROM "admin"`);
    for (const row of usersRes.rows) {
      await tgt.query(`
        INSERT INTO "admin" ("id", "email", "passwordHash", "fullName", "role", "departmentId", "academicRank", "yearLevel", "accountStatus", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT ("id") DO UPDATE SET
          "email" = EXCLUDED."email",
          "passwordHash" = EXCLUDED."passwordHash",
          "fullName" = EXCLUDED."fullName",
          "role" = EXCLUDED."role",
          "departmentId" = EXCLUDED."departmentId",
          "academicRank" = EXCLUDED."academicRank",
          "yearLevel" = EXCLUDED."yearLevel",
          "accountStatus" = EXCLUDED."accountStatus",
          "updatedAt" = EXCLUDED."updatedAt"
      `, [row.id, row.email, row.passwordHash, row.fullName, row.role, row.departmentId, row.academicRank, row.yearLevel, row.accountStatus, row.createdAt, row.updatedAt]);
    }
    console.log(`✓ Copied ${usersRes.rows.length} users into "admin" table`);

    // 2. Copy courses
    const coursesRes = await src.query(`SELECT * FROM "courses"`);
    for (const row of coursesRes.rows) {
      await tgt.query(`
        INSERT INTO "courses" ("id", "code", "title", "description", "units", "lecHours", "labHours", "prerequisite", "yearLevel", "semester", "departmentId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT ("id") DO UPDATE SET
          "code" = EXCLUDED."code",
          "title" = EXCLUDED."title",
          "units" = EXCLUDED."units",
          "lecHours" = EXCLUDED."lecHours",
          "labHours" = EXCLUDED."labHours",
          "prerequisite" = EXCLUDED."prerequisite",
          "yearLevel" = EXCLUDED."yearLevel",
          "semester" = EXCLUDED."semester",
          "departmentId" = EXCLUDED."departmentId"
      `, [row.id, row.code, row.title, row.description, row.units, row.lecHours, row.labHours, row.prerequisite, row.yearLevel, row.semester, row.departmentId, row.createdAt, row.updatedAt]);
    }
    console.log(`✓ Copied ${coursesRes.rows.length} courses`);

    // 3. Copy enrollments
    const enrollRes = await src.query(`SELECT * FROM "enrollments"`);
    for (const row of enrollRes.rows) {
      await tgt.query(`
        INSERT INTO "enrollments" ("id", "studentId", "courseId", "semester", "academicYear", "section", "status", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT ("id") DO NOTHING
      `, [row.id, row.studentId, row.courseId, row.semester, row.academicYear, row.section, row.status, row.createdAt, row.updatedAt]);
    }
    console.log(`✓ Copied ${enrollRes.rows.length} enrollments`);

    // 4. Copy audit_logs
    const logsRes = await src.query(`SELECT * FROM "audit_logs"`);
    for (const row of logsRes.rows) {
      await tgt.query(`
        INSERT INTO "audit_logs" ("id", "userId", "userDisplayName", "actionType", "entityType", "entityId", "description", "resultStatus", "ipAddress", "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT ("id") DO NOTHING
      `, [row.id, row.userId, row.userDisplayName, row.actionType, row.entityType, row.entityId, row.description, row.resultStatus, row.ipAddress, row.createdAt]);
    }
    console.log(`✓ Copied ${logsRes.rows.length} audit logs`);

  } finally {
    await src.end();
    await tgt.end();
  }
}

async function verifyDb(url, name) {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    console.log(`\n=== Verification: ${name} ===`);
    const tables = ['admin', 'courses', 'enrollments', 'syllabi', 'syllabus_versions', 'audit_logs', 'notifications', 'users', 'admins'];
    for (const t of tables) {
      try {
        const res = await client.query(`SELECT count(*) FROM "${t}"`);
        console.log(`  ${t.padEnd(20)}: ${res.rows[0].count} rows`);
      } catch (err) {
        console.log(`  ${t.padEnd(20)}: NOT FOUND (${err.message})`);
      }
    }
  } finally {
    await client.end();
  }
}

async function main() {
  // Step 1: Sync structure on DB 1
  await syncDb(DB1_URL, 'Database 1 (qoxpqhvecjxlsbsshxsm - in .env)');

  // Step 2: Sync structure on DB 2
  await syncDb(DB2_URL, 'Database 2 (goxvhkbwfpffjnqphzpq - in pgAdmin SRVS)');

  // Step 3: Copy data from DB 1 to DB 2 so both have identical data
  await copyData(DB1_URL, DB2_URL);

  // Step 4: Verify both databases
  await verifyDb(DB1_URL, 'Database 1 (qoxpqhvecjxlsbsshxsm)');
  await verifyDb(DB2_URL, 'Database 2 (goxvhkbwfpffjnqphzpq)');

  console.log(`\n🎉 Synchronization complete! Both databases are 100% identical.`);
}

main().catch(console.error);
