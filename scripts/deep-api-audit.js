const fs = require('fs');
const path = require('path');

// 1. Read openApiSpec
const openapiContent = fs.readFileSync('src/app/api/openapi.json/route.ts', 'utf8');
const specMatch = openapiContent.match(/const openApiSpec = (\{[\s\S]*?\n\s*\});/);
if (!specMatch) {
  console.error('Failed to match openApiSpec in route.ts');
  process.exit(1);
}
let spec;
try {
  spec = new Function(`return ${specMatch[1]}`)();
} catch (e) {
  console.error('Failed to parse openApiSpec:', e.message);
  process.exit(1);
}

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

function analyzeFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');

  let routePath = filePath
    .replace(/^src[\\/]app/, '')
    .replace(/[\\/]route\.ts$/, '')
    .replace(/\\/g, '/')
    .replace(/\[([^\]]+)\]/g, '{$1}');

  // Find all methods and their code blocks
  const methodRegex = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\([^)]*\)\s*\{/g;
  const methods = [];
  let match;

  while ((match = methodRegex.exec(code)) !== null) {
    const methodName = match[1];
    const startIndex = match.index;
    
    // Find matching closing brace or end of function
    let braceCount = 0;
    let endIndex = startIndex;
    let foundStart = false;

    for (let i = startIndex; i < code.length; i++) {
      if (code[i] === '{') {
        braceCount++;
        foundStart = true;
      } else if (code[i] === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }

    const methodCode = code.slice(startIndex, endIndex);

    // Extract query params for THIS method
    const qParams = new Set();
    const qMatches = methodCode.matchAll(/searchParams\.get\(['"]([^'"]+)['"]\)/g);
    for (const q of qMatches) {
      qParams.add(q[1]);
    }

    // Extract req.json() destructuring in THIS method or called helper functions
    const bodyProps = new Set();
    const bMatches = methodCode.matchAll(/const\s*\{([^}]+)\}\s*=\s*(?:await\s+)?(?:req\.json\(\)|body)/g);
    for (const b of bMatches) {
      b[1].split(',').forEach(prop => {
        const clean = prop.trim().split(':')[0].trim();
        if (clean && !clean.startsWith('//') && /^[a-zA-Z0-9_]+$/.test(clean)) {
          bodyProps.add(clean);
        }
      });
    }

    // Also check if this method delegates to a helper (like handleReviewAction)
    const helperMatch = methodCode.match(/(handle\w+|create\w+|process\w+)\(req/);
    if (helperMatch) {
      const helperName = helperMatch[1];
      const helperRegex = new RegExp(`async\\s+function\\s+${helperName}[\\s\\S]*?\\n\\}`, 'g');
      const helperFound = code.match(helperRegex);
      if (helperFound) {
        const hCode = helperFound[0];
        const hQMatches = hCode.matchAll(/searchParams\.get\(['"]([^'"]+)['"]\)/g);
        for (const q of hQMatches) qParams.add(q[1]);
        const hBMatches = hCode.matchAll(/const\s*\{([^}]+)\}\s*=\s*(?:await\s+)?(?:req\.json\(\)|body)/g);
        for (const b of hBMatches) {
          b[1].split(',').forEach(prop => {
            const clean = prop.trim().split(':')[0].trim();
            if (clean && !clean.startsWith('//') && /^[a-zA-Z0-9_]+$/.test(clean)) {
              bodyProps.add(clean);
            }
          });
        }
      }
    }

    // Path params in URL: {id}, {version}, etc.
    const pathParams = (routePath.match(/\{([^}]+)\}/g) || []).map(p => p.slice(1, -1));

    methods.push({
      name: methodName,
      methodLower: methodName.toLowerCase(),
      queryParams: Array.from(qParams),
      bodyParams: Array.from(bodyProps),
      pathParams
    });
  }

  return { filePath, routePath, methods };
}

const audit = [];

for (const file of routeFiles) {
  const analysis = analyzeFile(file);
  const specItem = spec.paths[analysis.routePath];

  if (!specItem) {
    audit.push({
      type: 'MISSING_ROUTE_IN_SPEC',
      route: analysis.routePath,
      file,
      methods: analysis.methods.map(m => m.name)
    });
    continue;
  }

  for (const m of analysis.methods) {
    const specOp = specItem[m.methodLower];
    if (!specOp) {
      audit.push({
        type: 'MISSING_METHOD_IN_SPEC',
        route: analysis.routePath,
        method: m.name,
        file
      });
      continue;
    }

    // Check path parameters
    const specPathParams = (specOp.parameters || [])
      .filter(p => p.in === 'path')
      .map(p => p.name);

    for (const pp of m.pathParams) {
      if (!specPathParams.includes(pp)) {
        audit.push({
          type: 'MISSING_PATH_PARAM_IN_SPEC',
          route: analysis.routePath,
          method: m.name,
          param: pp
        });
      }
    }

    // Check query parameters
    const specQueryParams = (specOp.parameters || [])
      .filter(p => p.in === 'query')
      .map(p => p.name);

    for (const qp of m.queryParams) {
      if (!specQueryParams.includes(qp)) {
        audit.push({
          type: 'MISSING_QUERY_PARAM_IN_SPEC',
          route: analysis.routePath,
          method: m.name,
          param: qp
        });
      }
    }

    // Check request body properties
    if (m.bodyParams.length > 0) {
      if (!specOp.requestBody) {
        audit.push({
          type: 'MISSING_REQUEST_BODY_IN_SPEC',
          route: analysis.routePath,
          method: m.name,
          bodyParams: m.bodyParams
        });
      } else {
        const specBodyProps = Object.keys(
          specOp.requestBody.content?.['application/json']?.schema?.properties || {}
        );
        for (const bp of m.bodyParams) {
          if (!specBodyProps.includes(bp)) {
            audit.push({
              type: 'MISSING_BODY_PROP_IN_SPEC',
              route: analysis.routePath,
              method: m.name,
              property: bp,
              specBodyProps
            });
          }
        }
      }
    }
  }
}

fs.writeFileSync('scripts/audit-findings.json', JSON.stringify(audit, null, 2));

console.log('=== METHODICAL AUDIT OF ALL 42 ENDPOINTS ===');
console.log(`Total spec paths: ${Object.keys(spec.paths).length}`);
console.log(`Audit findings count: ${audit.length}`);

// Group by type
const byType = {};
for (const item of audit) {
  byType[item.type] = (byType[item.type] || 0) + 1;
}
console.log('Findings by type:', byType);
console.log('Saved detailed findings to scripts/audit-findings.json');
