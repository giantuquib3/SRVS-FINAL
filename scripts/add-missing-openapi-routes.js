const fs = require('fs');

const filePath = 'src/app/api/openapi.json/route.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add PUT to '/api/syllabi/{id}'
const putSyllabusMethod = `        put: {
          tags: ['6. Syllabus Management'],
          summary: 'Submit Syllabus Revision (PUT Alias)',
          description: 'PUT alias for PATCH /api/syllabi/{id} allowing full revision update or draft save.',
          operationId: 'reviseSyllabusPut',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 10 } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['changeSummary'],
                  properties: {
                    changeSummary: { type: 'string', example: 'Updated course syllabus details.' },
                    courseDescription: { type: 'string' },
                    learningOutcomes: { type: 'array', items: { type: 'string' } },
                    saveAsDraft: { type: 'boolean', default: false },
                    submitForApproval: { type: 'boolean', default: false },
                    fileUrl: { type: 'string' },
                    fileType: { type: 'string', enum: ['PDF'] },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Syllabus updated successfully.' },
            '400': { description: 'Validation failed.' },
            '403': { description: 'Forbidden.' },
          },
        },
`;

// Insert PUT after patch in '/api/syllabi/{id}'
content = content.replace(/(operationId: 'reviseSyllabus',[\s\S]*?'403': \{ description: 'Forbidden: Only author or assigned Department Head can edit\.' \},\s*\},[\s\S]*?\},)/m, `$1\n${putSyllabusMethod}`);

// 2. Add '/api/syllabi/{id}/versions/{version}/submit' right after '/api/syllabi/{id}/submit'
const submitVersionRoute = `      '/api/syllabi/{id}/versions/{version}/submit': {
        post: {
          tags: ['6. Syllabus Management'],
          summary: 'Submit Specific Syllabus Version for Review',
          description: 'Submit an existing draft version of a syllabus for Department Head review.',
          operationId: 'submitSyllabusSpecificVersion',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 10 }, description: 'Syllabus ID' },
            { name: 'version', in: 'path', required: true, schema: { type: 'integer', example: 1 }, description: 'Version number to submit' },
          ],
          responses: {
            '200': { description: 'Syllabus version submitted successfully.' },
            '400': { description: 'Version already approved or already pending review.' },
            '403': { description: 'Forbidden: Not author or department mismatch.' },
            '404': { description: 'Syllabus or version not found.' },
          },
        },
      },
`;

