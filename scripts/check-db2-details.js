const { Client } = require('pg');

async function checkDb2() {
  const client = new Client({
    connectionString: 'postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  console.log('--- DB 2 USERS VS ADMIN ---');
  const adminSample = await client.query('SELECT id, email, role, "fullName" FROM "admin" LIMIT 5');
  console.log('admin sample:', adminSample.rows);

  const usersSample = await client.query('SELECT id, email, role, "fullName" FROM "users" LIMIT 5');
  console.log('users sample:', usersSample.rows);

  console.log('--- DB 2 ENROLLEES VS ENROLLMENTS ---');
  const enrolleesSample = await client.query('SELECT * FROM "enrollees" LIMIT 3');
  console.log('enrollees sample:', enrolleesSample.rows);

  const enrollmentsSample = await client.query('SELECT * FROM "enrollments" LIMIT 3');
  console.log('enrollments sample:', enrollmentsSample.rows);

  await client.end();
}

checkDb2().catch(console.error);
