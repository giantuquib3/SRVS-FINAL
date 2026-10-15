const fs = require('fs');

// 1. Read existing spec
const content = fs.readFileSync('src/app/api/openapi.json/route.ts', 'utf8');
const specMatch = content.match(/const openApiSpec = (\{[\s\S]*?\n\s*\});/);
if (!specMatch) {
  console.error('Failed to match openApiSpec');
  process.exit(1);
}
const spec = new Function('return ' + specMatch[1])();

const DEPT_ENUM = ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'];
const ROLE_ENUM = ['Admin', 'DepartmentHead', 'Educator', 'Student'];
const STATUS_ENUM = ['Active', 'PendingApproval', 'Rejected', 'Deactivated'];
const SEMESTER_ENUM = ['1st Semester', '2nd Semester', 'Summer'];
const YEAR_LEVEL_ENUM = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

// Helper to ensure parameter exists
function ensureParam(op, param) {
  if (!op.parameters) op.parameters = [];
  const existing = op.parameters.find(p => p.name === param.name && p.in === param.in);
  if (existing) {
    Object.assign(existing, param);
  } else {
    op.parameters.push(param);
  }
}

// Helper to ensure body prop exists
function ensureBodyProp(op, propName, propSchema, required = false) {
  if (!op.requestBody) {
    op.requestBody = {
      required: false,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {},
          },
        },
      },
    };
  }
  const content = op.requestBody.content?.['application/json'];
  if (!content) return;
  if (!content.schema) content.schema = { type: 'object', properties: {} };
  if (!content.schema.properties) content.schema.properties = {};
  content.schema.properties[propName] = propSchema;
  if (required) {
    if (!content.schema.required) content.schema.required = [];
    if (!content.schema.required.includes(propName)) content.schema.required.push(propName);
  }
}

// ─── 1. MISSING ROUTES ────────────────────────────────────────────────────────

// /api/announcements
spec.paths['/api/announcements'] = {
  get: {
    tags: ['9. Notifications & Announcements'],
    summary: 'Retrieve Department Announcements',
    description: 'Fetch announcements surfaced via the notifications channel for the authenticated user.',
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    responses: {
      '200': {
        description: 'Announcements retrieved successfully.',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                announcements: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      title: { type: 'string' },
                      message: { type: 'string' },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '401': { description: 'Unauthorized — active session required.' },
      '500': { description: 'Internal server error.' },
    },
  },
  post: {
    tags: ['9. Notifications & Announcements'],
    summary: 'Create and Broadcast Announcement (Admin / Department Head)',
    description: 'Broadcasts an announcement notification to all active educators and students in the specified department.',
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['title', 'message'],
            properties: {
              title: { type: 'string', example: 'Midterm Syllabus Submission Deadline' },
              message: { type: 'string', example: 'All faculty members must submit course syllabus revisions by Friday.' },
              departmentId: { type: 'string', enum: DEPT_ENUM, example: 'CPE', description: 'Target department ID (defaults to Department Head assigned department).' },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Announcement broadcast successfully.',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Announcement broadcast to 18 department members.' },
                recipientsCount: { type: 'integer', example: 18 },
              },
            },
          },
        },
      },
      '400': { description: 'Validation error: title, message, or departmentId missing.' },
      '403': { description: 'Forbidden — requires Admin or Department Head credentials.' },
      '500': { description: 'Internal server error.' },
    },
  },
};

// /api/notifications
spec.paths['/api/notifications'] = {
  get: {
    tags: ['9. Notifications & Announcements'],
    summary: 'Retrieve User Notifications',
    description: 'Fetch system alerts, syllabus submission/approval notifications, and department announcements for authenticated user.',
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    responses: {
      '200': {
        description: 'Notifications retrieved successfully.',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                notifications: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      title: { type: 'string' },
                      message: { type: 'string' },
                      link: { type: 'string' },
                      read: { type: 'boolean' },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
                unreadCount: { type: 'integer', example: 0 },
              },
            },
          },
        },
      },
      '401': { description: 'Unauthorized.' },
      '500': { description: 'Internal server error.' },
    },
  },
  patch: {
    tags: ['9. Notifications & Announcements'],
    summary: 'Mark Notifications as Read',
    description: 'Marks all unread notifications for the current authenticated user as read.',
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    responses: {
      '200': {
        description: 'Notifications marked as read.',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Notifications marked as read.' },
              },
            },
          },
        },
      },
      '401': { description: 'Unauthorized.' },
      '500': { description: 'Internal server error.' },
    },
  },
};

