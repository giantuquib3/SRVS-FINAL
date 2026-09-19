const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const databases = [
  {
    name: 'DB 1 (qoxpqhvecjxlsbsshxsm - Primary)',
    url: 'postgresql://postgres.qoxpqhvecjxlsbsshxsm:Giangwapo123%3F@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require',
  },
  {
    name: 'DB 2 (goxvhkbwfpffjnqphzpq - Secondary)',
    url: 'postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require',
  },
];

const tables = [
  'admin',
  'courses',
  'enrollments',
  'syllabi',
  'syllabus_versions',
  'audit_logs',
];

async function checkCounts() {
  for (const db of databases) {
    const client = new Client({ connectionString: db.url });
    await client.connect();
    console.log(`\n=== Table Counts for ${db.name} ===`);
    const results = {};
    for (const tbl of tables) {
      const res = await client.query(`SELECT COUNT(*)::int as cnt FROM "${tbl}"`);
      results[tbl] = res.rows[0].cnt;
    }
    console.table(results);
    await client.end();
  }
}

checkCounts().catch(console.error);
