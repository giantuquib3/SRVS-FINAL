const fs = require('fs');
const path = require('path');

// 1. Load OpenAPI spec
const openapiRouteContent = fs.readFileSync('src/app/api/openapi.json/route.ts', 'utf8');

// Extract openApiSpec object
// We can evaluate it or parse it
const specMatch = openapiRouteContent.match(/const openApiSpec = (\{[\s\S]*?\n\s*\});/);
if (!specMatch) {
  console.error('Could not extract openApiSpec from route.ts');
  process.exit(1);
}

let spec;
try {
  // Use Function to safely evaluate the JS object literal
  spec = new Function(`return ${specMatch[1]}`)();
  console.log(`Successfully parsed OpenAPI spec with ${Object.keys(spec.paths).length} paths.\n`);
} catch (e) {
  console.error('Failed to parse openApiSpec:', e.message);
  process.exit(1);
}

// 2. Scan all route.ts files
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

console.log(`Found ${routeFiles.length} route files across src/app/api.\n`);

const issues = [];
const checkedPaths = new Set();

for (const [pathStr, pathItem] of Object.entries(spec.paths)) {
  checkedPaths.add(pathStr);
  
  for (const [method, operation] of Object.entries(pathItem)) {
    if (typeof operation !== 'object' || !operation.tags) continue;

    const opId = `${method.toUpperCase()} ${pathStr}`;

    // A. Check path parameters in URL
    const pathParamsInUrl = (pathStr.match(/\{([^}]+)\}/g) || []).map(p => p.slice(1, -1));
    const declaredParams = operation.parameters || [];
    const declaredPathParams = declaredParams.filter(p => p.in === 'path').map(p => p.name);

    for (const p of pathParamsInUrl) {
      if (!declaredPathParams.includes(p)) {
        issues.push(`[MISSING PATH PARAM] ${opId}: URL parameter "{${p}}" is not declared in parameters list.`);
      }
    }

    // B. Check all declared parameters have valid structure
    for (const param of declaredParams) {
      if (!param.name) {
        issues.push(`[PARAM LACKS NAME] ${opId}: Parameter missing "name".`);
      }
      if (!['query', 'path', 'header', 'cookie'].includes(param.in)) {
        issues.push(`[INVALID PARAM 'in'] ${opId}: Parameter "${param.name}" has invalid 'in': "${param.in}".`);
      }
      if (!param.schema) {
        issues.push(`[PARAM LACKS SCHEMA] ${opId}: Parameter "${param.name}" has no schema.`);
      } else if (!param.schema.type) {
        issues.push(`[PARAM LACKS TYPE] ${opId}: Parameter "${param.name}" schema has no type.`);
      }
    }

    // C. Check requestBody if present
    if (operation.requestBody) {
      const content = operation.requestBody.content;
      if (!content) {
        issues.push(`[REQUEST BODY LACKS CONTENT] ${opId}: requestBody has no content definition.`);
      } else {
        const jsonContent = content['application/json'] || content['multipart/form-data'];
        if (!jsonContent) {
          issues.push(`[REQUEST BODY NOT JSON/MULTIPART] ${opId}: requestBody content has no application/json or multipart/form-data.`);
        } else if (!jsonContent.schema) {
          issues.push(`[REQUEST BODY LACKS SCHEMA] ${opId}: content has no schema.`);
        } else {
          const schema = jsonContent.schema;
          if (schema.type === 'object' && schema.properties) {
            // Check required fields match properties
            const required = schema.required || [];
            for (const reqProp of required) {
              if (!schema.properties[reqProp]) {
                issues.push(`[REQUEST BODY REQUIRED FIELD NOT IN PROPERTIES] ${opId}: "${reqProp}" is required but not defined in properties.`);
              }
            }
          }
        }
      }
    } else if (['post', 'put', 'patch'].includes(method.toLowerCase()) && !pathStr.includes('/approve') && !pathStr.includes('/logout') && !pathStr.includes('/restore') && !pathStr.includes('/submit')) {
      // Check if code actually reads req.json()
      // Flag potential missing requestBody
    }

    // D. Check responses
    if (!operation.responses) {
      issues.push(`[MISSING RESPONSES] ${opId}: No responses object defined.`);
    } else {
      const codes = Object.keys(operation.responses);
      if (!codes.some(c => c.startsWith('2'))) {
        issues.push(`[MISSING 2XX RESPONSE] ${opId}: No 200 or 201 success response defined.`);
      }
    }
  }
}

console.log('OpenAPI Structure Audit Results:');
if (issues.length === 0) {
  console.log('✓ Zero structural issues in OpenAPI specification document!\n');
} else {
  console.log(`Found ${issues.length} structural issues:`);
  issues.forEach(iss => console.log('  - ' + iss));
  console.log('');
}