// /api/openapi.json
spec.paths['/api/openapi.json'] = {
  get: {
    tags: ['8. System & Utilities'],
    summary: 'Retrieve OpenAPI 3.0.3 Specification Document',
    description: 'Returns the full machine-readable OpenAPI 3.0.3 JSON specification detailing all SRVS API routes, schemas, and parameters.',
    responses: {
      '200': {
        description: 'OpenAPI specification document.',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                openapi: { type: 'string', example: '3.0.3' },
                info: { type: 'object' },
                paths: { type: 'object' },
                components: { type: 'object' },
              },
            },
          },
        },
      },
    },
  },
};

// /api/subjects
spec.paths['/api/subjects'] = {
  get: {
    tags: ['4. Courses'],
    summary: 'Curriculum Courses / Subjects List (Legacy Alias)',
    description: 'Legacy curriculum endpoint delegating directly to /api/courses as canonical academic curriculum entities (Requirement 8).',
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    parameters: [
      { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search query for course code or title' },
      { name: 'departmentId', in: 'query', schema: { type: 'string', enum: DEPT_ENUM }, description: 'Department code filter' },
      { name: 'courseId', in: 'query', schema: { type: 'integer' }, description: 'Internal course primary key ID' },
      { name: 'id', in: 'query', schema: { type: 'integer' }, description: 'Course primary key ID (alias of courseId)' },
      { name: 'courseCode', in: 'query', schema: { type: 'string' }, description: 'Institutional course code (e.g. CPE101)' },
      { name: 'semester', in: 'query', schema: { type: 'string', enum: SEMESTER_ENUM }, description: 'Semester filter' },
      { name: 'yearLevel', in: 'query', schema: { type: 'string', enum: YEAR_LEVEL_ENUM }, description: 'Year level filter' },
    ],
    responses: {
      '200': {
        description: 'List of curriculum subjects and courses.',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                courses: { type: 'array', items: { $ref: '#/components/schemas/Course' } },
                subjects: { type: 'array', items: { $ref: '#/components/schemas/Course' } },
                total: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  },
  post: {
    tags: ['4. Courses'],
    summary: 'Create Subject / Course via Legacy Alias',
    description: 'Creates a curriculum course via the legacy subjects route, saving directly to the canonical Course table.',
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['code', 'title'],
            properties: {
              code: { type: 'string', example: 'CPE101' },
              title: { type: 'string', example: 'Computer Engineering as a Discipline' },
              description: { type: 'string' },
              units: { type: 'number', example: 3 },
              lecHours: { type: 'number', example: 3 },
              labHours: { type: 'number', example: 0 },
              prerequisite: { type: 'string', example: 'None' },
              yearLevel: { type: 'string', enum: YEAR_LEVEL_ENUM, example: '1st Year' },
              semester: { type: 'string', enum: SEMESTER_ENUM, example: '1st Semester' },
              departmentId: { type: 'string', enum: DEPT_ENUM, example: 'CPE' },
              professorName: { type: 'string', example: 'Engr. Juan Dela Cruz' },
              facultyName: { type: 'string', example: 'Engr. Juan Dela Cruz' },
            },
          },
        },
      },
    },
    responses: {
      '201': {
        description: 'Subject/Course created successfully.',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                course: { $ref: '#/components/schemas/Course' },
              },
            },
          },
        },
      },
      '400': { description: 'Validation error.' },
      '403': { description: 'Unauthorized.' },
      '409': { description: 'Course code already exists.' },
      '500': { description: 'Internal server error.' },
    },
  },
};

// /api/syllabi/{id}/versions/{version}/submit
spec.paths['/api/syllabi/{id}/versions/{version}/submit'] = {
  post: {
    tags: ['6. Syllabus Management'],
    summary: 'Submit Specific Syllabus Version for Department Review',
    description: 'Transitions a specific draft version of a syllabus into SUBMITTED status and notifies the Department Head.',
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Syllabus primary key record ID' },
      { name: 'version', in: 'path', required: true, schema: { type: 'integer' }, description: 'Version number to submit for review (e.g. 1)' },
    ],
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              remarks: { type: 'string', example: 'Revised learning outcomes aligned with PACUCOA recommendations.' },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Version submitted successfully.',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Syllabus version submitted for department review.' },
                syllabus: { $ref: '#/components/schemas/Syllabus' },
                version: { $ref: '#/components/schemas/SyllabusVersion' },
              },
            },
          },
        },
      },
      '400': { description: 'Version already approved or pending review.' },
      '403': { description: 'Forbidden — only the educator author or assigned department head may submit.' },
      '404': { description: 'Syllabus or version not found.' },
      '500': { description: 'Internal server error.' },
    },
  },
};

