const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function checkRLS(name, url) {
  const c = new Client({ connectionString: url });
  await c.connect();
  const res = await c.query(`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);
  console.log('=== ' + name + ' ===');
  console.table(res.rows);
  await c.end();
}

(async () => {
  try {
    await checkRLS('DB 1 (qoxpqhvecjxlsbsshxsm - Primary in .env)', 'postgresql://postgres.qoxpqhvecjxlsbsshxsm:Giangwapo123%3F@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require');
    await checkRLS('DB 2 (goxvhkbwfpffjnqphzpq - Secondary in pgAdmin)', 'postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require');
  } catch (err) {
    console.error(err);
  }
})();
