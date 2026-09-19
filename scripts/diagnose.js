process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

async function check(url, label) {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('=== Checking', label, '===');
    const tables = ['admins', 'department_heads', 'faculty', 'students', 'srvs_subjects', 'srvs_syllabi', 'srvs_syllabus_versions'];
    for (const t of tables) {
      const res = await client.query(`SELECT count(*) FROM "${t}"`);
      console.log(`${t}: ${res.rows[0].count} rows`);
    }
  } catch (err) {
    console.error('Error in', label, err.message);
  } finally {
    try { await client.end(); } catch (e) {}
  }
}

async function main() {
  await check('postgresql://postgres.qoxpqhvecjxlsbsshxsm:Giangwapo123%3F@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require', 'Database 1 (qoxpqhvecjxlsbsshxsm)');
  await check('postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require', 'Database 2 (goxvhkbwfpffjnqphzpq)');
}

main();