// /api/syllabus-approvals/{id}/approve
spec.paths['/api/syllabus-approvals/{id}/approve'] = {
  post: {
    tags: ['7. Syllabus Review & Approval'],
    summary: 'Direct Approve Syllabus Version (Department Head / Admin)',
    description: 'Approves the specified syllabus version, archives prior active versions for this course, marks the syllabus as APPROVED, and notifies the educator.',
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'SyllabusVersion ID or Syllabus ID to approve' },
    ],
    requestBody: {
      required: false,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              comments: { type: 'string', example: 'Approved. Meets all department curriculum objectives.' },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Syllabus version approved successfully.',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string' },
                version: { $ref: '#/components/schemas/SyllabusVersion' },
                syllabus: { $ref: '#/components/schemas/Syllabus' },
              },
            },
          },
        },
      },
      '400': { description: 'Invalid version status or ID.' },
      '403': { description: 'Forbidden — cross-department approval strictly disallowed.' },
      '404': { description: 'Version or syllabus not found.' },
      '500': { description: 'Internal server error.' },
    },
  },
};

// /api/syllabus-approvals/{id}/reject
spec.paths['/api/syllabus-approvals/{id}/reject'] = {
  post: {
    tags: ['7. Syllabus Review & Approval'],
    summary: 'Direct Reject Syllabus Version with Actionable Feedback',
    description: 'Returns the specified syllabus version to the educator author with required revision remarks and feedback (Requirement 11).',
    security: [{ bearerAuth: [] }, { cookieAuth: [] }],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'SyllabusVersion ID or Syllabus ID to reject' },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['rejectionReason'],
            properties: {
              rejectionReason: { type: 'string', example: 'Please update grading rubric for lab components and include textbook 2024 edition.' },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Syllabus returned with revision feedback.',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string' },
                version: { $ref: '#/components/schemas/SyllabusVersion' },
                syllabus: { $ref: '#/components/schemas/Syllabus' },
              },
            },
          },
        },
      },
      '400': { description: 'Rejection reason is required.' },
      '403': { description: 'Forbidden — cross-department rejection strictly disallowed.' },
      '404': { description: 'Version not found.' },
      '500': { description: 'Internal server error.' },
    },
  },
};

// ─── 2. MISSING METHODS ON EXISTING ROUTES ────────────────────────────────────

// /api/courses PUT
spec.paths['/api/courses'].put = {
  tags: ['4. Courses'],
  summary: 'Update Course Curriculum Information',
  description: 'Modifies institutional course curriculum fields such as title, units, lecture/lab hours, prerequisites, year level, semester, and assigned professor.',
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'Internal course primary key ID' },
            courseId: { type: 'integer', description: 'Internal course ID (alias of id)' },
            code: { type: 'string', example: 'CPE101', description: 'Institutional course code' },
            title: { type: 'string', example: 'Computer Engineering as a Discipline' },
            description: { type: 'string', example: 'Updated introductory course description' },
            units: { type: 'number', example: 3 },
            lecHours: { type: 'number', example: 3 },
            labHours: { type: 'number', example: 0 },
            prerequisite: { type: 'string', example: 'None' },
            yearLevel: { type: 'string', enum: YEAR_LEVEL_ENUM, example: '1st Year' },
            semester: { type: 'string', enum: SEMESTER_ENUM, example: '1st Semester' },
            professorName: { type: 'string', example: 'Engr. Juan Dela Cruz' },
            facultyName: { type: 'string', example: 'Engr. Juan Dela Cruz', description: 'Educator name alias' },
          },
        },
      },
    },
  },
  responses: {
    '200': {
      description: 'Course updated successfully.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              course: { $ref: '#/components/schemas/Course' },
            },
          },
        },
      },
    },
    '400': { description: 'Course id or code is required.' },
    '403': { description: 'Unauthorized — Admin or Department Head access required.' },
    '404': { description: 'Course not found.' },
    '500': { description: 'Internal server error.' },
  },
};

// /api/department-head/faculty/{id} GET & PATCH
spec.paths['/api/department-head/faculty/{id}'].get = {
  tags: ['2b. Department Head Administration'],
  summary: 'Retrieve Department Faculty Member by ID',
  description: 'Fetches details of an individual faculty member within the Department Head assigned department.',
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  parameters: [
    { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Faculty 5-digit ID number' },
  ],
  responses: {
    '200': {
      description: 'Faculty details retrieved.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/User' },
            },
          },
        },
      },
    },
    '400': { description: 'Invalid faculty ID.' },
    '403': { description: 'Forbidden — cross-department access prohibited.' },
    '404': { description: 'Faculty member not found.' },
    '500': { description: 'Internal server error.' },
  },
};

