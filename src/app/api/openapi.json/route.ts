import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'USJ-R SRVS API Documentation — Role & Permission Specifications',
      version: '1.1.0',
      description: `
# University of San Jose - Recoletos (USJ-R)
### Syllabus Repository, Revision and Versioning System (SRVS)

This API documentation is organized by **User Roles and Permissions** matching institutional workflows:

1. **User Authentication & Identity**: Registration, login, JWT token management, account status lifecycle, and password hashing.
2. **System Administrator**: Full system control, account creation, registration approvals, department management, and security audit logs.
3. **Department Head**: Departmental curriculum management, course catalogs, student enrollment approvals, syllabus reviews, and announcements.
4. **Educator (Faculty)**: Course syllabus drafting, non-destructive sequential versioning, version history diffs, and rollback restoration.
5. **Student**: Enrolled course access, viewing approved current syllabus versions, notifications, and departmental announcements.
6. **System & Database Health**: PostgreSQL connection latency, live table counts, and database engine diagnostics.
      `.trim(),
      contact: {
        name: 'USJ-R SRVS System Administrator',
        email: 'admin@srvs.local',
      },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local Server (Port 3000)' },
      { url: 'http://localhost:3001', description: 'Local Server (Port 3001)' },
    ],
    tags: [
      {
        name: '1. User Authentication & Identity',
        description: 'User registration, login, logout, password hashing, and account status checking (Pending, Approved, Rejected).',
      },
      {
        name: '2. Role: System Administrator',
        description: 'Manage user accounts, approve Department Head registrations, manage departments, and inspect system audit logs.',
      },
      {
        name: '3. Role: Department Head',
        description: 'Manage department courses, approve Educator & Student registrations, manage enrollments, review syllabi, and broadcast announcements.',
      },
      {
        name: '4. Role: Educator (Faculty)',
        description: 'Create syllabi, edit syllabi with mandatory change summaries, increment immutable version snapshots, and restore older versions.',
      },
      {
        name: '5. Role: Student',
        description: 'View enrolled courses, access current approved syllabus versions, and receive departmental announcements.',
      },
      {
        name: '6. System & PostgreSQL Database',
        description: 'PostgreSQL database connectivity, schema table counts, and real-time latency monitoring.',
      },
      {
        name: 'Syllabus Submission',
        description: 'Endpoints for Faculty / Educators to upload documents (PDF, DOC, DOCX) and submit syllabi and revisions for Department Head approval.',
      },
      {
        name: 'Syllabus Approval',
        description: 'Endpoints for Department Heads to query department-scoped pending approval requests, review approval details, approve syllabus versions, and reject syllabus versions with mandatory reasons.',
      },
      {
        name: 'Syllabus Review',
        description: 'Inspection of submitted syllabus versions, side-by-side comparison with previous approved versions, document attachments, and self-approval prevention enforcement.',
      },
    ],
    paths: {
      // =========================================================================
      // 1. USER AUTHENTICATION & IDENTITY
      // =========================================================================
      '/api/auth/register': {
        post: {
          tags: ['1. User Authentication & Identity'],
          summary: 'User Registration (Self-Service)',
          description: `
Registers a new user account with strict ID Number format enforcement:
- **Student**: Requires exactly **10 digits** (e.g., \`2022012708\`)
- **Educator (Faculty)**: Requires exactly **5 digits** (e.g., \`10001\`)
Passwords are automatically hashed using **bcrypt** (salt rounds: 10).
New accounts default to **PendingApproval** status awaiting review.
          `.trim(),
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['firstName', 'lastName', 'username', 'email', 'password', 'role', 'departmentId'],
                  properties: {
                    firstName: { type: 'string', example: 'Gian' },
                    lastName: { type: 'string', example: 'Carlo' },
                    username: {
                      type: 'string',
                      example: '2022012708',
                      description: 'University ID Number: 10 digits for Student, 5 digits for Educator',
                    },
                    email: { type: 'string', format: 'email', example: 'gian@usjr.edu.ph' },
                    password: { type: 'string', minLength: 6, example: 'Password123!' },
                    role: { type: 'string', enum: ['Student', 'Educator'], example: 'Student' },
                    departmentId: { type: 'string', description: 'Department ID from /api/departments' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Registration submitted successfully (Status: PendingApproval)' },
            400: { description: 'Invalid input or invalid ID number digit count' },
            409: { description: 'Account with this ID number or email already exists' },
          },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['1. User Authentication & Identity'],
          summary: 'User Sign In (ID Number & Password)',
          description: `
Authenticates a user via their **University ID Number** (username) and password:
- Validates 5 digits (Faculty/Admin) or 10 digits (Students)
- Compares password against bcrypt hash in PostgreSQL
- Checks account status (blocks \`PendingApproval\`, \`Rejected\`, \`Deactivated\`)
- Issues signed JWT session token stored in an **HTTP-only, Secure cookie** (\`srvs_token\`)
          `.trim(),
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['username', 'password'],
                  properties: {
                    username: {
                      type: 'string',
                      example: '00000',
                      description: '5-digit ID (Admin/Faculty/Dept Head) or 10-digit ID (Student)',
                    },
                    password: { type: 'string', format: 'password', example: 'admin123' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Successful authentication; returns session user and sets cookie',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          username: { type: 'string', example: '00000' },
                          email: { type: 'string', example: 'admin@srvs.local' },
                          fullName: { type: 'string', example: 'System Administrator' },
                          role: { type: 'string', enum: ['Admin', 'DepartmentHead', 'Educator', 'Student'] },
                          departmentName: { type: 'string', example: 'Computer Engineering' },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { description: 'Missing credentials or invalid ID number format' },
            401: { description: 'Invalid username or password' },
            403: { description: 'Account pending approval or deactivated' },
          },
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['1. User Authentication & Identity'],
          summary: 'Check Current Session & Account Status',
          description: 'Validates JWT token and returns the current user profile, role permissions, and department info.',
          responses: {
            200: { description: 'Active authenticated session profile' },
            401: { description: 'Unauthenticated or expired token' },
          },
        },
      },
      '/api/auth/logout': {
        post: {
          tags: ['1. User Authentication & Identity'],
          summary: 'User Sign Out',
          description: 'Clears the authentication session cookie and logs out the user.',
          responses: {
            200: { description: 'Logged out successfully' },
          },
        },
      },

      // =========================================================================
      // 2. ROLE: SYSTEM ADMINISTRATOR
      // =========================================================================
      '/api/users': {
        get: {
          tags: ['2. Role: System Administrator'],
          summary: 'Manage Users: Query All Accounts',
          description: 'System Administrator lists all users with filtering by role, status, or search term (name/email/ID number).',
          parameters: [
            { name: 'role', in: 'query', schema: { type: 'string', enum: ['Admin', 'DepartmentHead', 'Educator', 'Student'] } },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['Active', 'PendingApproval', 'Rejected', 'Deactivated'] } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'List of user accounts' },
            403: { description: 'Unauthorized' },
          },
        },
        post: {
          tags: ['2. Role: System Administrator'],
          summary: 'Manage Users: Create User Account',
          description: 'Administrator creates a user account with role-enforced University ID Number (5 digits for Staff/Admin, 10 digits for Student).',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['fullName', 'username', 'email', 'password', 'role'],
                  properties: {
                    fullName: { type: 'string', example: 'Engr. Juan Dela Cruz' },
                    username: { type: 'string', example: '10001', description: '5 digits for Staff/Admin, 10 digits for Student' },
                    email: { type: 'string', format: 'email', example: 'jdelacruz@usjr.edu.ph' },
                    password: { type: 'string', minLength: 6, example: 'TempPass123!' },
                    role: { type: 'string', enum: ['Admin', 'DepartmentHead', 'Educator', 'Student'] },
                    departmentId: { type: 'string', nullable: true },
                    accountStatus: { type: 'string', enum: ['Active', 'PendingApproval', 'Deactivated'], default: 'Active' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'User account created' },
            400: { description: 'Validation error or duplicate ID number' },
            403: { description: 'Forbidden' },
          },
        },
        patch: {
          tags: ['2. Role: System Administrator'],
          summary: 'Manage Users: Update Role & Approve/Reject Status',
          description: 'Approve or reject Department Head registrations, modify system roles, or activate/deactivate accounts.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userId'],
                  properties: {
                    userId: { type: 'string' },
                    role: { type: 'string', enum: ['Admin', 'DepartmentHead', 'Educator', 'Student'] },
                    accountStatus: { type: 'string', enum: ['Active', 'PendingApproval', 'Rejected', 'Deactivated'] },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'User account updated successfully' },
            403: { description: 'Forbidden' },
          },
        },
      },
      '/api/departments': {
        get: {
          tags: ['2. Role: System Administrator'],
          summary: 'Manage Engineering Departments',
          description: 'List the 6 institutional engineering departments (CE, CPE, ECE, EE, IE, ME) and course counts.',
          responses: {
            200: { description: 'List of departments' },
          },
        },
      },
      '/api/audit-logs': {
        get: {
          tags: ['2. Role: System Administrator'],
          summary: 'View System-Wide Audit Logs',
          description: 'Inspect complete system activity and security log entries recording all logins, creations, revisions, and status changes.',
          parameters: [
            { name: 'actionType', in: 'query', schema: { type: 'string' } },
            { name: 'resultStatus', in: 'query', schema: { type: 'string' } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'Audit trail records' },
            403: { description: 'Unauthorized' },
          },
        },
      },
      '/api/dashboard/stats': {
        get: {
          tags: ['2. Role: System Administrator'],
          summary: 'Monitor System Activity & Analytics',
          description: 'Live real-time statistics computed directly from PostgreSQL for users, pending approvals, syllabi, and versions.',
          responses: {
            200: { description: 'System metrics' },
          },
        },
      },

      // =========================================================================
      // 3. ROLE: DEPARTMENT HEAD
      // =========================================================================
      '/api/courses': {
        get: {
          tags: ['3. Role: Department Head'],
          summary: 'View Department Courses Catalog',
          parameters: [
            { name: 'departmentId', in: 'query', schema: { type: 'string' } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'List of courses' },
          },
        },
        post: {
          tags: ['3. Role: Department Head'],
          summary: 'Create Course in Department',
          description: 'Department Head creates a new course/subject with unique course code validation.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['code', 'title', 'departmentId'],
                  properties: {
                    code: { type: 'string', example: 'CPE301' },
                    title: { type: 'string', example: 'Operating Systems' },
                    description: { type: 'string', example: 'Operating system structures, process scheduling, and concurrency.' },
                    units: { type: 'integer', example: 3, default: 3 },
                    lecHours: { type: 'integer', example: 3, default: 3 },
                    labHours: { type: 'integer', example: 0, default: 0 },
                    prerequisite: { type: 'string', example: 'CPE201', default: 'None' },
                    yearLevel: { type: 'string', example: '2nd Year', default: '1st Year' },
                    semester: { type: 'string', example: '1st Semester', default: '1st Semester' },
                    departmentId: { type: 'string', example: 'CPE' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Course created' },
            400: { description: 'Duplicate course code or invalid fields' },
          },
        },
      },
      '/api/subjects': {
        get: {
          tags: ['3. Role: Department Head'],
          summary: 'View Department Subjects Catalog',
          description: 'Query curriculum subjects with academic metadata including credit units, lecture hours, lab hours, and prerequisites.',
          parameters: [
            { name: 'departmentId', in: 'query', schema: { type: 'string' } },
            { name: 'yearLevel', in: 'query', schema: { type: 'string', enum: ['1st Year', '2nd Year', '3rd Year', '4th Year'] } },
            { name: 'semester', in: 'query', schema: { type: 'string', enum: ['1st Semester', '2nd Semester', 'Summer Term'] } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'List of academic subjects with full curriculum parameters' },
          },
        },
        post: {
          tags: ['3. Role: Department Head'],
          summary: 'Create Subject in Curriculum',
          description: 'Department Head or Administrator creates a new academic subject with units, contact hours, and prerequisites.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['code', 'title', 'departmentId'],
                  properties: {
                    code: { type: 'string', example: 'CPE102' },
                    title: { type: 'string', example: 'Computer Programming 1' },
                    description: { type: 'string', example: 'Fundamental concepts of programming and structured algorithms.' },
                    units: { type: 'integer', example: 3, default: 3 },
                    lecHours: { type: 'integer', example: 2, default: 3 },
                    labHours: { type: 'integer', example: 3, default: 0 },
                    prerequisite: { type: 'string', example: 'None', default: 'None' },
                    yearLevel: { type: 'string', example: '1st Year', default: '1st Year' },
                    semester: { type: 'string', example: '1st Semester', default: '1st Semester' },
                    departmentId: { type: 'string', example: 'CPE' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Subject created successfully' },
            400: { description: 'Validation error or duplicate subject code' },
          },
        },
      },
      '/api/enrollments': {
        get: {
          tags: ['3. Role: Department Head'],
          summary: 'Manage Student Enrollments: List All',
          parameters: [
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'semester', in: 'query', schema: { type: 'string' } },
            { name: 'academicYear', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'List of enrollments with student and course details' },
          },
        },
        post: {
          tags: ['3. Role: Department Head'],
          summary: 'Manage Student Enrollments: Enroll Student in Course',
          description: 'Enrolls a student in a course subject with duplicate prevention.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['studentId', 'courseId', 'semester', 'academicYear'],
                  properties: {
                    studentId: { type: 'string' },
                    courseId: { type: 'string' },
                    semester: { type: 'string', example: '1st Semester' },
                    academicYear: { type: 'string', example: '2026-2027' },
                    section: { type: 'string', default: 'A' },
                    status: { type: 'string', default: 'ENROLLED' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Student enrolled' },
            409: { description: 'Student already enrolled in this course for this term' },
          },
        },
      },
      '/api/syllabi/{id}/review': {
        post: {
          tags: ['3. Role: Department Head'],
          summary: 'Review Syllabus: Approve or Reject',
          description: 'Department Head reviews submitted syllabus and updates status to Approved or Rejected with feedback remarks.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['action'],
                  properties: {
                    action: { type: 'string', enum: ['Approve', 'Reject'] },
                    reviewerRemarks: { type: 'string', example: 'Approved. Meets USJ-R curriculum standards.' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Syllabus reviewed successfully; instructor notified' },
          },
        },
      },
      '/api/announcements': {
        get: {
          tags: ['3. Role: Department Head'],
          summary: 'View Department Announcements',
          description: 'Retrieves announcements broadcasted to department faculty and students.',
          responses: {
            200: { description: 'List of department announcements' },
          },
        },
        post: {
          tags: ['3. Role: Department Head'],
          summary: 'Create & Broadcast Department Announcement',
          description: 'Department Head broadcasts an announcement alert to all educators and students in their department.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title', 'message'],
                  properties: {
                    title: { type: 'string', example: 'Syllabus Submission Deadline for 1st Semester' },
                    message: { type: 'string', example: 'All faculty members must submit syllabi for review by Friday.' },
                    departmentId: { type: 'string', description: 'Defaults to Department Head department' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Announcement broadcasted to all department members' },
            403: { description: 'Forbidden' },
          },
        },
      },

      // =========================================================================
      // 4. ROLE: EDUCATOR (FACULTY)
      // =========================================================================
      '/api/syllabi': {
        get: {
          tags: ['4. Role: Educator (Faculty)'],
          summary: 'View Syllabi List',
          description: 'Educator views their created syllabi and department syllabi.',
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['Draft', 'Submitted', 'Approved', 'Rejected'] } },
            { name: 'departmentId', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'List of syllabi' },
          },
        },
        post: {
          tags: ['4. Role: Educator (Faculty)'],
          summary: 'Create Syllabus + Version 1 Snapshot',
          description: 'Educator creates a new syllabus. Creates master record and initial Version 1 snapshot in a PostgreSQL atomic transaction.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['courseId', 'academicYear', 'semester'],
                  properties: {
                    courseId: { type: 'string', example: 'CPE101' },
                    subjectId: { type: 'string', example: 'CPE101' },
                    academicYear: { type: 'string', example: '2026-2027' },
                    semester: { type: 'string', example: '1st Semester' },
                    section: { type: 'string', example: 'A', default: 'A' },
                    courseDescription: { type: 'string', example: 'Foundations of computer engineering and digital logic.' },
                    learningOutcomes: { type: 'array', items: { type: 'string' } },
                    topics: { type: 'array', items: { type: 'object', properties: { week: { type: 'number' }, topic: { type: 'string' } } } },
                    gradingSystem: { type: 'array', items: { type: 'object', properties: { component: { type: 'string' }, weight: { type: 'number' } } } },
                    references: { type: 'array', items: { type: 'string' } },
                    schedule: { type: 'string', example: 'MWF 09:00 AM - 10:00 AM' },
                    fileName: { type: 'string', example: 'CPE101_Syllabus.pdf' },
                    fileUrl: { type: 'string', example: '/uploads/syllabi/CPE101_Syllabus.pdf' },
                    fileType: { type: 'string', example: 'PDF' },
                    fileSize: { type: 'integer', example: 2048576 },
                    saveAsDraft: { type: 'boolean', default: true },
                    directApprove: { type: 'boolean', default: false, description: 'Direct approval for Department Heads' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Syllabus and Version 1 created (recorded with uploadedByUserId)' },
          },
        },
      },
      '/api/syllabi/{id}': {
        get: {
          tags: ['4. Role: Educator (Faculty)'],
          summary: 'View Syllabus Details and Active Version',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Syllabus details, subject data, authoring info, and current version snapshot content' },
            404: { description: 'Syllabus not found' },
          },
        },
        patch: {
          tags: ['4. Role: Educator (Faculty)'],
          summary: 'Edit Syllabus: Create New Version Snapshot',
          description: 'Non-destructively saves modifications by creating a new sequential version snapshot with a mandatory change summary.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['changeSummary'],
                  properties: {
                    changeSummary: { type: 'string', example: 'Updated Week 4 laboratory topics and modified grading criteria.' },
                    courseDescription: { type: 'string' },
                    learningOutcomes: { type: 'array', items: { type: 'string' } },
                    topics: { type: 'array', items: { type: 'object', properties: { week: { type: 'number' }, topic: { type: 'string' } } } },
                    gradingSystem: { type: 'array', items: { type: 'object', properties: { component: { type: 'string' }, weight: { type: 'number' } } } },
                    references: { type: 'array', items: { type: 'string' } },
                    schedule: { type: 'string' },
                    fileName: { type: 'string' },
                    fileUrl: { type: 'string' },
                    fileType: { type: 'string' },
                    fileSize: { type: 'integer' },
                    saveAsDraft: { type: 'boolean', default: false },
                    directApprove: { type: 'boolean', default: false },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'New version snapshot created' },
            400: { description: 'Missing change summary or content' },
          },
        },
      },
      '/api/syllabi/{id}/submit': {
        post: {
          tags: ['4. Role: Educator (Faculty)'],
          summary: 'Submit Syllabus for Department Review',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Status updated to Submitted; Department Head notified' },
          },
        },
      },
      '/api/syllabi/{id}/versions': {
        get: {
          tags: ['4. Role: Educator (Faculty)'],
          summary: 'View Version History & Compare Versions',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Chronological list of all immutable version snapshots' },
          },
        },
      },
      '/api/syllabi/{id}/restore': {
        post: {
          tags: ['4. Role: Educator (Faculty)'],
          summary: 'Restore Older Syllabus Version',
          description: 'Safe rollback: restores a previous version by creating a new sequential version snapshot rather than deleting history.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['versionNumber'],
                  properties: {
                    versionNumber: { type: 'number', example: 1 },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Historical version cloned as new current version' },
          },
        },
      },
      '/api/notifications': {
        get: {
          tags: ['4. Role: Educator (Faculty)'],
          summary: 'View In-App Notifications & Alerts',
          responses: {
            200: { description: 'List of alerts and unread counts' },
          },
        },
        patch: {
          tags: ['4. Role: Educator (Faculty)'],
          summary: 'Mark Notifications as Read',
          responses: {
            200: { description: 'Notifications marked read' },
          },
        },
      },

      // =========================================================================
      // 5. ROLE: STUDENT
      // =========================================================================
      '/api/students/me/enrollments': {
        get: {
          tags: ['5. Role: Student'],
          summary: 'View Enrolled Subjects',
          description: 'Returns active enrolled course subjects dynamically mapped to the student account.',
          responses: {
            200: { description: 'List of enrolled courses' },
          },
        },
      },
      '/api/students/me/syllabi/{courseId}': {
        get: {
          tags: ['5. Role: Student'],
          summary: 'View Current Syllabus Version Only',
          description: 'Students view only the current approved syllabus version for their enrolled course subjects (historical drafts are restricted).',
          parameters: [{ name: 'courseId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Current approved syllabus document' },
          },
        },
      },

      // =========================================================================
      // 6. SYSTEM & DATABASE HEALTH
      // =========================================================================
      '/api/system/db-status': {
        get: {
          tags: ['6. System & PostgreSQL Database'],
          summary: 'PostgreSQL Database Health & Table Inspection',
          description: 'Live roundtrip latency, connection status, and record counts across all 8 normalized PostgreSQL tables.',
          responses: {
            200: {
              description: 'Database status and metrics',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'healthy' },
                      database: { type: 'string', example: 'PostgreSQL (Supabase Pooler)' },
                      latencyMs: { type: 'string', example: '115ms' },
                      tables: { type: 'object' },
                      seededAdmin: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // =========================================================================
      // 7. SYLLABUS SUBMISSION & APPROVAL WORKFLOW
      // =========================================================================
      '/api/syllabi/upload': {
        post: {
          tags: ['Syllabus Submission'],
          summary: 'Upload Syllabus Document (PDF, DOC, DOCX)',
          description: `
Uploads an attached syllabus file (PDF, DOC, DOCX up to 15MB) to server storage.
- **Allowed Roles**: \`Educator\`, \`DepartmentHead\`, \`Admin\`
- **Authentication**: Required (JWT cookie)
- Returns unique URL and metadata for inclusion in syllabus version creation.
          `.trim(),
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file'],
                  properties: {
                    file: {
                      type: 'string',
                      format: 'binary',
                      description: 'Supported file formats: .pdf, .doc, .docx (Max 15MB)',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Document successfully uploaded and saved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      fileUrl: { type: 'string', example: '/uploads/syllabi/1788539000-cpe101.pdf' },
                      fileName: { type: 'string', example: 'CPE101_Syllabus.pdf' },
                      fileType: { type: 'string', example: 'application/pdf' },
                      fileSize: { type: 'number', example: 204850 },
                    },
                  },
                },
              },
            },
            400: { description: 'No file provided or unsupported file format / size exceeded' },
            401: { description: 'Unauthorized — missing or invalid session token' },
            403: { description: 'Forbidden — students cannot upload syllabi' },
          },
        },
      },
      '/api/syllabi/{id}/versions/{version}/submit': {
        post: {
          tags: ['Syllabus Submission'],
          summary: 'Submit Syllabus Version for Department Head Approval',
          description: `
Submits a draft or rejected syllabus version for Department Head review.
- **Allowed Roles**: \`Educator\`, \`DepartmentHead\` (teaching faculty), \`Admin\`
- **Status Transition**: Version \`approvalStatus\` transitions to \`PENDING_APPROVAL\`. Syllabus \`status\` updates to \`Submitted\`.
- **Department Notification**: Automatically notifies the Department Head.
- **Revision Rule**: For revisions, the previous approved version remains active and student-visible.
          `.trim(),
          parameters: [
            { name: 'id', in: 'path', required: true, description: 'Syllabus UUID', schema: { type: 'string' } },
            { name: 'version', in: 'path', required: true, description: 'Version number (e.g., 1, 2)', schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'Version submitted successfully for Department Head approval',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Your syllabus has been submitted for Department Head approval.' },
                      version: { type: 'object' },
                    },
                  },
                },
              },
            },
            400: { description: 'Version is already pending review or already approved' },
            401: { description: 'Unauthorized — user must be authenticated' },
            403: { description: 'Forbidden — you can only submit your own syllabus' },
            404: { description: 'Syllabus or specified version number not found' },
          },
        },
      },
      '/api/syllabus-approvals': {
        get: {
          tags: ['Syllabus Approval'],
          summary: 'Get Pending Approvals Queue (Department Scoped)',
          description: `
Retrieves all syllabus versions awaiting Department Head review and approval.
- **Allowed Roles**: \`DepartmentHead\`, \`Admin\`
- **Department Scoping**: Strictly scoped by the Department Head's authorized department ID. Clients cannot bypass department filtering.
- **Metrics**: Computes real-time counts for \`pending\`, \`approved\`, \`rejected\`, and \`total\`.
          `.trim(),
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ALL'], default: 'PENDING_APPROVAL' } },
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by course code, title, or instructor name' },
          ],
          responses: {
            200: {
              description: 'List of syllabus approval requests within authorized department',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      approvals: { type: 'array', items: { type: 'object' } },
                      metrics: {
                        type: 'object',
                        properties: {
                          pending: { type: 'number', example: 3 },
                          approved: { type: 'number', example: 12 },
                          rejected: { type: 'number', example: 1 },
                          total: { type: 'number', example: 16 },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Unauthorized — missing authentication' },
            403: { description: 'Forbidden — only Department Heads and Administrators can access approval queues' },
          },
        },
      },
      '/api/syllabus-approvals/{id}': {
        get: {
          tags: ['Syllabus Review'],
          summary: 'View Approval Request & Side-by-Side Revision Diff',
          description: `
Deep inspection of a submitted syllabus version.
- **Allowed Roles**: \`DepartmentHead\`, \`Admin\`
- **Self-Approval Check**: Returns \`isSelfSubmission: true\` if the Department Head is the author/submitter.
- **Revision Diff**: Locates the previous approved version to render side-by-side comparisons and change summaries.
- **Attachment Viewer**: Supplies file URL for PDF/DOC/DOCX documents.
          `.trim(),
          parameters: [
            { name: 'id', in: 'path', required: true, description: 'Syllabus Version UUID', schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'Detailed approval request with course info, version content, document, and previous approved comparison',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      approval: { type: 'object' },
                      previousApprovedVersion: { type: 'object', nullable: true },
                      isSelfSubmission: { type: 'boolean', example: false },
                    },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden — syllabus does not belong to authorized department' },
            404: { description: 'Approval request version not found' },
          },
        },
      },
      '/api/syllabus-approvals/{id}/approve': {
        post: {
          tags: ['Syllabus Approval'],
          summary: 'Approve Syllabus Version (Publish Official Active Version)',
          description: `
Department Head approves a pending syllabus version.
- **Allowed Roles**: \`DepartmentHead\`, \`Admin\`
- **Department Authorization**: Verifies syllabus belongs to reviewer's authorized department.
- **Teaching Faculty Authorization**: Department Heads are also faculty members at USJ-R and are authorized to upload, create, review, and approve their own teaching syllabi for their department.
- **Atomic Transaction**:
  1. Sets version \`approvalStatus\` to \`APPROVED\`.
  2. Updates syllabus \`currentVersionNumber\` to this version number.
  3. Sets syllabus \`status\` to \`ACTIVE\` (now visible to enrolled students).
  4. Records entry in \`syllabus_approval_logs\`.
  5. Dispatches notification to faculty member.
  6. Creates audit log entry.
          `.trim(),
          parameters: [
            { name: 'id', in: 'path', required: true, description: 'Syllabus Version UUID', schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'Syllabus version approved; now official active version for enrolled students',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'CPE101 Version 2 has been approved and activated as the official syllabus.' },
                      version: { type: 'object' },
                      syllabus: { type: 'object' },
                    },
                  },
                },
              },
            },
            400: { description: 'Version is not pending approval' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden: Department unauthorized' },
            404: { description: 'Approval request version not found' },
          },
        },
      },
      '/api/syllabus-approvals/{id}/reject': {
        post: {
          tags: ['Syllabus Approval'],
          summary: 'Reject Syllabus Version (With Mandatory Feedback Reason)',
          description: `
Department Head rejects a pending syllabus version with required feedback remarks.
- **Allowed Roles**: \`DepartmentHead\`, \`Admin\`
- **Mandatory Reason**: Requires \`rejectionReason\` (minimum 5 characters).
- **Teaching Faculty Review**: Department Heads can also return revisions for courses in their department.
- **Revision Rule**: Does NOT modify syllabus \`currentVersionNumber\`. Previously approved version remains visible to students.
- **Atomic Transaction**:
  1. Sets version \`approvalStatus\` to \`REJECTED\`.
  2. Stores \`rejectionReason\`.
  3. Records entry in \`syllabus_approval_logs\`.
  4. Dispatches notification to faculty member with feedback.
  5. Creates audit log entry.
          `.trim(),
          parameters: [
            { name: 'id', in: 'path', required: true, description: 'Syllabus Version UUID', schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['rejectionReason'],
                  properties: {
                    rejectionReason: {
                      type: 'string',
                      minLength: 5,
                      example: 'Please review the grading system percentages. The total must equal 100%.',
                      description: 'Mandatory explanation for syllabus rejection',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Syllabus version rejected; comments returned to instructor for revision',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'CPE101 Version 2 has been rejected and returned to faculty.' },
                      version: { type: 'object' },
                    },
                  },
                },
              },
            },
            400: { description: 'Missing rejection reason or version is not pending approval' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden: Self-review prohibited OR department unauthorized' },
            404: { description: 'Approval request version not found' },
          },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec);
}
