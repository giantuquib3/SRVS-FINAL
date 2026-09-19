const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  connectionString: 'postgresql://postgres.qoxpqhvecjxlsbsshxsm:Giangwapo123%3F@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require',
});

(async () => {
  await client.connect();
  const res = await client.query(`SELECT id, "fullName", role FROM "admin" ORDER BY id;`);
  console.table(res.rows);
  await client.end();
})();