spec.paths['/api/department-head/faculty/{id}'].patch = {
  tags: ['2b. Department Head Administration'],
  summary: 'Partial Update Department Faculty Member (PATCH Alias)',
  description: 'Updates faculty profile, academic rank, account status, or resets password with mustChangePassword flag.',
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  parameters: [
    { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Faculty 5-digit institutional ID number' },
  ],
  requestBody: spec.paths['/api/department-head/faculty/{id}'].put.requestBody,
  responses: spec.paths['/api/department-head/faculty/{id}'].put.responses,
};

// /api/department-head/students/{id} GET & PATCH
spec.paths['/api/department-head/students/{id}'].get = {
  tags: ['2b. Department Head Administration'],
  summary: 'Retrieve Department Student by ID',
  description: 'Fetches details of an individual student within the Department Head assigned department.',
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  parameters: [
    { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Student 10-digit ID number' },
  ],
  responses: {
    '200': {
      description: 'Student details retrieved.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/User' },
            },
          },
        },
      },
    },
    '400': { description: 'Invalid student ID.' },
    '403': { description: 'Forbidden — cross-department access prohibited.' },
    '404': { description: 'Student not found.' },
    '500': { description: 'Internal server error.' },
  },
};

spec.paths['/api/department-head/students/{id}'].patch = {
  tags: ['2b. Department Head Administration'],
  summary: 'Partial Update Department Student (PATCH Alias)',
  description: 'Updates student record, year level, degree program, account status, or resets password.',
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  parameters: [
    { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Student 10-digit ID number' },
  ],
  requestBody: spec.paths['/api/department-head/students/{id}'].put.requestBody,
  responses: spec.paths['/api/department-head/students/{id}'].put.responses,
};

// /api/syllabus-approvals PATCH
spec.paths['/api/syllabus-approvals'].patch = {
  tags: ['7. Syllabus Review & Approval'],
  summary: 'Submit Review Action on Syllabus Version (PATCH Alias)',
  description: 'Performs review action (Approve, Reject, or Under_Review) on a submitted syllabus version. Reviewer identity derived from authenticated session.',
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['versionId', 'action'],
          properties: {
            versionId: { type: 'integer', example: 1, description: 'ID of SyllabusVersion record being reviewed' },
            action: { type: 'string', enum: ['Approve', 'Reject', 'Under_Review'], example: 'Approve' },
            remarks: { type: 'string', example: 'Approved for implementation in 1st Semester AY 2024-2025.' },
          },
        },
      },
    },
  },
  responses: {
    '200': {
      description: 'Review decision recorded successfully.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              message: { type: 'string', example: 'Syllabus v1 approved successfully.' },
              status: { type: 'string', example: 'APPROVED' },
            },
          },
        },
      },
    },
    '400': { description: 'Invalid versionId or action.' },
    '403': { description: 'Forbidden — cross-department review prohibited.' },
    '404': { description: 'Syllabus version not found.' },
    '500': { description: 'Internal server error.' },
  },
};

// ─── 3. ENRICH ALL QUERY PARAMETERS ──────────────────────────────────────────

// /api/audit-logs GET
ensureParam(spec.paths['/api/audit-logs'].get, {
  name: 'userId',
  in: 'query',
  schema: { type: 'integer' },
  description: 'Filter logs by acting or target user numeric ID (alias of idNumber)',
});

// /api/courses GET
ensureParam(spec.paths['/api/courses'].get, {
  name: 'id',
  in: 'query',
  schema: { type: 'integer' },
  description: 'Course internal database record ID (alias of courseId)',
});

// /api/courses DELETE
ensureParam(spec.paths['/api/courses'].delete, {
  name: 'id',
  in: 'query',
  schema: { type: 'integer' },
  description: 'Course internal database record ID to delete (alias of courseId)',
});

// /api/department-head/faculty GET
ensureParam(spec.paths['/api/department-head/faculty'].get, {
  name: 'departmentId',
  in: 'query',
  schema: { type: 'string', enum: DEPT_ENUM },
  description: 'Department filter (Administrator use; Department Heads are strictly scoped to their assigned department)',
});

// /api/department-head/pending-users GET
ensureParam(spec.paths['/api/department-head/pending-users'].get, {
  name: 'departmentId',
  in: 'query',
  schema: { type: 'string', enum: DEPT_ENUM },
  description: 'Department filter (Administrator use; Department Heads are strictly scoped to their assigned department)',
});

// /api/department-head/student-registrations GET
ensureParam(spec.paths['/api/department-head/student-registrations'].get, {
  name: 'departmentId',
  in: 'query',
  schema: { type: 'string', enum: DEPT_ENUM },
  description: 'Department filter (Administrator use; Department Heads are strictly scoped to their assigned department)',
});

