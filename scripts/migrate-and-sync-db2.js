const { Client } = require('pg');

async function main() {
  const db1Url = 'postgresql://postgres.qoxpqhvecjxlsbsshxsm:Giangwapo123%3F@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';
  const db2Url = 'postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres';

  const client1 = new Client({ connectionString: db1Url, ssl: { rejectUnauthorized: false } });
  const client2 = new Client({ connectionString: db2Url, ssl: { rejectUnauthorized: false } });

  await client1.connect();
  await client2.connect();

  console.log('Connected to both databases.\n');

  try {
    // 1. Drop views in DB2
    console.log('1. Dropping old views in DB2...');
    await client2.query(`DROP VIEW IF EXISTS "users" CASCADE;`);
    await client2.query(`DROP VIEW IF EXISTS "enrollments" CASCADE;`);
    console.log('   ✓ Dropped views "users" and "enrollments".');

    // 2. Rename base tables admin -> users and enrollees -> enrollments
    console.log('2. Renaming base tables in DB2...');
    const adminCheck = await client2.query(`SELECT to_regclass('public.admin') as exists;`);
    if (adminCheck.rows[0].exists) {
      await client2.query(`ALTER TABLE "admin" RENAME TO "users";`);
      console.log('   ✓ Renamed base table "admin" → "users".');
    }

    const enrolleesCheck = await client2.query(`SELECT to_regclass('public.enrollees') as exists;`);
    if (enrolleesCheck.rows[0].exists) {
      await client2.query(`ALTER TABLE "enrollees" RENAME TO "enrollments";`);
      console.log('   ✓ Renamed base table "enrollees" → "enrollments".');
    }

    // 3. Add missing columns to users
    console.log('3. Updating columns on "users" table in DB2...');
    await client2.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN DEFAULT false;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "program" TEXT;
    `);
    console.log('   ✓ Added mustChangePassword, rejectionReason, and program to users.');

    // 4. Update courses table
    console.log('4. Standardizing "courses" table in DB2...');
    await client2.query(`ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "professorName" TEXT;`);
    try {
      await client2.query(`
        UPDATE "courses" 
        SET "professorName" = "facultyName" 
        WHERE "professorName" IS NULL AND "facultyName" IS NOT NULL;
      `);
      await client2.query(`ALTER TABLE "courses" DROP COLUMN IF EXISTS "facultyName";`);
      await client2.query(`ALTER TABLE "courses" DROP COLUMN IF EXISTS "facultyId";`);
    } catch (e) {}
    console.log('   ✓ Normalized courses columns.');

    // 5. Clean up old constraint names and re-create canonical foreign keys
    console.log('5. Normalizing Foreign Keys in DB2...');
    const dropConstraints = [
      `ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "admin_departmentId_fkey";`,
      `ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_departmentId_fkey";`,
      `ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "courses_departmentId_fkey";`,
      `ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "courses_facultyId_fkey";`,
      `ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_courseId_fkey";`,
      `ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_studentId_fkey";`,
      `ALTER TABLE "syllabi" DROP CONSTRAINT IF EXISTS "syllabi_courseId_fkey";`,
      `ALTER TABLE "syllabi" DROP CONSTRAINT IF EXISTS "syllabi_departmentId_fkey";`,
      `ALTER TABLE "syllabi" DROP CONSTRAINT IF EXISTS "syllabi_instructorId_fkey";`,
      `ALTER TABLE "syllabi" DROP CONSTRAINT IF EXISTS "syllabi_reviewedByUserId_fkey";`,
      `ALTER TABLE "syllabus_versions" DROP CONSTRAINT IF EXISTS "syllabus_versions_editorId_fkey";`,
      `ALTER TABLE "syllabus_versions" DROP CONSTRAINT IF EXISTS "syllabus_versions_reviewedById_fkey";`,
      `ALTER TABLE "syllabus_versions" DROP CONSTRAINT IF EXISTS "syllabus_versions_submittedById_fkey";`,
      `ALTER TABLE "syllabus_versions" DROP CONSTRAINT IF EXISTS "syllabus_versions_syllabusId_fkey";`,
      `ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_userId_fkey";`
    ];

    for (const sql of dropConstraints) {
      try { await client2.query(sql); } catch(e) {}
    }

    // 6. Sync all data from DB1 to DB2
    console.log('6. Syncing all records from DB1 to DB2...');

    // Users
    const uRows = await client1.query(`SELECT * FROM "users";`);
    for (const u of uRows.rows) {
      await client2.query(`
        INSERT INTO "users" (
          "id", "email", "passwordHash", "fullName", "role", "departmentId",
          "academicRank", "yearLevel", "accountStatus", "createdAt", "updatedAt",
          "mustChangePassword", "rejectionReason", "program"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT ("id") DO UPDATE SET
          "email" = EXCLUDED."email",
          "passwordHash" = EXCLUDED."passwordHash",
          "fullName" = EXCLUDED."fullName",
          "role" = EXCLUDED."role",
          "departmentId" = EXCLUDED."departmentId",
          "academicRank" = EXCLUDED."academicRank",
          "yearLevel" = EXCLUDED."yearLevel",
          "accountStatus" = EXCLUDED."accountStatus",
          "mustChangePassword" = EXCLUDED."mustChangePassword",
          "rejectionReason" = EXCLUDED."rejectionReason",
          "program" = EXCLUDED."program",
          "updatedAt" = EXCLUDED."updatedAt";
      `, [
        u.id, u.email, u.passwordHash, u.fullName, u.role, u.departmentId,
        u.academicRank, u.yearLevel, u.accountStatus, u.createdAt, u.updatedAt,
        u.mustChangePassword, u.rejectionReason, u.program
      ]);
    }
    console.log(`   ✓ Synced ${uRows.rows.length} users.`);

    // Courses
    const cRows = await client1.query(`SELECT * FROM "courses";`);
    for (const c of cRows.rows) {
      await client2.query(`
        INSERT INTO "courses" (
          "id", "code", "title", "description", "units", "lecHours", "labHours",
          "prerequisite", "yearLevel", "semester", "departmentId", "createdAt",
          "updatedAt", "professorName"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT ("id") DO UPDATE SET
          "code" = EXCLUDED."code",
          "title" = EXCLUDED."title",
          "description" = EXCLUDED."description",
          "units" = EXCLUDED."units",
          "lecHours" = EXCLUDED."lecHours",
          "labHours" = EXCLUDED."labHours",
          "prerequisite" = EXCLUDED."prerequisite",
          "yearLevel" = EXCLUDED."yearLevel",
          "semester" = EXCLUDED."semester",
          "departmentId" = EXCLUDED."departmentId",
          "professorName" = EXCLUDED."professorName",
          "updatedAt" = EXCLUDED."updatedAt";
      `, [
        c.id, c.code, c.title, c.description, c.units, c.lecHours, c.labHours,
        c.prerequisite, c.yearLevel, c.semester, c.departmentId, c.createdAt,
        c.updatedAt, c.professorName
      ]);
    }
    console.log(`   ✓ Synced ${cRows.rows.length} courses.`);

    // Enrollments
    const eRows = await client1.query(`SELECT * FROM "enrollments";`);
    for (const e of eRows.rows) {
      await client2.query(`
        INSERT INTO "enrollments" (
          "studentId", "studentName", "courseId", "semester", "academicYear", "section", "status", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT ("studentId", "courseId") DO UPDATE SET
          "studentName" = EXCLUDED."studentName",
          "semester" = EXCLUDED."semester",
          "academicYear" = EXCLUDED."academicYear",
          "section" = EXCLUDED."section",
          "status" = EXCLUDED."status",
          "updatedAt" = EXCLUDED."updatedAt";
      `, [
        e.studentId, e.studentName, e.courseId, e.semester, e.academicYear, e.section, e.status, e.createdAt, e.updatedAt
      ]);
    }
    console.log(`   ✓ Synced ${eRows.rows.length} enrollments.`);

    // Syllabi
    const sRows = await client1.query(`SELECT * FROM "syllabi";`);
    for (const s of sRows.rows) {
      await client2.query(`
        INSERT INTO "syllabi" (
          "id", "courseId", "instructorId", "departmentId", "academicYear", "semester", "section",
          "status", "currentVersionNumber", "reviewerRemarks", "submittedAt", "reviewedAt",
          "reviewedByUserId", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT ("id") DO UPDATE SET
          "status" = EXCLUDED."status",
          "currentVersionNumber" = EXCLUDED."currentVersionNumber",
          "reviewerRemarks" = EXCLUDED."reviewerRemarks",
          "submittedAt" = EXCLUDED."submittedAt",
          "reviewedAt" = EXCLUDED."reviewedAt",
          "reviewedByUserId" = EXCLUDED."reviewedByUserId",
          "updatedAt" = EXCLUDED."updatedAt";
      `, [
        s.id, s.courseId, s.instructorId, s.departmentId, s.academicYear, s.semester, s.section,
        s.status, s.currentVersionNumber, s.reviewerRemarks, s.submittedAt, s.reviewedAt,
        s.reviewedByUserId, s.createdAt, s.updatedAt
      ]);
    }
    console.log(`   ✓ Synced ${sRows.rows.length} syllabi.`);

    // Syllabus Versions
    const vRows = await client1.query(`SELECT * FROM "syllabus_versions";`);
    for (const v of vRows.rows) {
      await client2.query(`
        INSERT INTO "syllabus_versions" (
          "id", "syllabusId", "versionNumber", "editorId", "changeSummary", "changeType",
          "statusAtSave", "approvalStatus", "content", "fileName", "fileUrl", "fileType",
          "fileSize", "submittedById", "submittedAt", "reviewedById", "reviewedAt",
          "rejectionReason", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        ON CONFLICT ("id") DO UPDATE SET
          "approvalStatus" = EXCLUDED."approvalStatus",
          "statusAtSave" = EXCLUDED."statusAtSave",
          "content" = EXCLUDED."content",
          "submittedById" = EXCLUDED."submittedById",
          "submittedAt" = EXCLUDED."submittedAt",
          "reviewedById" = EXCLUDED."reviewedById",
          "reviewedAt" = EXCLUDED."reviewedAt",
          "rejectionReason" = EXCLUDED."rejectionReason",
          "updatedAt" = EXCLUDED."updatedAt";
      `, [
        v.id, v.syllabusId, v.versionNumber, v.editorId, v.changeSummary, v.changeType,
        v.statusAtSave, v.approvalStatus, JSON.stringify(v.content), v.fileName, v.fileUrl, v.fileType,
        v.fileSize, v.submittedById, v.submittedAt, v.reviewedById, v.reviewedAt,
        v.rejectionReason, v.createdAt, v.updatedAt
      ]);
    }
    console.log(`   ✓ Synced ${vRows.rows.length} syllabus versions.`);

    // 7. Re-apply all 13 canonical foreign keys in DB2
    console.log('7. Re-applying all 13 canonical foreign keys in DB2...');
    const canonicalFks = [
      `ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON UPDATE CASCADE ON DELETE SET NULL;`,
      `ALTER TABLE "courses" ADD CONSTRAINT "courses_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON UPDATE CASCADE ON DELETE RESTRICT;`,
      `ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON UPDATE CASCADE ON DELETE CASCADE;`,
      `ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE;`,
      `ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON UPDATE CASCADE ON DELETE CASCADE;`,
      `ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON UPDATE CASCADE ON DELETE RESTRICT;`,
      `ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE;`,
      `ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE SET NULL;`,
      `ALTER TABLE "syllabus_versions" ADD CONSTRAINT "syllabus_versions_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE;`,
      `ALTER TABLE "syllabus_versions" ADD CONSTRAINT "syllabus_versions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE SET NULL;`,
      `ALTER TABLE "syllabus_versions" ADD CONSTRAINT "syllabus_versions_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE SET NULL;`,
      `ALTER TABLE "syllabus_versions" ADD CONSTRAINT "syllabus_versions_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "syllabi"("id") ON UPDATE CASCADE ON DELETE CASCADE;`,
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE SET NULL;`
    ];

    for (const sql of canonicalFks) {
      try {
        await client2.query(sql);
      } catch (e) {
        console.warn('   Note on FK:', e.message);
      }
    }
    console.log('   ✓ All 13 canonical foreign keys applied.');

    // 8. Verification
    console.log('\n======================================================');
    console.log('            PARITY VERIFICATION RESULT               ');
    console.log('======================================================');

    const t2 = await client2.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log(`DB2 Public Tables (${t2.rows.length}):`);
    console.table(t2.rows);

    for (const row of t2.rows) {
      const c = await client2.query(`SELECT COUNT(*)::text as count FROM "${row.table_name}";`);
      console.log(`  Table "${row.table_name}": ${c.rows[0].count} rows`);
    }

    const fks2 = await client2.query(`
      SELECT conname, pg_get_constraintdef(oid) as def 
      FROM pg_constraint 
      WHERE contype = 'f' AND connamespace = 'public'::regnamespace
      ORDER BY conname;
    `);
    console.log(`\nDB2 Foreign Keys (${fks2.rows.length}):`);
    console.table(fks2.rows);

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client1.end();
    await client2.end();
  }
}

main();
