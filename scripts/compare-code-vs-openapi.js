const fs = require('fs');
const path = require('path');

// Load OpenAPI spec
const openapiContent = fs.readFileSync('src/app/api/openapi.json/route.ts', 'utf8');
const specMatch = openapiContent.match(/const openApiSpec = (\{[\s\S]*?\n  \};\n)/);
const spec = new Function(`return ${specMatch[1]}`)();

function getRouteFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) results = results.concat(getRouteFiles(filePath));
    else if (file === 'route.ts') results.push(filePath);
  });
  return results;
}

const routeFiles = getRouteFiles('src/app/api');

console.log('=== CHECKING PARAMETERS & REQUEST BODIES ACROSS ALL ENDPOINTS ===\n');

const findings = [];

for (const file of routeFiles) {
  const code = fs.readFileSync(file, 'utf8');
  
  // Calculate endpoint URL path from file path
  // e.g. src/app/api/auth/login/route.ts -> /api/auth/login
  // e.g. src/app/api/syllabi/[id]/review/route.ts -> /api/syllabi/{id}/review
  let routePath = file
    .replace(/^src[\\/]app/, '')
    .replace(/[\\/]route\.ts$/, '')
    .replace(/\\/g, '/')
    .replace(/\[([^\]]+)\]/g, '{$1}');

  const pathItem = spec.paths[routePath];

  // Detect HTTP methods exported in code
  const methods = [];
  if (/export\s+async\s+function\s+GET\b/.test(code)) methods.push('get');
  if (/export\s+async\s+function\s+POST\b/.test(code)) methods.push('post');
  if (/export\s+async\s+function\s+PUT\b/.test(code)) methods.push('put');
  if (/export\s+async\s+function\s+PATCH\b/.test(code)) methods.push('patch');
  if (/export\s+async\s+function\s+DELETE\b/.test(code)) methods.push('delete');

  // Extract query params read in code
  const queryParamRegex = /searchParams\.get\(['"]([^'"]+)['"]\)/g;
  const codeQueryParams = new Set();
  let m;
  while ((m = queryParamRegex.exec(code)) !== null) {
    codeQueryParams.add(m[1]);
  }

  // Extract body properties read via destructuring: const { a, b, c } = await req.json();
  const bodyDestructureRegex = /const\s*\{([^}]+)\}\s*=\s*(?:await\s+)?req\.json\(\)/g;
  const codeBodyProps = new Set();
  while ((m = bodyDestructureRegex.exec(code)) !== null) {
    const props = m[1].split(',').map(p => p.trim().split(':')[0].trim());
    props.forEach(p => {
      if (p && !p.startsWith('//') && /^[a-zA-Z0-9_]+$/.test(p)) codeBodyProps.add(p);
    });
  }

  // If not defined in spec
  if (!pathItem) {
    findings.push({
      type: 'UNREGISTERED_ROUTE',
      route: routePath,
      file,
      methods
    });
    continue;
  }

  for (const method of methods) {
    const op = pathItem[method];
    if (!op) {
      findings.push({
        type: 'MISSING_METHOD_IN_SPEC',
        route: routePath,
        method: method.toUpperCase(),
        file
      });
      continue;
    }

    // Check query params
    const specQueryParams = (op.parameters || [])
      .filter(p => p.in === 'query')
      .map(p => p.name);

    for (const qp of codeQueryParams) {
      if (!specQueryParams.includes(qp)) {
        findings.push({
          type: 'UNDOCUMENTED_QUERY_PARAM',
          route: routePath,
          method: method.toUpperCase(),
          param: qp
        });
      }
    }

    // Check body properties
    if (codeBodyProps.size > 0 && ['post', 'put', 'patch'].includes(method)) {
      if (!op.requestBody) {
        findings.push({
          type: 'MISSING_REQUEST_BODY_IN_SPEC',
          route: routePath,
          method: method.toUpperCase(),
          codeBodyProps: Array.from(codeBodyProps)
        });
      } else {
        const specProps = Object.keys(
          op.requestBody.content?.['application/json']?.schema?.properties || {}
        );
        for (const bp of codeBodyProps) {
          if (!specProps.includes(bp)) {
            findings.push({
              type: 'UNDOCUMENTED_BODY_PROPERTY',
              route: routePath,
              method: method.toUpperCase(),
              property: bp,
              specProps
            });
          }
        }
      }
    }
  }
}

console.log('--- FINDINGS ---');
console.log(JSON.stringify(findings, null, 2));
console.log(`\nTotal findings: ${findings.length}`);