// /api/department-head/students GET
ensureParam(spec.paths['/api/department-head/students'].get, {
  name: 'departmentId',
  in: 'query',
  schema: { type: 'string', enum: DEPT_ENUM },
  description: 'Department filter (Administrator use; Department Heads are strictly scoped to their assigned department)',
});

// /api/enrollments GET
ensureParam(spec.paths['/api/enrollments'].get, {
  name: 'idNumber',
  in: 'query',
  schema: { type: 'integer' },
  description: 'Student institutional ID number filter (alias of studentId)',
});
ensureParam(spec.paths['/api/enrollments'].get, {
  name: 'courseCode',
  in: 'query',
  schema: { type: 'string' },
  description: 'Institutional course code filter (e.g. CPE101)',
});

// /api/enrollments DELETE
ensureParam(spec.paths['/api/enrollments'].delete, {
  name: 'id',
  in: 'query',
  schema: { type: 'string' },
  description: 'Composite enrollment record key formatted as {studentId}_{courseId}',
});
ensureParam(spec.paths['/api/enrollments'].delete, {
  name: 'idNumber',
  in: 'query',
  schema: { type: 'integer' },
  description: 'Student institutional ID number',
});
ensureParam(spec.paths['/api/enrollments'].delete, {
  name: 'courseCode',
  in: 'query',
  schema: { type: 'string' },
  description: 'Course institutional code to unenroll student from (e.g. CPE101)',
});

// /api/students GET
ensureParam(spec.paths['/api/students'].get, {
  name: 'department',
  in: 'query',
  schema: { type: 'string', enum: DEPT_ENUM },
  description: 'Department code filter (alias of departmentId)',
});
ensureParam(spec.paths['/api/students'].get, {
  name: 'userId',
  in: 'query',
  schema: { type: 'integer' },
  description: 'Student ID filter (alias of studentId / idNumber)',
});
ensureParam(spec.paths['/api/students'].get, {
  name: 'id',
  in: 'query',
  schema: { type: 'integer' },
  description: 'Student primary key ID filter (alias of studentId / idNumber)',
});

// /api/syllabi GET
ensureParam(spec.paths['/api/syllabi'].get, {
  name: 'semester',
  in: 'query',
  schema: { type: 'string', enum: SEMESTER_ENUM },
  description: 'Filter syllabi by academic semester',
});
ensureParam(spec.paths['/api/syllabi'].get, {
  name: 'academicYear',
  in: 'query',
  schema: { type: 'string' },
  description: 'Filter syllabi by academic year (e.g. 2024-2025)',
});
ensureParam(spec.paths['/api/syllabi'].get, {
  name: 'search',
  in: 'query',
  schema: { type: 'string' },
  description: 'Search string matching course code, course title, or instructor name',
});
ensureParam(spec.paths['/api/syllabi'].get, {
  name: 'id',
  in: 'query',
  schema: { type: 'integer' },
  description: 'Course internal database ID filter (alias of courseId)',
});
ensureParam(spec.paths['/api/syllabi'].get, {
  name: 'idNumber',
  in: 'query',
  schema: { type: 'integer' },
  description: 'Instructor ID number filter (alias of instructorId)',
});

// /api/syllabus-approvals GET
ensureParam(spec.paths['/api/syllabus-approvals'].get, {
  name: 'instructorId',
  in: 'query',
  schema: { type: 'integer' },
  description: 'Filter approval requests by instructor ID number',
});
ensureParam(spec.paths['/api/syllabus-approvals'].get, {
  name: 'idNumber',
  in: 'query',
  schema: { type: 'integer' },
  description: 'Filter approval requests by instructor ID number (alias of instructorId)',
});
ensureParam(spec.paths['/api/syllabus-approvals'].get, {
  name: 'syllabusId',
  in: 'query',
  schema: { type: 'integer' },
  description: 'Filter approval requests by parent syllabus record ID',
});

// /api/users GET
ensureParam(spec.paths['/api/users'].get, {
  name: 'departmentCode',
  in: 'query',
  schema: { type: 'string', enum: DEPT_ENUM },
  description: 'Filter directory by department code (alias of departmentId)',
});
ensureParam(spec.paths['/api/users'].get, {
  name: 'userId',
  in: 'query',
  schema: { type: 'integer' },
  description: 'Filter directory by user numeric ID (alias of idNumber)',
});
ensureParam(spec.paths['/api/users'].get, {
  name: 'id',
  in: 'query',
  schema: { type: 'integer' },
  description: 'Filter directory by user numeric ID (alias of idNumber)',
});

