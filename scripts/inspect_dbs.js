const { Client } = require('pg');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function inspect(url, name) {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await c.connect();
    console.log('=== ' + name + ' ===');
    const res = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log('Tables:', res.rows.map(r => r.table_name));
    for (const r of res.rows) {
      try {
        const countRes = await c.query('SELECT count(*) FROM "' + r.table_name + '"');
        console.log('  ' + r.table_name + ': ' + countRes.rows[0].count + ' rows');
      } catch (err) {
        console.log('  ' + r.table_name + ': error (' + err.message + ')');
      }
    }
  } catch (e) {
    console.log(name + ' error:', e.message);
  } finally {
    try { await c.end(); } catch {}
  }
}

async function main() {
  await inspect('postgresql://postgres.qoxpqhvecjxlsbsshxsm:Giangwapo123%3F@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require', 'Database 1 (qoxpqhvecjxlsbsshxsm - in current .env)');
  await inspect('postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require', 'Database 2 (goxvhkbwfpffjnqphzpq - in pgAdmin SRVS)');
}
main();
