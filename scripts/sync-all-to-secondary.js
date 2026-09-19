const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const primaryUrl = 'postgresql://postgres.qoxpqhvecjxlsbsshxsm:Giangwapo123%3F@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';
const secondaryUrl = 'postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require';

async function sync() {
  const primary = new Client({ connectionString: primaryUrl });
  const secondary = new Client({ connectionString: secondaryUrl });
  await primary.connect();
  await secondary.connect();

  console.log('🔄 Syncing Primary -> Secondary across 6 core tables...');

  // Sync admin
  const adminRows = (await primary.query('SELECT * FROM "admin" ORDER BY id ASC')).rows;
  for (const r of adminRows) {
    await secondary.query(`
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
    `, [r.id, r.email, r.passwordHash, r.fullName, r.role, r.departmentId, r.academicRank, r.yearLevel, r.accountStatus, r.createdAt, r.updatedAt]);
  }

  // Sync courses
  const courseRows = (await primary.query('SELECT * FROM "courses" ORDER BY id ASC')).rows;
  for (const r of courseRows) {
    await secondary.query(`
      INSERT INTO "courses" ("id", "code", "title", "description", "units", "lecHours", "labHours", "prerequisite", "yearLevel", "semester", "departmentId", "facultyName", "facultyId", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
        "facultyName" = EXCLUDED."facultyName",
        "facultyId" = EXCLUDED."facultyId",
        "updatedAt" = EXCLUDED."updatedAt"
    `, [r.id, r.code, r.title, r.description, r.units, r.lecHours, r.labHours, r.prerequisite, r.yearLevel, r.semester, r.departmentId, r.facultyName, r.facultyId, r.createdAt, r.updatedAt]);
  }

  // Sync enrollments
  const enrRows = (await primary.query('SELECT * FROM "enrollments" ORDER BY "studentId", "courseId" ASC')).rows;
  for (const r of enrRows) {
    await secondary.query(`
      INSERT INTO "enrollments" ("studentId", "studentName", "courseId", "semester", "academicYear", "section", "status", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT ("studentId", "courseId") DO UPDATE SET
        "studentName" = EXCLUDED."studentName",
        "semester" = EXCLUDED."semester",
        "academicYear" = EXCLUDED."academicYear",
        "section" = EXCLUDED."section",
        "status" = EXCLUDED."status",
        "updatedAt" = EXCLUDED."updatedAt"
    `, [r.studentId, r.studentName, r.courseId, r.semester, r.academicYear, r.section, r.status, r.createdAt, r.updatedAt]);
  }

  // Sync syllabi
  const syllabiRows = (await primary.query('SELECT * FROM "syllabi" ORDER BY id ASC')).rows;
  for (const r of syllabiRows) {
    await secondary.query(`
      INSERT INTO "syllabi" ("id", "courseId", "instructorId", "departmentId", "academicYear", "semester", "section", "status", "currentVersionNumber", "reviewerRemarks", "submittedAt", "reviewedAt", "reviewedByUserId", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT ("id") DO UPDATE SET
        "status" = EXCLUDED."status",
        "currentVersionNumber" = EXCLUDED."currentVersionNumber",
        "reviewerRemarks" = EXCLUDED."reviewerRemarks",
        "submittedAt" = EXCLUDED."submittedAt",
        "reviewedAt" = EXCLUDED."reviewedAt",
        "reviewedByUserId" = EXCLUDED."reviewedByUserId",
        "updatedAt" = EXCLUDED."updatedAt"
    `, [r.id, r.courseId, r.instructorId, r.departmentId, r.academicYear, r.semester, r.section, r.status, r.currentVersionNumber, r.reviewerRemarks, r.submittedAt, r.reviewedAt, r.reviewedByUserId, r.createdAt, r.updatedAt]);
  }

  // Sync audit logs
  const auditRows = (await primary.query('SELECT * FROM "audit_logs" ORDER BY id ASC')).rows;
  for (const r of auditRows) {
    await secondary.query(`
      INSERT INTO "audit_logs" ("id", "userId", "userDisplayName", "actionType", "resultStatus", "description", "entityType", "entityId", "ipAddress", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT ("id") DO NOTHING
    `, [r.id, r.userId, r.userDisplayName, r.actionType, r.resultStatus, r.description, r.entityType, r.entityId, r.ipAddress, r.createdAt]);
  }

  await secondary.query("NOTIFY pgrst, 'reload schema'");
  console.log('✅ Secondary database fully synced with Primary!');

  await primary.end();
  await secondary.end();
}

sync().catch(console.error);
