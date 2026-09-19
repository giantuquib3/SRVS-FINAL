const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Parse .env manually
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    }
  }
} catch (e) {}

async function testConnection(url, label) {
  if (!url) {
    console.log(`⚠️ ${label} URL not defined in .env`);
    return false;
  }
  console.log(`Testing ${label}...`);
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
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
  await testConnection(process.env.DIRECT_URL, "DIRECT_URL (Port 5432 / Session)");
  await testConnection(process.env.DATABASE_URL, "DATABASE_URL (Port 6543 / Transaction Pooler)");
}

run();
