const { Client } = require('pg');

const DB1_URL = 'postgresql://postgres.qoxpqhvecjxlsbsshxsm:Giangwapo123%3F@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';
const DB2_URL = 'postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres';

async function main() {
  const c1 = new Client({ connectionString: DB1_URL, ssl: { rejectUnauthorized: false } });
  const c2 = new Client({ connectionString: DB2_URL, ssl: { rejectUnauthorized: false } });

  await c1.connect();
  await c2.connect();

  const { rows: users2 } = await c2.query(`SELECT * FROM "admin"`);
  console.log(`DB2 has ${users2.length} users in admin table.`);

  // Sync users from DB2 to DB1
  for (const u of users2) {
    await c1.query(`
      INSERT INTO "admin" ("id", "email", "passwordHash", "fullName", "role", "departmentId", "academicRank", "yearLevel", "accountStatus", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT ("id") DO UPDATE
      SET "email" = EXCLUDED."email",
          "fullName" = EXCLUDED."fullName",
          "role" = EXCLUDED."role",
          "departmentId" = EXCLUDED."departmentId";
    `, [u.id, u.email, u.passwordHash, u.fullName, u.role, u.departmentId, u.academicRank, u.yearLevel, u.accountStatus, u.createdAt, u.updatedAt]);
  }

  const { rows: users1 } = await c1.query(`SELECT count(*) FROM "admin"`);
  console.log(`DB1 now has ${users1[0].count} users in admin table.`);

  // Now sync enrollments
  const { rows: enrollments2 } = await c2.query(`SELECT * FROM "enrollments"`);
  for (const e of enrollments2) {
    await c1.query(`
      INSERT INTO "enrollments" ("studentId", "studentName", "courseId", "semester", "academicYear", "section", "status", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT ("studentId", "courseId") DO NOTHING;
    `, [
      e.studentId,
      e.studentName,
      e.courseId,
      e.semester,
      e.academicYear,
      e.section,
      e.status,
      e.createdAt,
      e.updatedAt
    ]);
  }

  const { rows: count1 } = await c1.query(`SELECT count(*) FROM "enrollments"`);
  console.log(`DB1 now has ${count1[0].count} enrollments.`);

  await c1.end();
  await c2.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