content = content.replace(/(\'\/api\/syllabi\/\{id\}\/submit\': \{[\s\S]*?\},[\s\S]*?\},)/m, `$1\n${submitVersionRoute}`);

// 3. Add PATCH to '/api/syllabus-approvals' and query parameters to GET
const approvalsGetParams = `          parameters: [
            {
              name: 'status',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['ALL', 'SUBMITTED', 'APPROVED', 'REJECTED', 'UNDER_REVIEW'], default: 'SUBMITTED' },
              description: 'Filter approval requests by status.',
            },
            {
              name: 'departmentId',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'] },
              description: 'Filter by department code.',
            },
            {
              name: 'courseId',
              in: 'query',
              required: false,
              schema: { type: 'integer' },
            },
            {
              name: 'courseCode',
              in: 'query',
              required: false,
              schema: { type: 'string', example: 'CPE101' },
            },
            {
              name: 'instructorId',
              in: 'query',
              required: false,
              schema: { type: 'integer' },
            },
            {
              name: 'idNumber',
              in: 'query',
              required: false,
              schema: { type: 'integer' },
              description: 'Alias for instructorId.',
            },
            {
              name: 'syllabusId',
              in: 'query',
              required: false,
              schema: { type: 'integer' },
            },
          ],`;

content = content.replace(/summary: 'List Pending Syllabus Approval Requests \(Department Head Only\)',\s*description: '[\s\S]*?',\s*operationId: 'getSyllabusApprovals',/m, `summary: 'List Pending Syllabus Approval Requests (Department Head Only)',
          description: 'Department Heads retrieve submitted syllabi awaiting review strictly within their department. Supports filtering by status, departmentId, course, and instructor.',
          operationId: 'getSyllabusApprovals',
${approvalsGetParams}`);

// Add PATCH to '/api/syllabus-approvals'
const approvalsPatchMethod = `        patch: {
          tags: ['7. Syllabus Review & Approval'],
          summary: 'Review Syllabus Version (PATCH Alias)',
          description: 'PATCH alias for POST /api/syllabus-approvals allowing Department Head to approve, reject, or place under review.',
          operationId: 'reviewSyllabusPatch',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['versionId', 'action'],
                  properties: {
                    versionId: { type: 'integer', example: 25 },
                    action: { type: 'string', enum: ['Approve', 'Reject', 'Under_Review'], example: 'Approve' },
                    remarks: { type: 'string', example: 'Approved for 1st Semester AY 2026-2027.' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Review action processed successfully.' },
            '400': { description: 'Missing versionId or invalid action.' },
            '403': { description: 'Unauthorized.' },
            '404': { description: 'Version not found.' },
          },
        },
`;

content = content.replace(/(\'\/api\/syllabus-approvals\': \{[\s\S]*?post: \{[\s\S]*?\},[\s\S]*?\},)/m, `$1\n${approvalsPatchMethod}`);

// 4. Add '/api/syllabus-approvals/{id}/approve' and '/api/syllabus-approvals/{id}/reject'
const approveRejectRoutes = `      '/api/syllabus-approvals/{id}/approve': {
        post: {
          tags: ['7. Syllabus Review & Approval'],
          summary: 'Approve Syllabus Version by ID',
          description: 'Department Head direct approval endpoint for a specific syllabus version ID.',
          operationId: 'approveSyllabusById',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 25 }, description: 'SyllabusVersion ID or Syllabus ID' },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    comments: { type: 'string', example: 'Approved syllabus conforms to curriculum outcomes.' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Syllabus version approved successfully.' },
            '400': { description: 'Version not in pending status.' },
            '403': { description: 'Forbidden outside assigned department.' },
            '404': { description: 'Syllabus version not found.' },
          },
        },
      },
      '/api/syllabus-approvals/{id}/reject': {
        post: {
          tags: ['7. Syllabus Review & Approval'],
          summary: 'Reject Syllabus Version by ID',
          description: 'Department Head direct rejection endpoint with required rejection feedback reason.',
          operationId: 'rejectSyllabusById',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 25 }, description: 'SyllabusVersion ID or Syllabus ID' },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['rejectionReason'],
                  properties: {
                    rejectionReason: { type: 'string', example: 'Please update laboratory experiments 4 and 5 to reflect new FPGA board hardware.' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Syllabus version rejected with feedback.' },
            '400': { description: 'Missing rejection reason.' },
            '403': { description: 'Forbidden outside assigned department.' },
            '404': { description: 'Syllabus version not found.' },
          },
        },
      },
`;

content = content.replace(/(\'\/api\/syllabus-approvals\/\{id\}\': \{[\s\S]*?\},[\s\S]*?\},)/m, `$1\n${approveRejectRoutes}`);

// 5. Add '/api/subjects' and '/api/openapi.json'
const subjectsAndOpenApiRoutes = `      '/api/subjects': {
        get: {
          tags: ['4. Courses'],
          summary: 'Browse Curriculum Subjects (Alias for /api/courses)',
          description: 'Legacy client alias endpoint returning courses array under both "courses" and "subjects" keys.',
          operationId: 'getSubjectsAlias',
          responses: {
            '200': { description: 'Curriculum catalog.' },
          },
        },
        post: {
          tags: ['4. Courses'],
          summary: 'Create Subject (Alias for /api/courses)',
          description: 'Alias delegating to POST /api/courses.',
          operationId: 'createSubjectAlias',
          responses: {
            '201': { description: 'Subject/course created successfully.' },
          },
        },
      },
      '/api/openapi.json': {
        get: {
          tags: ['9. Dashboard / System Health'],
          summary: 'OpenAPI 3.0.3 Specification Document',
          description: 'Returns the complete consolidated OpenAPI 3.0.3 specification JSON for the entire SRVS platform.',
          operationId: 'getOpenApiSpec',
          responses: {
            '200': {
              description: 'OpenAPI 3.0.3 JSON document.',
              content: {
                'application/json': { schema: { type: 'object' } },
              },
            },
          },
        },
      },
`;

content = content.replace(/(\'\/api\/system\/db-status\': \{[\s\S]*?\},[\s\S]*?\},)/m, `$1\n${subjectsAndOpenApiRoutes}`);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully injected missing endpoints into openapi.json/route.ts');
