const fs = require('fs');

async function testSpec() {
  const fileContent = fs.readFileSync('src/app/api/openapi.json/route.ts', 'utf8');
  // Simple extraction or evaluation
  const codeWithoutImports = fileContent
    .replace(/import\s+[^;]+;/, '')
    .replace(/export\s+const\s+dynamic\s*=\s*'force-dynamic';/, '')
    .replace(/export\s+async\s+function\s+GET\(\)\s*\{/, 'function getSpec() {')
    .replace(/return\s+NextResponse\.json\(openApiSpec\);/, 'return openApiSpec;')
    + '\nmodule.exports = getSpec();';

  fs.writeFileSync('scripts/temp-spec-runner.js', codeWithoutImports);
  const spec = require('./temp-spec-runner.js');
  fs.unlinkSync('scripts/temp-spec-runner.js');

  console.log('✓ Successfully extracted OpenAPI spec');
  console.log('OpenAPI Version:', spec.openapi);
  console.log('Title:', spec.info.title);
  console.log('Total Paths:', Object.keys(spec.paths).length);

  let issues = 0;
  for (const [pathKey, pathObj] of Object.entries(spec.paths)) {
    // Check path params in path string
    const pathMatches = [...pathKey.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);

    for (const [method, op] of Object.entries(pathObj)) {
      if (!['get', 'post', 'patch', 'put', 'delete'].includes(method)) continue;

      // 1. Path parameters check
      const declaredParams = op.parameters || [];
      for (const p of pathMatches) {
        const found = declaredParams.find(dp => dp.name === p && dp.in === 'path');
        if (!found) {
          console.error(`❌ [${method.toUpperCase()} ${pathKey}] Missing path parameter: {${p}}`);
          issues++;
        }
      }

      // 2. Request body check for POST/PATCH/PUT
      if (['post', 'patch', 'put'].includes(method)) {
        if (!op.requestBody && !pathKey.includes('/logout') && !pathKey.includes('/submit')) {
          console.warn(`⚠️ [${method.toUpperCase()} ${pathKey}] No requestBody defined!`);
        }
      }

      // 3. Responses check
      if (!op.responses || Object.keys(op.responses).length === 0) {
        console.error(`❌ [${method.toUpperCase()} ${pathKey}] No responses defined!`);
        issues++;
      }
    }
  }

  // 4. Schema reference check
  const jsonStr = JSON.stringify(spec);
  const refMatches = [...jsonStr.matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)].map(m => m[1]);
  for (const ref of refMatches) {
    if (!spec.components?.schemas?.[ref]) {
      console.error(`❌ Missing schema reference: ${ref}`);
      issues++;
    }
  }

  if (issues === 0) {
    console.log('✅ ALL OpenAPI CHECKS PASSED PERFECTLY with 0 issues!');
  } else {
    console.log(`❌ Found ${issues} issues in OpenAPI spec.`);
  }
}

testSpec().catch(console.error);