// /api/users DELETE
ensureParam(spec.paths['/api/users'].delete, {
  name: 'userId',
  in: 'query',
  schema: { type: 'integer' },
  description: 'Numeric user ID to deactivate (alias of idNumber)',
});
ensureParam(spec.paths['/api/users'].delete, {
  name: 'id',
  in: 'query',
  schema: { type: 'integer' },
  description: 'Numeric user ID to deactivate (alias of idNumber)',
});

// ─── 4. ENRICH ALL REQUEST BODY SCHEMAS ───────────────────────────────────────

// /api/auth/login POST
ensureBodyProp(spec.paths['/api/auth/login'].post, 'username', {
  type: 'string',
  example: '2022012708',
  description: 'User login ID identifier (alias of idNumber / email)',
});
ensureBodyProp(spec.paths['/api/auth/login'].post, 'email', {
  type: 'string',
  format: 'email',
  example: 'user@usjr.edu.ph',
  description: 'Alternative login institutional email',
});

// /api/auth/forgot-password POST
ensureBodyProp(spec.paths['/api/auth/forgot-password'].post, 'confirmPassword', {
  type: 'string',
  example: 'NewPass2026!',
  description: 'Password confirmation matching newPassword',
});

// /api/auth/logout POST
if (!spec.paths['/api/auth/logout'].post.requestBody) {
  spec.paths['/api/auth/logout'].post.requestBody = {
    required: false,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            reason: { type: 'string', example: 'User clicked logout button' },
          },
        },
      },
    },
  };
}

// /api/auth/register POST
ensureBodyProp(spec.paths['/api/auth/register'].post, 'username', { type: 'string', description: 'Institutional ID number alias' });
ensureBodyProp(spec.paths['/api/auth/register'].post, 'employeeId', { type: 'string', example: '10001', description: '5-digit Faculty ID number alias' });
ensureBodyProp(spec.paths['/api/auth/register'].post, 'studentId', { type: 'string', example: '2022012708', description: '10-digit Student ID number alias' });
ensureBodyProp(spec.paths['/api/auth/register'].post, 'fullName', { type: 'string', example: 'Gian Tuquib', description: 'Full legal name' });
ensureBodyProp(spec.paths['/api/auth/register'].post, 'firstName', { type: 'string', example: 'Gian' });
ensureBodyProp(spec.paths['/api/auth/register'].post, 'lastName', { type: 'string', example: 'Tuquib' });
ensureBodyProp(spec.paths['/api/auth/register'].post, 'program', { type: 'string', example: 'BS Computer Engineering', description: 'Academic degree program for students' });
ensureBodyProp(spec.paths['/api/auth/register'].post, 'yearLevel', { type: 'string', enum: YEAR_LEVEL_ENUM, example: '1st Year' });
ensureBodyProp(spec.paths['/api/auth/register'].post, 'academicRank', { type: 'string', example: 'Faculty Member', description: 'Academic rank for educators' });

// /api/auth/register/student POST
ensureBodyProp(spec.paths['/api/auth/register/student'].post, 'studentId', { type: 'string', example: '2022012708', description: '10-digit Student ID alias' });
ensureBodyProp(spec.paths['/api/auth/register/student'].post, 'username', { type: 'string', example: '2022012708', description: 'Student ID alias' });
ensureBodyProp(spec.paths['/api/auth/register/student'].post, 'firstName', { type: 'string', example: 'Gian' });
ensureBodyProp(spec.paths['/api/auth/register/student'].post, 'lastName', { type: 'string', example: 'Tuquib' });
ensureBodyProp(spec.paths['/api/auth/register/student'].post, 'program', { type: 'string', example: 'BS Computer Engineering' });
ensureBodyProp(spec.paths['/api/auth/register/student'].post, 'yearLevel', { type: 'string', enum: YEAR_LEVEL_ENUM, example: '1st Year' });

// /api/auth/register/faculty POST
ensureBodyProp(spec.paths['/api/auth/register/faculty'].post, 'employeeId', { type: 'string', example: '10001', description: '5-digit Faculty ID alias' });
ensureBodyProp(spec.paths['/api/auth/register/faculty'].post, 'username', { type: 'string', example: '10001', description: 'Faculty ID alias' });
ensureBodyProp(spec.paths['/api/auth/register/faculty'].post, 'firstName', { type: 'string', example: 'Gian' });
ensureBodyProp(spec.paths['/api/auth/register/faculty'].post, 'lastName', { type: 'string', example: 'Tuquib' });
ensureBodyProp(spec.paths['/api/auth/register/faculty'].post, 'academicRank', { type: 'string', example: 'Assistant Professor' });

