const fs = require('fs');
const path = require('path');

async function main() {
  const res = await fetch('http://localhost:3000/api/openapi.json');
  const spec = await res.json();

  // 1. What the spec documents
  const documented = new Set();
  console.log('=== DOCUMENTED OPERATIONS (method path | params | body) ===');
  for (const [p, ops] of Object.entries(spec.paths)) {
    for (const [m, op] of Object.entries(ops)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(m)) continue;
      documented.add(`${m.toUpperCase()} ${p}`);
      const params = (op.parameters || []).map(x => `${x.in}:${x.name}`).join(',') || '-';
      const body = op.requestBody ? 'YES' : '-';
      console.log(`${m.toUpperCase().padEnd(6)} ${p.padEnd(50)} | ${params.padEnd(60)} | ${body}`);
    }
  }

  // 2. What actually exists in code
  const apiDir = path.join(process.cwd(), 'src', 'app', 'api');
  const actual = [];
  function walk(dir) {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (f === 'route.ts') {
        const src = fs.readFileSync(full, 'utf8');
        const rel = '/api/' + path.relative(apiDir, path.dirname(full)).replace(/\\/g, '/');
        const openapiPath = rel.replace(/\[(\w+)\]/g, '{$1}');
        for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
          if (new RegExp(`export\\s+async\\s+function\\s+${m}\\b`).test(src)) {
            const usesQuery = /searchParams\.get\(/.test(src);
            const usesBody = /req\.json\(\)|req\.formData\(\)/.test(src);
            actual.push({ key: `${m} ${openapiPath}`, usesQuery, usesBody });
          }
        }
      }
    }
  }
  walk(apiDir);

  console.log('\n=== IMPLEMENTED IN CODE BUT NOT DOCUMENTED ===');
  for (const a of actual) if (!documented.has(a.key)) console.log(`  ${a.key}  (query:${a.usesQuery} body:${a.usesBody})`);

  console.log('\n=== DOCUMENTED BUT NOT IMPLEMENTED ===');
  const actualKeys = new Set(actual.map(a => a.key));
  for (const d of documented) if (!actualKeys.has(d)) console.log(`  ${d}`);
}

main().catch(console.error);
