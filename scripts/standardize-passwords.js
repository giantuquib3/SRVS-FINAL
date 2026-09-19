const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const DB1_URL = 'postgresql://postgres.qoxpqhvecjxlsbsshxsm:Giangwapo123%3F@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres';
const DB2_URL = 'postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres';

async function standardize(url, name) {
  console.log(`Updating passwords on ${name}...`);
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const adminHash = await bcrypt.hash('admin123', 10);
  const headHash = await bcrypt.hash('head123', 10);
  const facultyHash = await bcrypt.hash('faculty123', 10);
  const studentHash = await bcrypt.hash('student123', 10);

  // Update admin
  await client.query(`UPDATE "admin" SET "passwordHash" = $1 WHERE "role" = 'Admin'`, [adminHash]);
  // Update dept heads
  await client.query(`UPDATE "admin" SET "passwordHash" = $1 WHERE "role" = 'DepartmentHead'`, [headHash]);
  // Update educators
  await client.query(`UPDATE "admin" SET "passwordHash" = $1 WHERE "role" = 'Educator'`, [facultyHash]);
  // Update students
  await client.query(`UPDATE "admin" SET "passwordHash" = $1 WHERE "role" = 'Student'`, [studentHash]);

  console.log(`✓ Updated password hashes on ${name}.`);
  await client.end();
}

async function main() {
  await standardize(DB1_URL, 'Database 1 (Primary pooler)');
  await standardize(DB2_URL, 'Database 2 (Secondary pgAdmin pooler)');
  console.log('All passwords standardized successfully.');
}

main().catch(console.error);