// /api/courses POST
ensureBodyProp(spec.paths['/api/courses'].post, 'facultyName', { type: 'string', example: 'Engr. Juan Dela Cruz', description: 'Educator full name (alias of professorName)' });

// /api/department-head/faculty POST
ensureBodyProp(spec.paths['/api/department-head/faculty'].post, 'userId', { type: 'integer', example: 10001, description: 'Faculty 5-digit ID (alias of idNumber)' });
ensureBodyProp(spec.paths['/api/department-head/faculty'].post, 'departmentId', { type: 'string', enum: DEPT_ENUM, example: 'CPE', description: 'Department code' });
ensureBodyProp(spec.paths['/api/department-head/faculty'].post, 'accountStatus', { type: 'string', enum: STATUS_ENUM, example: 'Active' });

// /api/department-head/students POST
ensureBodyProp(spec.paths['/api/department-head/students'].post, 'studentId', { type: 'integer', example: 2022012708, description: 'Student 10-digit ID (alias of idNumber)' });
ensureBodyProp(spec.paths['/api/department-head/students'].post, 'userId', { type: 'integer', example: 2022012708, description: 'Student 10-digit ID (alias of idNumber)' });
ensureBodyProp(spec.paths['/api/department-head/students'].post, 'departmentId', { type: 'string', enum: DEPT_ENUM, example: 'CPE' });
ensureBodyProp(spec.paths['/api/department-head/students'].post, 'accountStatus', { type: 'string', enum: STATUS_ENUM, example: 'Active' });
ensureBodyProp(spec.paths['/api/department-head/students'].post, 'program', { type: 'string', example: 'BS Computer Engineering' });

// /api/department-head/student-registrations/{id}/reject POST
ensureBodyProp(spec.paths['/api/department-head/student-registrations/{id}/reject'].post, 'reason', { type: 'string', example: 'Unverified enrolled ID number.' });
ensureBodyProp(spec.paths['/api/department-head/student-registrations/{id}/reject'].post, 'rejectionReason', { type: 'string', example: 'Unverified enrolled ID number.' });

// /api/department-head/users/{id}/reject POST
ensureBodyProp(spec.paths['/api/department-head/users/{id}/reject'].post, 'reason', { type: 'string', example: 'Applicant does not belong to this department.' });

// /api/syllabi POST
ensureBodyProp(spec.paths['/api/syllabi'].post, 'topics', { type: 'array', items: { type: 'string' }, description: 'Course weekly modules and lecture topics' });
ensureBodyProp(spec.paths['/api/syllabi'].post, 'references', { type: 'array', items: { type: 'string' }, description: 'Course references and textbooks' });
ensureBodyProp(spec.paths['/api/syllabi'].post, 'gradingSystem', { type: 'array', items: { type: 'string' }, description: 'Grading scale and assessment weight breakdown' });
ensureBodyProp(spec.paths['/api/syllabi'].post, 'schedule', { type: 'string', example: 'MWF 08:00 - 09:30 AM', description: 'Class meeting schedule' });
ensureBodyProp(spec.paths['/api/syllabi'].post, 'instructorId', { type: 'integer', description: 'Assigned instructor numeric ID (for Department Head creations)' });

// /api/syllabi/{id} PATCH
ensureBodyProp(spec.paths['/api/syllabi/{id}'].patch, 'topics', { type: 'array', items: { type: 'string' } });
ensureBodyProp(spec.paths['/api/syllabi/{id}'].patch, 'references', { type: 'array', items: { type: 'string' } });
ensureBodyProp(spec.paths['/api/syllabi/{id}'].patch, 'gradingSystem', { type: 'array', items: { type: 'string' } });
ensureBodyProp(spec.paths['/api/syllabi/{id}'].patch, 'schedule', { type: 'string', example: 'TTh 01:30 - 03:00 PM' });
ensureBodyProp(spec.paths['/api/syllabi/{id}'].patch, 'fileName', { type: 'string', example: 'CPE101_Syllabus_Rev2.pdf' });
ensureBodyProp(spec.paths['/api/syllabi/{id}'].patch, 'fileUrl', { type: 'string', example: '/uploads/syllabi/CPE101_Rev2.pdf' });
ensureBodyProp(spec.paths['/api/syllabi/{id}'].patch, 'fileType', { type: 'string', enum: ['PDF'], example: 'PDF' });
ensureBodyProp(spec.paths['/api/syllabi/{id}'].patch, 'fileSize', { type: 'integer', example: 1048576 });
ensureBodyProp(spec.paths['/api/syllabi/{id}'].patch, 'saveAsDraft', { type: 'boolean', example: false });
ensureBodyProp(spec.paths['/api/syllabi/{id}'].patch, 'submitForApproval', { type: 'boolean', example: true });

