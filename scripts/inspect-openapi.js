const http = require('http');

http.get('http://127.0.0.1:3001/api/openapi.json', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    try {
      const spec = JSON.parse(data);
      console.log('=== OpenAPI Spec Audit ===');
      for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
        console.log(`\nEndpoint: ${pathKey}`);
        for (const [method, op] of Object.entries(pathItem)) {
          if (['get', 'post', 'patch', 'put', 'delete'].includes(method)) {
            const paramCount = op.parameters ? op.parameters.length : 0;
            const hasReqBody = !!op.requestBody;
            const params = paramCount > 0 ? op.parameters.map(p => `${p.name} in ${p.in}${p.required ? '*' : ''}`).join(', ') : 'NONE';
            console.log(`  [${method.toUpperCase()}] ${op.summary}`);
            console.log(`    - Params: ${params}`);
            console.log(`    - Request Body: ${hasReqBody ? 'YES' : 'NO'}`);
            if (hasReqBody && op.requestBody?.content?.['application/json']?.schema?.properties) {
              const props = Object.keys(op.requestBody.content['application/json'].schema.properties);
              console.log(`      props: ${props.join(', ')}`);
            }
          }
        }
      }
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  });
}).on('error', e => console.error('Fetch error:', e.message));
