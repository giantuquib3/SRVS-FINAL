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

async function checkFks(db) {
  const client = new Client({ connectionString: db.url });
  await client.connect();
  const res = await client.query(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public';
  `);
  console.log('=== ' + db.name + ' ===');
  console.table(res.rows);
  await client.end();
}

(async () => {
  for (const db of databases) {
    try {
      await checkFks(db);
    } catch (e) {
      console.error(e);
    }
  }
})();