// Copy PATCH body to PUT on /api/syllabi/{id}
if (spec.paths['/api/syllabi/{id}'].put) {
  spec.paths['/api/syllabi/{id}'].put.requestBody = spec.paths['/api/syllabi/{id}'].patch.requestBody;
}

// /api/syllabi/{id}/submit POST
if (!spec.paths['/api/syllabi/{id}/submit'].post.requestBody) {
  spec.paths['/api/syllabi/{id}/submit'].post.requestBody = {
    required: false,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            notes: { type: 'string', example: 'Ready for Chairperson review.' },
          },
        },
      },
    },
  };
}

// /api/syllabus-approvals POST
ensureBodyProp(spec.paths['/api/syllabus-approvals'].post, 'versionId', { type: 'integer', example: 1, description: 'ID of SyllabusVersion record' }, true);
ensureBodyProp(spec.paths['/api/syllabus-approvals'].post, 'action', { type: 'string', enum: ['Approve', 'Reject', 'Under_Review'], example: 'Approve' }, true);
ensureBodyProp(spec.paths['/api/syllabus-approvals'].post, 'remarks', { type: 'string', example: 'Approved by Department Head' });

// /api/users POST
ensureBodyProp(spec.paths['/api/users'].post, 'userId', { type: 'integer', example: 10001, description: 'User ID (alias of idNumber)' });
ensureBodyProp(spec.paths['/api/users'].post, 'academicRank', { type: 'string', example: 'Department Chairperson' });
ensureBodyProp(spec.paths['/api/users'].post, 'yearLevel', { type: 'string', enum: YEAR_LEVEL_ENUM, example: '1st Year' });
ensureBodyProp(spec.paths['/api/users'].post, 'program', { type: 'string', example: 'BS Computer Engineering' });

// /api/users PATCH
ensureBodyProp(spec.paths['/api/users'].patch, 'userId', { type: 'integer', example: 10001, description: 'Target user numeric ID (alias of idNumber)' });
ensureBodyProp(spec.paths['/api/users'].patch, 'newRole', { type: 'string', enum: ROLE_ENUM, example: 'DepartmentHead', description: 'Updated user role' });
ensureBodyProp(spec.paths['/api/users'].patch, 'fullName', { type: 'string', example: 'Gian Tuquib' });
ensureBodyProp(spec.paths['/api/users'].patch, 'academicRank', { type: 'string', example: 'Associate Professor' });
ensureBodyProp(spec.paths['/api/users'].patch, 'yearLevel', { type: 'string', enum: YEAR_LEVEL_ENUM, example: '2nd Year' });
ensureBodyProp(spec.paths['/api/users'].patch, 'program', { type: 'string', example: 'BS Computer Engineering' });
ensureBodyProp(spec.paths['/api/users'].patch, 'reason', { type: 'string', example: 'Administrative account update' });
ensureBodyProp(spec.paths['/api/users'].patch, 'rejectionReason', { type: 'string', example: 'Incomplete documentation' });

spec.servers = [
  { url: '/', description: 'Current Environment (Same-Origin Relative)' },
  { url: 'http://localhost:3000', description: 'Local Dev Server (Port 3000)' },
  { url: 'http://127.0.0.1:3000', description: 'Loopback (127.0.0.1:3000)' },
];

// ─── 5. WRITE OUT UPDATED FILE ────────────────────────────────────────────────
const serializedSpec = JSON.stringify(spec, null, 2);

const outputContent = `import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const currentOrigin = new URL(req.url).origin;
  const specClone = {
    ...openApiSpec,
    servers: [
      { url: currentOrigin, description: \`Active Origin (\${currentOrigin})\` },
      { url: '/', description: 'Relative (Same-Origin)' },
      { url: 'http://localhost:3000', description: 'Local Dev Server (Port 3000)' },
      { url: 'http://127.0.0.1:3000', description: 'Loopback (127.0.0.1:3000)' },
    ],
  };

  const originHeader = req.headers.get('origin') || '*';

  return NextResponse.json(specClone, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'Access-Control-Allow-Origin': originHeader,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}

const openApiSpec = ${serializedSpec};
`;

fs.writeFileSync('src/app/api/openapi.json/route.ts', outputContent, 'utf8');
console.log('Successfully written enriched OpenAPI spec to src/app/api/openapi.json/route.ts!');
console.log(`Updated paths count: ${Object.keys(spec.paths).length}`);
