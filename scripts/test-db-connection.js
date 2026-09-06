const { Client } = require('pg');

async function testConnection(url, label) {
  console.log(`Testing ${label}...`);
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    const res = await client.query('SELECT current_database(), now();');
    console.log(`✓ ${label} succeeded:`, res.rows[0]);
    await client.end();
    return true;
  } catch (err) {
    console.error(`✗ ${label} failed:`, err.message);
    try { await client.end(); } catch (_) {}
    return false;
  }
}

async function run() {
  const p5432 = "postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require";
  const p6543 = "postgresql://postgres.goxvhkbwfpffjnqphzpq:Giangwapo123%3F@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require";

  await testConnection(p5432, "Port 5432");
  await testConnection(p6543, "Port 6543");
}

run();
