import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'USJ-R SRVS API Documentation — Complete Role, Permission & Endpoint Specifications',
      version: '1.2.0',
      description: `
# University of San Jose - Recoletos (USJ-R)
### Syllabus Repository, Revision and Versioning System (SRVS) — Official API Reference

This interactive OpenAPI documentation provides complete, executable specifications for every endpoint in the SRVS backend.

### Authentication & Authorization Workflow
- **Authentication Mechanism**: Session-based JSON Web Tokens (JWT) stored in HTTP-only, Secure \`srvs_token\` cookies.
- **ID Number Standards**:
  - **Students**: Exactly 10 digits (e.g., \`2022012708\`)
  - **Faculty / Educators, Department Heads, System Administrators**: Exactly 5 digits (e.g., \`00000\`, \`10001\`)
- **Role Hierarchy**:
  1. **Admin**: System-wide administrative permissions, user role management, account approvals/deactivations, audit inspection.
  2. **DepartmentHead**: Department-scoped course and curriculum management, enrollment assignments, syllabus approval/rejection with mandatory feedback.
  3. **Educator**: Syllabus drafting, document uploads (PDF/DOCX), sequential version creation, revision tracking, version rollback.
  4. **Student**: Access to active approved syllabi for actively enrolled subjects, departmental notifications.
      `.trim(),
      contact: {
        name: 'USJ-R SRVS System Administrator',
        email: 'admin@srvs.local',
      },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Primary Server (Port 3000)' },
      { url: 'http://localhost:3001', description: 'Secondary Server (Port 3001)' },
    ],
    tags: [
      {
        name: '1. User Authentication & Identity',
        description: 'User registration, login, logout, password reset, session identity, and bcrypt credential management.',
      },
      {
        name: '2. Role: System Administrator',
        description: 'Manage institutional user accounts, approve/deactivate registrations, manage academic departments, and inspect security audit logs.',
      },
      {
        name: '3. Role: Department Head',
        description: 'Manage departmental subjects, approve student enrollments, review faculty syllabi submissions, and broadcast departmental announcements.',
      },
      {
        name: '4. Role: Educator (Faculty)',
        description: 'Create and revise syllabi, upload course outlines (PDF/DOCX), manage immutable sequential version histories, and restore previous versions.',
      },
      {
        name: '5. Role: Student',
        description: 'Query enrolled subjects, inspect approved and active course syllabi, and receive institutional announcements.',
      },
      {
        name: '6. Academic Curriculum & Subjects',
        description: 'Catalog management for institutional subjects and courses, course units, lecture/laboratory hours, prerequisites, and year levels.',
      },
      {
        name: '7. Student Enrollments',
        description: 'Assign and inspect student enrollments by semester and academic year with automatic subject code synchronization.',
      },
      {
        name: '8. Syllabus Management & Revisions',
        description: 'Complete lifecycle of course syllabi, draft preservation, document upload, change summary tracking, and version rollback.',
      },
      {
        name: '9. Syllabus Review & Approval Workflow',
        description: 'Dedicated Department Head workflow to review pending syllabus versions, provide approval, or reject with mandatory revision feedback.',
      },
      {
        name: '10. System & PostgreSQL Database Health',
        description: 'Live database connection latency, connection pooler diagnostics, and table row counts across all segregated entities.',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'srvs_token',
          description: 'HTTP-only secure session cookie issued upon successful sign-in at /api/auth/login.',
        },
      },
      schemas: {
        StandardError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Detailed error message explaining the failure condition.' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            idNumber: { type: 'string', example: '2022012708' },
            email: { type: 'string', format: 'email', example: 'gian@usjr.edu.ph' },
            fullName: { type: 'string', example: 'Gian Carlo' },
            role: { type: 'string', enum: ['Admin', 'DepartmentHead', 'Educator', 'Student'], example: 'Student' },
            accountStatus: { type: 'string', enum: ['PendingApproval', 'Active', 'Rejected', 'Deactivated'], example: 'Active' },
            departmentId: { type: 'integer', nullable: true, example: 1 },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Department: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            code: { type: 'string', example: 'CPE' },
            name: { type: 'string', example: 'Computer Engineering Department' },
            description: { type: 'string', nullable: true, example: 'College of Engineering' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Subject: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            code: { type: 'string', example: 'CPE 101' },
            title: { type: 'string', example: 'Introduction to Computer Engineering' },
            description: { type: 'string', nullable: true, example: 'Foundations of engineering principles and ethics.' },
            units: { type: 'integer', example: 3 },
            lecHours: { type: 'integer', example: 3 },
            labHours: { type: 'integer', example: 0 },
            prerequisite: { type: 'string', example: 'None' },
            yearLevel: { type: 'string', example: '1st Year' },
            semester: { type: 'string', example: '1st Semester' },
            departmentId: { type: 'integer', example: 1 },
          },
        },
        Enrollment: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            studentId: { type: 'integer', example: 4 },
            subjectId: { type: 'integer', example: 1 },
            semester: { type: 'string', example: '1st Semester' },
            academicYear: { type: 'string', example: '2024-2025' },
            section: { type: 'string', example: 'A' },
            status: { type: 'string', enum: ['ENROLLED', 'DROPPED', 'COMPLETED'], example: 'ENROLLED' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Syllabus: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            subjectId: { type: 'integer', example: 1 },
            instructorId: { type: 'integer', example: 3 },
            departmentId: { type: 'integer', example: 1 },
            academicYear: { type: 'string', example: '2024-2025' },
            semester: { type: 'string', example: '1st Semester' },
            section: { type: 'string', example: 'A' },
            status: { type: 'string', enum: ['DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'Draft', 'Submitted', 'Approved', 'Rejected'], example: 'ACTIVE' },
            currentVersionNumber: { type: 'integer', example: 1 },
            uploadedByUserId: { type: 'string', example: '10001', description: 'University ID Number of uploader' },
            submittedAt: { type: 'string', format: 'date-time', nullable: true },
            reviewedAt: { type: 'string', format: 'date-time', nullable: true },
            reviewerRemarks: { type: 'string', nullable: true },
          },
        },
        SyllabusVersion: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            syllabusId: { type: 'integer', example: 1 },
            versionNumber: { type: 'integer', example: 1 },
            editorId: { type: 'integer', example: 3 },
            uploadedByUserId: { type: 'string', example: '10001' },
            changeSummary: { type: 'string', example: 'Initial creation with uploaded PDF' },
            changeType: { type: 'string', enum: ['Create', 'Edit', 'Restore'], example: 'Create' },
            approvalStatus: { type: 'string', enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'], example: 'APPROVED' },
            fileName: { type: 'string', nullable: true, example: 'CPE101_Syllabus.pdf' },
            fileUrl: { type: 'string', nullable: true, example: '/uploads/syllabi/CPE101_Syllabus_1710000000000.pdf' },
            fileType: { type: 'string', nullable: true, example: 'PDF' },
            fileSize: { type: 'integer', nullable: true, example: 2048576 },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    paths: {
      // =========================================================================
      // 1. USER AUTHENTICATION & IDENTITY
      // =========================================================================
      '/api/auth/register': {
        post: {
          tags: ['1. User Authentication & Identity'],
          summary: 'User Registration (Self-Service)',
          description: `
Registers a new user account with strict institutional ID Number format enforcement:
- **Student**: Requires exactly **10 digits** (e.g., \`2022012708\`)
- **Educator (Faculty)**: Requires exactly **5 digits** (e.g., \`10001\`)
Passwords are automatically hashed using **bcrypt** (salt rounds: 10).
New self-registered accounts default to **PendingApproval** status awaiting administrative review.
          `.trim(),
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['firstName', 'lastName', 'username', 'email', 'password', 'role', 'departmentId'],
                  properties: {
                    firstName: { type: 'string', example: 'Gian', description: 'First name' },
                    lastName: { type: 'string', example: 'Carlo', description: 'Last name' },
                    username: {
                      type: 'string',
                      example: '2022012708',
                      description: 'University ID Number: 10 digits for Student, 5 digits for Educator/Faculty',
                    },
                    email: { type: 'string', format: 'email', example: 'gian@usjr.edu.ph', description: 'Institutional email address' },
                    password: { type: 'string', minLength: 6, example: 'Password123!', description: 'Password (min 6 characters)' },
                    role: { type: 'string', enum: ['Student', 'Educator'], example: 'Student', description: 'Role requested' },
                    departmentId: { type: 'string', example: '1', description: 'Department ID or Department code (e.g. 1 or "CPE")' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Registration submitted successfully (Status: PendingApproval)',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Account registered successfully. Waiting for administrator approval.' },
                      user: { $ref: '#/components/schemas/User' },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid input or invalid ID number digit count',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
            },
            409: {
              description: 'Account with this ID number or email already exists',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
            },
            500: {
              description: 'Internal server error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
            },
          },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['1. User Authentication & Identity'],
          summary: 'User Sign In (ID Number & Password)',
          description: `
Authenticates a user via their **University ID Number** (or username) and password:
- Validates 5 digits (Faculty/Admin/DeptHead) or 10 digits (Students)
- Compares password against bcrypt hash in PostgreSQL
- Verifies account status (blocks \`PendingApproval\`, \`Rejected\`, \`Deactivated\`)
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
                    password: { type: 'string', format: 'password', example: 'admin123', description: 'Account password' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Successful authentication; returns session user and sets HTTP-only cookie',
              headers: {
                'Set-Cookie': {
                  schema: { type: 'string', example: 'srvs_token=eyJhbGci...; Path=/; HttpOnly; SameSite=Lax' },
                  description: 'Session authentication cookie',
                },
              },
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Authentication successful.' },
                      user: { $ref: '#/components/schemas/User' },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Missing ID number or password',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
            },
            401: {
              description: 'Invalid credentials or incorrect password',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
            },
            403: {
              description: 'Account pending approval, rejected, or deactivated',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
            },
            500: {
              description: 'Server authentication error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
            },
          },
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['1. User Authentication & Identity'],
          summary: 'Get Current Authenticated Session Profile',
          description: 'Validates the current session JWT cookie and returns authenticated user identity, role, and department metadata.',
          security: [{ cookieAuth: [] }],
          responses: {
            200: {
              description: 'Active authenticated session found',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer', example: 1 },
                          idNumber: { type: 'string', example: '00000' },
                          email: { type: 'string', example: 'admin@srvs.local' },
                          username: { type: 'string', example: '00000' },
                          fullName: { type: 'string', example: 'System Administrator' },
                          role: { type: 'string', example: 'Admin' },
                          departmentId: { type: 'integer', nullable: true, example: null },
                          departmentCode: { type: 'string', nullable: true, example: null },
                          departmentName: { type: 'string', nullable: true, example: null },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: {
              description: 'No active session or session cookie expired',
              content: { 'application/json': { schema: { type: 'object', properties: { user: { type: 'null' } } } } },
            },
          },
        },
      },
      '/api/auth/logout': {
        post: {
          tags: ['1. User Authentication & Identity'],
          summary: 'Sign Out & Invalidate Session Cookie',
          description: 'Clears the `srvs_token` HTTP-only session cookie, invalidating active credentials, and records an audit log entry.',
          security: [{ cookieAuth: [] }],
          responses: {
            200: {
              description: 'Successfully signed out and cookie cleared',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Logged out successfully.' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/auth/forgot-password': {
        post: {
          tags: ['1. User Authentication & Identity'],
          summary: 'Self-Service Password Reset',
          description: 'Allows verified users to securely reset their password by confirming both their University ID Number and registered institutional email address.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['idNumber', 'email', 'newPassword'],
                  properties: {
                    idNumber: { type: 'string', example: '2022012708', description: 'University ID Number' },
                    email: { type: 'string', format: 'email', example: 'gian@usjr.edu.ph', description: 'Registered institutional email' },
                    newPassword: { type: 'string', minLength: 6, example: 'NewSecurePass123!', description: 'New password (minimum 6 characters)' },
                    confirmPassword: { type: 'string', example: 'NewSecurePass123!', description: 'Optional confirmation password match' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Password reset successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Password reset successfully. You can now log in with your new password.' },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Missing required fields or passwords do not match',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
            },
            403: {
              description: 'Account is deactivated or rejected',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
            },
            404: {
              description: 'No account found matching this ID number and email',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
            },
            500: {
              description: 'Server error during password reset',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardError' } } },
            },
          },
        },
      },

      // =========================================================================
      // 2. ROLE: SYSTEM ADMINISTRATOR & USER MANAGEMENT
      // =========================================================================
      '/api/users': {
        get: {
          tags: ['2. Role: System Administrator'],
          summary: 'List Users with Role and Status Filters',
          description: `
Retrieves a paginated list of all system users.
- **Admin**: Has full visibility across all university departments.
- **Department Head**: Automatically scoped to users within their assigned department.
- Includes segregated profile information (\`srvs_admins\`, \`srvs_department_heads\`, \`srvs_faculties\`, \`srvs_students\`).
          `.trim(),
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'status',
              in: 'query',
              required: false,
              description: 'Filter by account status',
              schema: { type: 'string', enum: ['PendingApproval', 'Active', 'Rejected', 'Deactivated'], example: 'Active' },
            },
            {
              name: 'role',
              in: 'query',
              required: false,
              description: 'Filter by user role',
              schema: { type: 'string', enum: ['Admin', 'DepartmentHead', 'Educator', 'Student'], example: 'Educator' },
            },
            {
              name: 'search',
              in: 'query',
              required: false,
              description: 'Search substring across full name, email, or ID number',
              schema: { type: 'string', example: 'Gian' },
            },
          ],
          responses: {
            200: {
              description: 'Users retrieved successfully with role counts breakdown',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      users: { type: 'array', items: { $ref: '#/components/schemas/User' } },
                      counts: {
                        type: 'object',
                        properties: {
                          total: { type: 'integer', example: 4 },
                          deptHeads: { type: 'integer', example: 1 },
                          educators: { type: 'integer', example: 1 },
                          students: { type: 'integer', example: 1 },
                          admins: { type: 'integer', example: 1 },
                        },
                      },
                    },
                  },
                },
              },
            },
            403: { description: 'Unauthorized: Admin or Department Head access required.' },
          },
        },
        post: {
          tags: ['2. Role: System Administrator'],
          summary: 'Create User Account (Admin Direct Provisioning)',
          description: `
System Administrator direct account creation with immediate role allocation and segregated profile synchronization:
- Automatically creates entry in \`srvs_users\` and corresponding segregated profile (\`srvs_admins\`, \`srvs_department_heads\`, \`srvs_faculties\`, or \`srvs_students\`).
- Validates 10-digit ID for Students and 5-digit ID for Faculty/Admin.
          `.trim(),
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['fullName', 'email', 'idNumber', 'password', 'role'],
                  properties: {
                    fullName: { type: 'string', example: 'Engr. Juan Dela Cruz', description: 'Full name of the user' },
                    email: { type: 'string', format: 'email', example: 'jdelacruz@usjr.edu.ph', description: 'Institutional email' },
                    idNumber: { type: 'string', example: '10002', description: '5-digit ID for Faculty/Admin or 10-digit ID for Student' },
                    password: { type: 'string', minLength: 6, example: 'FacultyPass123!', description: 'Initial account password' },
                    role: { type: 'string', enum: ['Admin', 'DepartmentHead', 'Educator', 'Student'], example: 'Educator', description: 'Institutional role' },
                    departmentId: { type: 'string', example: '1', description: 'Department numeric ID or code (e.g. 1 or "CPE")' },
                    accountStatus: { type: 'string', enum: ['Active', 'PendingApproval', 'Deactivated'], example: 'Active', description: 'Initial account status' },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'User account created and segregated profile synchronized',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      user: { $ref: '#/components/schemas/User' },
                    },
                  },
                },
              },
            },
            400: { description: 'Missing required fields or invalid ID number digit format' },
            403: { description: 'Unauthorized: Admin access required.' },
          },
        },
        patch: {
          tags: ['2. Role: System Administrator'],
          summary: 'Update User Account Lifecycle Status or Role',
          description: `
Executes administrative account actions:
- \`Approve\`: Sets account status to Active
- \`Reject\`: Rejects pending registration
- \`Activate\`: Re-enables a deactivated user
- \`Deactivate\`: Suspends account access
- \`ChangeRole\`: Switches user role and cleanly synchronizes segregated role profile tables (\`srvs_admins\`, \`srvs_department_heads\`, \`srvs_faculties\`, \`srvs_students\`).
          `.trim(),
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['userId', 'action'],
                  properties: {
                    userId: { type: 'string', example: '1', description: 'User ID (numeric ID or ID Number string)' },
                    action: {
                      type: 'string',
                      enum: ['Approve', 'Reject', 'Activate', 'Deactivate', 'ChangeRole'],
                      example: 'Approve',
                      description: 'Administrative action to perform',
                    },
                    newRole: {
                      type: 'string',
                      enum: ['Admin', 'DepartmentHead', 'Educator', 'Student'],
                      example: 'DepartmentHead',
                      description: 'Required if action is ChangeRole',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'User account updated successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      user: { $ref: '#/components/schemas/User' },
                    },
                  },
                },
              },
            },
            400: { description: 'Invalid action or user not found' },
            403: { description: 'Unauthorized: Admin access required for role changes' },
          },
        },
        delete: {
          tags: ['2. Role: System Administrator'],
          summary: 'Delete User Account (Admin Only)',
          description: 'Permanently deletes a user account, cascading deletion to segregated role profiles and course enrollments. System administrators cannot delete their own active account.',
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'userId',
              in: 'query',
              required: true,
              description: 'User numeric ID or ID Number string to delete',
              schema: { type: 'string', example: '4' },
            },
          ],
          responses: {
            200: {
              description: 'Account deleted successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Account for Gian Carlo deleted successfully.' },
                    },
                  },
                },
              },
            },
            400: { description: 'Missing userId or attempting to delete self' },
            403: { description: 'Unauthorized: Admin access required.' },
            404: { description: 'User account not found' },
          },
        },
      },
      '/api/departments': {
        get: {
          tags: ['2. Role: System Administrator'],
          summary: 'List All Academic Departments',
          description: 'Retrieves all academic departments with real-time relation counts for enrolled subjects, users, and syllabi.',
          parameters: [
            {
              name: 'search',
              in: 'query',
              required: false,
              description: 'Search substring across department code or full name',
              schema: { type: 'string', example: 'CPE' },
            },
          ],
          responses: {
            200: {
              description: 'List of departments retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      departments: {
                        type: 'array',
                        items: {
                          allOf: [
                            { $ref: '#/components/schemas/Department' },
                            {
                              type: 'object',
                              properties: {
                                _count: {
                                  type: 'object',
                                  properties: {
                                    subjects: { type: 'integer', example: 5 },
                                    users: { type: 'integer', example: 4 },
                                    syllabi: { type: 'integer', example: 2 },
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['2. Role: System Administrator'],
          summary: 'Create Academic Department (Admin Only)',
          description: 'Registers a new academic department with unique uppercase departmental code (e.g., CPE, CE, EE, ME, CS).',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['code', 'name'],
                  properties: {
                    code: { type: 'string', example: 'CPE', description: 'Department code abbreviation (e.g., CPE, CE, EE)' },
                    name: { type: 'string', example: 'Computer Engineering Department', description: 'Official departmental title' },
                    description: { type: 'string', example: 'College of Engineering and Architecture', description: 'Optional departmental description' },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Department created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      department: { $ref: '#/components/schemas/Department' },
                    },
                  },
                },
              },
            },
            400: { description: 'Missing department code or name' },
            403: { description: 'Unauthorized: Admin access required.' },
            409: { description: 'Department with this code already exists' },
          },
        },
      },
      '/api/audit-logs': {
        get: {
          tags: ['2. Role: System Administrator'],
          summary: 'Query System Security Audit Trail (Admin Only)',
          description: 'Inspects immutable security and version audit trail entries recorded in PostgreSQL, including user attribution, action types, and timestamp.',
          security: [{ cookieAuth: [] }],
          responses: {
            200: {
              description: 'Audit logs retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      logs: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer', example: 1 },
                            actionType: { type: 'string', example: 'ApproveSyllabusVersion' },
                            resultStatus: { type: 'string', example: 'Success' },
                            description: { type: 'string', example: 'Approved [CPE 101] Version 1 as official syllabus' },
                            userDisplayName: { type: 'string', example: 'Engr. Department Head' },
                            createdAt: { type: 'string', format: 'date-time' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            403: { description: 'Unauthorized: Admin access required.' },
          },
        },
      },

      // =========================================================================
      // 3. ROLE: DEPARTMENT HEAD & STUDENTS DIRECTORY
      // =========================================================================
      '/api/students': {
        get: {
          tags: ['3. Role: Department Head', '5. Role: Student'],
          summary: 'List Students with Enrolled Subject Codes',
          description: `
Retrieves students directory with departmental filtering:
- Returns \`department\` string code (e.g. \`"CPE"\`, \`"CE"\`, \`"EE"\`) rather than numeric IDs.
- Returns \`enrolledSubjects\` as subject codes only (e.g., \`"CPE 101, CPE 201"\`).
- Scoped to Department Head's assigned department.
          `.trim(),
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'department',
              in: 'query',
              required: false,
              description: 'Filter by department code (e.g., "CPE") or department ID',
              schema: { type: 'string', example: 'CPE' },
            },
            {
              name: 'search',
              in: 'query',
              required: false,
              description: 'Search student name, email, or 10-digit ID number',
              schema: { type: 'string', example: '2022012708' },
            },
          ],
          responses: {
            200: {
              description: 'Students directory retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      students: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer', example: 4, description: 'User master ID' },
                            studentTableId: { type: 'integer', example: 1, description: 'srvs_students table integer ID' },
                            idNumber: { type: 'string', example: '2022012708', description: '10-digit Student ID Number' },
                            fullName: { type: 'string', example: 'Gian Carlo' },
                            email: { type: 'string', example: 'gian@usjr.edu.ph' },
                            department: { type: 'string', example: 'CPE', description: 'Department code (not a number)' },
                            enrolledSubjects: { type: 'string', example: 'CPE 101', description: 'Codes only of enrolled subjects' },
                            yearLevel: { type: 'string', example: '3rd Year' },
                          },
                        },
                      },
                      count: { type: 'integer', example: 1 },
                    },
                  },
                },
              },
            },
            403: { description: 'Unauthorized: Admin or Department Head access required.' },
          },
        },
      },
      '/api/announcements': {
        get: {
          tags: ['3. Role: Department Head', '5. Role: Student'],
          summary: 'Retrieve User Announcements',
          description: 'Fetches announcements relevant to the authenticated user and their department.',
          security: [{ cookieAuth: [] }],
          responses: {
            200: {
              description: 'Announcements list retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      announcements: { type: 'array', items: { type: 'object' } },
                    },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
          },
        },
        post: {
          tags: ['3. Role: Department Head'],
          summary: 'Broadcast Department Announcement',
          description: 'Posts an official announcement broadcast to all educators and students within the designated department.',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title', 'message', 'departmentId'],
                  properties: {
                    title: { type: 'string', example: 'Midterm Syllabus Review Schedule', description: 'Announcement title' },
                    message: { type: 'string', example: 'All faculty members are requested to submit draft syllabi by Friday.', description: 'Body text' },
                    departmentId: { type: 'integer', example: 1, description: 'Target department ID' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Announcement broadcast successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Announcement broadcast to 5 department members.' },
                      recipientsCount: { type: 'integer', example: 5 },
                    },
                  },
                },
              },
            },
            400: { description: 'Missing title, message, or departmentId' },
            403: { description: 'Unauthorized: Only Department Heads or Admins may post announcements' },
          },
        },
      },

      // =========================================================================
      // 6. ACADEMIC CURRICULUM & SUBJECTS
      // =========================================================================
      '/api/subjects': {
        get: {
          tags: ['6. Academic Curriculum & Subjects'],
          summary: 'Catalog of Academic Subjects',
          description: 'Queries university curriculum subjects. Department Heads see subjects in their department; Admins view all.',
          parameters: [
            {
              name: 'search',
              in: 'query',
              required: false,
              description: 'Search subject code or title',
              schema: { type: 'string', example: 'CPE' },
            },
            {
              name: 'departmentId',
              in: 'query',
              required: false,
              description: 'Filter by department ID or department code (e.g., "CPE")',
              schema: { type: 'string', example: '1' },
            },
            {
              name: 'yearLevel',
              in: 'query',
              required: false,
              description: 'Filter by year level',
              schema: { type: 'string', example: '1st Year' },
            },
            {
              name: 'semester',
              in: 'query',
              required: false,
              description: 'Filter by semester',
              schema: { type: 'string', example: '1st Semester' },
            },
          ],
          responses: {
            200: {
              description: 'Subjects retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      subjects: { type: 'array', items: { $ref: '#/components/schemas/Subject' } },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['6. Academic Curriculum & Subjects'],
          summary: 'Create Academic Subject',
          description: 'Registers a new subject in the curriculum with lecture/laboratory units and prerequisites.',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['code', 'title', 'departmentId'],
                  properties: {
                    code: { type: 'string', example: 'CPE 101', description: 'Unique subject code' },
                    title: { type: 'string', example: 'Introduction to Computer Engineering', description: 'Descriptive course title' },
                    departmentId: { type: 'string', example: '1', description: 'Department numeric ID or code (e.g. 1 or "CPE")' },
                    description: { type: 'string', example: 'Foundations of hardware-software co-design.', description: 'Course catalog description' },
                    units: { type: 'integer', example: 3, description: 'Total academic units' },
                    lecHours: { type: 'integer', example: 3, description: 'Lecture hours per week' },
                    labHours: { type: 'integer', example: 0, description: 'Laboratory hours per week' },
                    prerequisite: { type: 'string', example: 'None', description: 'Prerequisite subject codes' },
                    yearLevel: { type: 'string', example: '1st Year', description: 'Year standing' },
                    semester: { type: 'string', example: '1st Semester', description: 'Term offered' },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Subject created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      subject: { $ref: '#/components/schemas/Subject' },
                    },
                  },
                },
              },
            },
            400: { description: 'Missing required fields or invalid department' },
            403: { description: 'Unauthorized: Admin or Department Head access required.' },
            409: { description: 'Subject with this code already exists' },
          },
        },
      },
      '/api/courses': {
        get: {
          tags: ['6. Academic Curriculum & Subjects'],
          summary: 'Courses Catalog (Legacy Compatibility Route for Subjects)',
          description: 'Alias route returning academic subjects mapped as courses for existing UI consumers.',
          parameters: [
            { name: 'search', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'departmentId', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'List of courses',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      courses: { type: 'array', items: { $ref: '#/components/schemas/Subject' } },
                      subjects: { type: 'array', items: { $ref: '#/components/schemas/Subject' } },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['6. Academic Curriculum & Subjects'],
          summary: 'Create Course (Legacy Compatibility Route for Subjects)',
          description: 'Alias route to create a subject/course entry in the curriculum.',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['code', 'title', 'departmentId'],
                  properties: {
                    code: { type: 'string', example: 'CPE 201' },
                    title: { type: 'string', example: 'Data Structures and Algorithms' },
                    departmentId: { type: 'string', example: '1' },
                    description: { type: 'string', example: 'Algorithm analysis and abstract data types.' },
                    units: { type: 'integer', example: 3 },
                    lecHours: { type: 'integer', example: 2 },
                    labHours: { type: 'integer', example: 3 },
                    prerequisite: { type: 'string', example: 'CPE 101' },
                    yearLevel: { type: 'string', example: '2nd Year' },
                    semester: { type: 'string', example: '1st Semester' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Course created successfully' },
            400: { description: 'Missing required fields' },
          },
        },
      },

      // =========================================================================
      // 7. STUDENT ENROLLMENTS
      // =========================================================================
      '/api/enrollments': {
        get: {
          tags: ['7. Student Enrollments', '5. Role: Student'],
          summary: 'Query Subject Enrollments',
          description: `
Retrieves student enrollments:
- **Students**: Automatically restricted to viewing their own active enrollments.
- **Department Heads**: Restricted to enrollments for subjects belonging to their assigned department.
- **Admins**: View enrollments across all academic departments.
          `.trim(),
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'studentId',
              in: 'query',
              required: false,
              description: 'Filter by Student ID Number or integer user ID',
              schema: { type: 'string', example: '4' },
            },
            {
              name: 'subjectId',
              in: 'query',
              required: false,
              description: 'Filter by Subject integer ID or code (e.g. "CPE 101")',
              schema: { type: 'string', example: '1' },
            },
            {
              name: 'courseId',
              in: 'query',
              required: false,
              description: 'Alias parameter for subjectId',
              schema: { type: 'string', example: '1' },
            },
            {
              name: 'academicYear',
              in: 'query',
              required: false,
              description: 'Filter by academic year',
              schema: { type: 'string', example: '2024-2025' },
            },
            {
              name: 'semester',
              in: 'query',
              required: false,
              description: 'Filter by semester',
              schema: { type: 'string', example: '1st Semester' },
            },
          ],
          responses: {
            200: {
              description: 'Enrollments retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      enrollments: {
                        type: 'array',
                        items: {
                          allOf: [
                            { $ref: '#/components/schemas/Enrollment' },
                            {
                              type: 'object',
                              properties: {
                                student: { $ref: '#/components/schemas/User' },
                                subject: { $ref: '#/components/schemas/Subject' },
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
          },
        },
        post: {
          tags: ['7. Student Enrollments'],
          summary: 'Enroll Student in Subject',
          description: `
Enrolls a student in an academic subject for a given semester and academic year:
- Automatically synchronizes the student's \`enrolledSubjects\` field in \`srvs_students\` with subject codes only (e.g. \`"CPE 101, CPE 201"\`).
- Prevents duplicate enrollments in the same subject within the same semester.
          `.trim(),
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['studentId', 'subjectId', 'semester', 'academicYear'],
                  properties: {
                    studentId: { type: 'string', example: '4', description: 'Student integer ID or 10-digit ID Number' },
                    subjectId: { type: 'string', example: '1', description: 'Subject integer ID or subject code (e.g. "CPE 101")' },
                    courseId: { type: 'string', example: '1', description: 'Alias for subjectId' },
                    semester: { type: 'string', example: '1st Semester', description: 'Academic term' },
                    academicYear: { type: 'string', example: '2024-2025', description: 'Academic year' },
                    section: { type: 'string', example: 'A', description: 'Class section' },
                    status: { type: 'string', enum: ['ENROLLED', 'DROPPED', 'COMPLETED'], example: 'ENROLLED' },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Student enrolled and subject codes synchronized',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      enrollment: { $ref: '#/components/schemas/Enrollment' },
                    },
                  },
                },
              },
            },
            400: { description: 'Missing required parameters or invalid student/subject' },
            403: { description: 'Unauthorized: Admin or Department Head access required.' },
            409: { description: 'Student is already enrolled in this subject for this term' },
          },
        },
      },

      // =========================================================================
      // 8. SYLLABUS MANAGEMENT & REVISIONS
      // =========================================================================
      '/api/syllabi': {
        get: {
          tags: ['8. Syllabus Management & Revisions', '4. Role: Educator (Faculty)', '5. Role: Student'],
          summary: 'List Course Syllabi',
          description: `
Queries course syllabi based on user authorization:
- **Students**: Only receive **ACTIVE / Approved** syllabi for subjects they are actively enrolled in.
- **Educators**: Can filter by \`mySyllabi=true\` to see their drafted, submitted, and approved syllabi.
- **Department Heads**: View all departmental syllabi across all lifecycle statuses.
- **Admins**: View syllabi across all departments.
          `.trim(),
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'departmentId',
              in: 'query',
              required: false,
              description: 'Filter by department numeric ID',
              schema: { type: 'string', example: '1' },
            },
            {
              name: 'status',
              in: 'query',
              required: false,
              description: 'Filter by status (Draft, Submitted, Approved, Rejected, ACTIVE)',
              schema: { type: 'string', example: 'ACTIVE' },
            },
            {
              name: 'semester',
              in: 'query',
              required: false,
              description: 'Filter by semester',
              schema: { type: 'string', example: '1st Semester' },
            },
            {
              name: 'academicYear',
              in: 'query',
              required: false,
              description: 'Filter by academic year',
              schema: { type: 'string', example: '2024-2025' },
            },
            {
              name: 'search',
              in: 'query',
              required: false,
              description: 'Search subject code or title',
              schema: { type: 'string', example: 'CPE' },
            },
            {
              name: 'mySyllabi',
              in: 'query',
              required: false,
              description: 'Set to "true" for faculty to filter to their own authored syllabi',
              schema: { type: 'string', enum: ['true', 'false'], example: 'true' },
            },
          ],
          responses: {
            200: {
              description: 'Syllabi list retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      syllabi: {
                        type: 'array',
                        items: {
                          allOf: [
                            { $ref: '#/components/schemas/Syllabus' },
                            {
                              type: 'object',
                              properties: {
                                subject: { $ref: '#/components/schemas/Subject' },
                                instructor: { $ref: '#/components/schemas/User' },
                                versions: { type: 'array', items: { $ref: '#/components/schemas/SyllabusVersion' } },
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['8. Syllabus Management & Revisions', '4. Role: Educator (Faculty)'],
          summary: 'Create Syllabus (Draft or Submit for Approval)',
          description: `
Creates a syllabus master record and initializes **Version 1**:
- Records \`uploadedByUserId\` using the uploader's University ID Number.
- Accepts course outline structured fields and/or uploaded syllabus document (PDF/DOCX).
- Department Heads and Admins can set \`directApprove: true\` to immediately activate Version 1.
          `.trim(),
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['subjectId', 'semester', 'academicYear'],
                  properties: {
                    subjectId: { type: 'string', example: '1', description: 'Subject integer ID or code (e.g. 1 or "CPE 101")' },
                    courseId: { type: 'string', example: '1', description: 'Alias for subjectId' },
                    semester: { type: 'string', example: '1st Semester', description: 'Academic term' },
                    academicYear: { type: 'string', example: '2024-2025', description: 'Academic year' },
                    section: { type: 'string', example: 'A', description: 'Class section' },
                    courseDescription: { type: 'string', example: 'Comprehensive syllabus covering computer systems architecture.', description: 'Course overview' },
                    learningOutcomes: { type: 'array', items: { type: 'string' }, example: ['Understand logic design', 'Implement sequential circuits'] },
                    topics: { type: 'array', items: { type: 'string' }, example: ['Week 1: Boolean Algebra', 'Week 2: Combinational Logic'] },
                    references: { type: 'array', items: { type: 'string' }, example: ['Digital Design by Morris Mano'] },
                    gradingSystem: { type: 'array', items: { type: 'string' }, example: ['Quizzes: 30%', 'Midterm: 30%', 'Finals: 40%'] },
                    schedule: { type: 'string', example: 'Mon/Wed 10:30 AM - 12:00 PM' },
                    saveAsDraft: { type: 'boolean', example: true, description: 'True to save as Draft; False to submit immediately for Department Head review' },
                    directApprove: { type: 'boolean', example: false, description: 'Dept Head or Admin only: directly activate without review' },
                    fileName: { type: 'string', example: 'CPE101_Syllabus.pdf', description: 'Uploaded file original name' },
                    fileUrl: { type: 'string', example: '/uploads/syllabi/CPE101_Syllabus_1710000000000.pdf', description: 'Uploaded file URL' },
                    fileType: { type: 'string', example: 'PDF', description: 'File extension type' },
                    fileSize: { type: 'integer', example: 1048576, description: 'File size in bytes' },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Syllabus master and Version 1 created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      syllabus: { $ref: '#/components/schemas/Syllabus' },
                      version: { $ref: '#/components/schemas/SyllabusVersion' },
                      message: { type: 'string', example: 'Syllabus draft saved successfully.' },
                    },
                  },
                },
              },
            },
            400: { description: 'Missing required subject/term or missing course content/document' },
            403: { description: 'Unauthorized: Educator, Dept Head, or Admin access required.' },
          },
        },
      },
      '/api/syllabi/{id}': {
        get: {
          tags: ['8. Syllabus Management & Revisions'],
          summary: 'Get Syllabus Details and Version Snapshots',
          description: 'Fetches syllabus metadata, current active version, and version snapshot records for comparison.',
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Syllabus integer ID',
              schema: { type: 'integer', example: 1 },
            },
          ],
          responses: {
            200: {
              description: 'Syllabus details returned',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      syllabus: { $ref: '#/components/schemas/Syllabus' },
                      currentVersion: { $ref: '#/components/schemas/SyllabusVersion' },
                      versions: { type: 'array', items: { $ref: '#/components/schemas/SyllabusVersion' } },
                      canEdit: { type: 'boolean', example: true },
                    },
                  },
                },
              },
            },
            403: { description: 'Access denied: not enrolled or department unauthorized' },
            404: { description: 'Syllabus not found' },
          },
        },
        patch: {
          tags: ['8. Syllabus Management & Revisions', '4. Role: Educator (Faculty)'],
          summary: 'Revise Syllabus (Creates New Incremented Version)',
          description: `
Creates a new sequential, immutable version snapshot:
- **Mandatory Change Summary**: Required for revision history tracking.
- Increments version number sequentially (e.g., Version 1 → Version 2).
- Non-destructive: previous versions remain untouched for audit trails.
          `.trim(),
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Syllabus integer ID to revise',
              schema: { type: 'integer', example: 1 },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['changeSummary'],
                  properties: {
                    changeSummary: { type: 'string', minLength: 5, example: 'Updated course grading breakdown to include programming capstone project.', description: 'Mandatory explanation of revisions' },
                    courseDescription: { type: 'string', example: 'Updated course description' },
                    learningOutcomes: { type: 'array', items: { type: 'string' } },
                    topics: { type: 'array', items: { type: 'string' } },
                    references: { type: 'array', items: { type: 'string' } },
                    gradingSystem: { type: 'array', items: { type: 'string' } },
                    schedule: { type: 'string', example: 'Mon/Wed 1:30 PM - 3:00 PM' },
                    saveAsDraft: { type: 'boolean', example: false },
                    submitForApproval: { type: 'boolean', example: true, description: 'Directly submit revised version for Department Head review' },
                    directApprove: { type: 'boolean', example: false, description: 'Dept Head or Admin direct approval' },
                    fileName: { type: 'string', example: 'CPE101_v2.pdf' },
                    fileUrl: { type: 'string', example: '/uploads/syllabi/CPE101_v2_1710000000000.pdf' },
                    fileType: { type: 'string', example: 'PDF' },
                    fileSize: { type: 'integer', example: 2048576 },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'New syllabus version created and recorded',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Syllabus revised and Version 2 created.' },
                      version: { $ref: '#/components/schemas/SyllabusVersion' },
                    },
                  },
                },
              },
            },
            400: { description: 'Missing change summary' },
            403: { description: 'Forbidden: not authorized to modify this syllabus' },
            404: { description: 'Syllabus not found' },
          },
        },
      },
      '/api/syllabi/{id}/submit': {
        post: {
          tags: ['8. Syllabus Management & Revisions', '4. Role: Educator (Faculty)'],
          summary: 'Submit Entire Syllabus for Administrative Review',
          description: 'Updates syllabus master status to Submitted and dispatches review notifications to Department Heads.',
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Syllabus integer ID to submit',
              schema: { type: 'integer', example: 1 },
            },
          ],
          responses: {
            200: {
              description: 'Syllabus submitted for review',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Syllabus submitted for review.' },
                      syllabus: { $ref: '#/components/schemas/Syllabus' },
                    },
                  },
                },
              },
            },
            403: { description: 'Unauthorized' },
            404: { description: 'Syllabus not found' },
          },
        },
      },
      '/api/syllabi/{id}/versions': {
        get: {
          tags: ['8. Syllabus Management & Revisions', '4. Role: Educator (Faculty)'],
          summary: 'Get Syllabus Version History (Audit Inspection)',
          description: 'Inspects full chronological version list with editor attribution, change summaries, and approval statuses. Restricted from student access.',
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Syllabus integer ID',
              schema: { type: 'integer', example: 1 },
            },
          ],
          responses: {
            200: {
              description: 'Version history returned',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      syllabus: { $ref: '#/components/schemas/Syllabus' },
                      versions: { type: 'array', items: { $ref: '#/components/schemas/SyllabusVersion' } },
                    },
                  },
                },
              },
            },
            403: { description: 'Students cannot view version history or department unauthorized' },
            404: { description: 'Syllabus not found' },
          },
        },
      },
      '/api/syllabi/{id}/versions/{version}/submit': {
        post: {
          tags: ['8. Syllabus Management & Revisions', '4. Role: Educator (Faculty)'],
          summary: 'Submit Specific Version for Department Head Approval',
          description: 'Submits a specific historical or draft version number for official Department Head review.',
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Syllabus integer ID',
              schema: { type: 'integer', example: 1 },
            },
            {
              name: 'version',
              in: 'path',
              required: true,
              description: 'Specific version number to submit (e.g., 1, 2)',
              schema: { type: 'integer', example: 1 },
            },
          ],
          responses: {
            200: {
              description: 'Version submitted for approval',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Syllabus Version 1 has been submitted for Department Head approval.' },
                      version: { $ref: '#/components/schemas/SyllabusVersion' },
                    },
                  },
                },
              },
            },
            400: { description: 'Version already approved or already pending review' },
            403: { description: 'Forbidden: You may only submit your own syllabus' },
            404: { description: 'Syllabus or Version not found' },
          },
        },
      },
      '/api/syllabi/{id}/restore': {
        post: {
          tags: ['8. Syllabus Management & Revisions', '4. Role: Educator (Faculty)'],
          summary: 'Rollback & Restore Prior Version',
          description: `
Non-destructive rollback:
- Copies content of the historical version and appends a **new incremented version number**.
- Ensures that audit trail of previous edits is preserved without history loss.
          `.trim(),
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Syllabus integer ID',
              schema: { type: 'integer', example: 1 },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['versionNumber'],
                  properties: {
                    versionNumber: { type: 'integer', example: 1, description: 'Target historical version number to restore' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Version restored as new draft snapshot',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Version 1 successfully restored as new Version 3.' },
                      version: { $ref: '#/components/schemas/SyllabusVersion' },
                    },
                  },
                },
              },
            },
            400: { description: 'Missing versionNumber' },
            403: { description: 'Unauthorized' },
            404: { description: 'Historical version not found' },
          },
        },
      },
      '/api/syllabi/{id}/review': {
        post: {
          tags: ['8. Syllabus Management & Revisions', '3. Role: Department Head'],
          summary: 'Review Syllabus (Approve or Reject)',
          description: 'Department Head direct review endpoint on syllabus master level.',
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Syllabus integer ID',
              schema: { type: 'integer', example: 1 },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['action'],
                  properties: {
                    action: { type: 'string', enum: ['Approve', 'Reject'], example: 'Approve' },
                    remarks: { type: 'string', example: 'Approved for 1st Semester academic term.' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Syllabus review recorded',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Syllabus successfully approved.' },
                    },
                  },
                },
              },
            },
            400: { description: 'Invalid action' },
            403: { description: 'Unauthorized: Admin or Department Head access required.' },
          },
        },
      },
      '/api/syllabi/upload': {
        post: {
          tags: ['8. Syllabus Management & Revisions', '4. Role: Educator (Faculty)'],
          summary: 'Upload Syllabus Document (PDF, DOC, DOCX)',
          description: 'Uploads a course syllabus document file (up to 15MB) to `/uploads/syllabi/` and returns public URL metadata.',
          security: [{ cookieAuth: [] }],
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
                      description: 'Syllabus file document (allowed: .pdf, .doc, .docx; max 15MB)',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Document uploaded successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      fileName: { type: 'string', example: 'CPE101_Syllabus.pdf' },
                      fileUrl: { type: 'string', example: '/uploads/syllabi/CPE101_Syllabus_1710000000000.pdf' },
                      fileType: { type: 'string', example: 'PDF' },
                      fileSize: { type: 'integer', example: 1048576 },
                    },
                  },
                },
              },
            },
            400: { description: 'Missing file, disallowed file format, or size exceeds 15MB' },
            403: { description: 'Unauthorized to upload syllabus documents' },
          },
        },
      },

      // =========================================================================
      // 9. SYLLABUS REVIEW & APPROVAL WORKFLOW
      // =========================================================================
      '/api/syllabus-approvals': {
        get: {
          tags: ['9. Syllabus Review & Approval Workflow', '3. Role: Department Head'],
          summary: 'Query Department Pending Syllabus Approvals',
          description: 'Retrieves all syllabus versions awaiting Department Head approval, with departmental scoping and status breakdown stats.',
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'status',
              in: 'query',
              required: false,
              description: 'Filter by approval status (default: PENDING_APPROVAL)',
              schema: { type: 'string', enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ALL'], example: 'PENDING_APPROVAL' },
            },
            {
              name: 'departmentId',
              in: 'query',
              required: false,
              description: 'Filter by department numeric ID (Admins only)',
              schema: { type: 'string', example: '1' },
            },
          ],
          responses: {
            200: {
              description: 'Approval requests retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      approvals: { type: 'array', items: { $ref: '#/components/schemas/SyllabusVersion' } },
                      stats: {
                        type: 'object',
                        properties: {
                          pending: { type: 'integer', example: 1 },
                          approved: { type: 'integer', example: 2 },
                          rejected: { type: 'integer', example: 0 },
                          total: { type: 'integer', example: 3 },
                        },
                      },
                    },
                  },
                },
              },
            },
            403: { description: 'Unauthorized: Only Department Heads and Administrators may view approvals' },
          },
        },
      },
      '/api/syllabus-approvals/{id}': {
        get: {
          tags: ['9. Syllabus Review & Approval Workflow', '3. Role: Department Head'],
          summary: 'Get Approval Request Details & Side-by-Side Diff Comparison',
          description: 'Retrieves detailed snapshot of a submitted syllabus version along with the previous approved version for comparative diff review.',
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Syllabus Version integer ID',
              schema: { type: 'integer', example: 1 },
            },
          ],
          responses: {
            200: {
              description: 'Approval detail returned',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      approval: { $ref: '#/components/schemas/SyllabusVersion' },
                      previousApprovedVersion: { $ref: '#/components/schemas/SyllabusVersion', nullable: true },
                      isSelfSubmission: { type: 'boolean', example: false },
                    },
                  },
                },
              },
            },
            403: { description: 'Forbidden: Department unauthorized' },
            404: { description: 'Approval request version not found' },
          },
        },
      },
      '/api/syllabus-approvals/{id}/approve': {
        post: {
          tags: ['9. Syllabus Review & Approval Workflow', '3. Role: Department Head'],
          summary: 'Approve Syllabus Version (Activates as Official Active Syllabus)',
          description: `
Official Department Head approval of a submitted syllabus version:
- Sets version \`approvalStatus\` to \`APPROVED\`.
- Updates syllabus master \`status\` to \`ACTIVE\` and advances \`currentVersionNumber\`.
- Immediately publishes syllabus to enrolled students.
          `.trim(),
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Syllabus Version integer ID to approve',
              schema: { type: 'integer', example: 1 },
            },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    comments: { type: 'string', example: 'Approved with commendations on clear learning outcomes.', description: 'Optional approval comments' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Syllabus version approved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Syllabus approved successfully. It is now the official active version.' },
                      version: { $ref: '#/components/schemas/SyllabusVersion' },
                      syllabus: { $ref: '#/components/schemas/Syllabus' },
                    },
                  },
                },
              },
            },
            400: { description: 'Version is not currently in PENDING_APPROVAL status' },
            403: { description: 'Forbidden: Department unauthorized' },
            404: { description: 'Approval request version not found' },
          },
        },
      },
      '/api/syllabus-approvals/{id}/reject': {
        post: {
          tags: ['9. Syllabus Review & Approval Workflow', '3. Role: Department Head'],
          summary: 'Reject Syllabus Version (With Mandatory Feedback Reason)',
          description: `
Department Head rejects a pending syllabus version with required feedback remarks:
- **Mandatory Reason**: Requires actionable \`rejectionReason\`.
- Reverts version status to \`REJECTED\`.
- Dispatches feedback notification to faculty member for resubmission.
          `.trim(),
          security: [{ cookieAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'Syllabus Version integer ID to reject',
              schema: { type: 'integer', example: 1 },
            },
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
                      example: 'Please adjust grading percentages so that quizzes and exams sum to 100%.',
                      description: 'Mandatory actionable explanation for syllabus rejection',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Syllabus version rejected; feedback returned to instructor',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Syllabus has been rejected with feedback returned to instructor.' },
                      version: { $ref: '#/components/schemas/SyllabusVersion' },
                      syllabus: { $ref: '#/components/schemas/Syllabus' },
                    },
                  },
                },
              },
            },
            400: { description: 'Missing rejection reason or version is not in PENDING_APPROVAL status' },
            403: { description: 'Forbidden: Department unauthorized' },
            404: { description: 'Approval request version not found' },
          },
        },
      },

      // =========================================================================
      // 10. SYSTEM, NOTIFICATIONS & DATABASE HEALTH
      // =========================================================================
      '/api/notifications': {
        get: {
          tags: ['10. System & PostgreSQL Database Health'],
          summary: 'Get Authenticated User Notifications',
          description: 'Retrieves notification list and unread count for the active session user.',
          security: [{ cookieAuth: [] }],
          responses: {
            200: {
              description: 'Notifications list returned',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      notifications: { type: 'array', items: { type: 'object' } },
                      unreadCount: { type: 'integer', example: 0 },
                    },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
          },
        },
        patch: {
          tags: ['10. System & PostgreSQL Database Health'],
          summary: 'Mark Notifications as Read',
          description: 'Marks specific or all notifications as read for the authenticated user.',
          security: [{ cookieAuth: [] }],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer', example: 1, description: 'Optional specific notification ID to mark as read' },
                    markAllAsRead: { type: 'boolean', example: true, description: 'Set to true to mark all user notifications as read' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Notifications updated',
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
            401: { description: 'Unauthorized' },
          },
        },
      },
      '/api/dashboard/stats': {
        get: {
          tags: ['10. System & PostgreSQL Database Health'],
          summary: 'Role-Adaptive Dashboard Key Performance Metrics',
          description: 'Calculates dashboard statistics tailored to the caller role (Admin, DepartmentHead, Educator, Student).',
          security: [{ cookieAuth: [] }],
          responses: {
            200: {
              description: 'Dashboard metrics returned',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      role: { type: 'string', example: 'Admin' },
                      stats: { type: 'object' },
                      recentActivities: { type: 'array', items: { type: 'object' } },
                    },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
          },
        },
      },
      '/api/system/db-status': {
        get: {
          tags: ['10. System & PostgreSQL Database Health'],
          summary: 'PostgreSQL Database & Pooler Health Diagnostic',
          description: 'Tests active live query connectivity to the Supabase PostgreSQL session pooler (Port 5432), returns round-trip latency in milliseconds, and audits live row counts across all 10 segregated database tables.',
          responses: {
            200: {
              description: 'Database connection is healthy and responsive',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'healthy' },
                      database: { type: 'string', example: 'PostgreSQL (Supabase Pooler)' },
                      latencyMs: { type: 'string', example: '45ms' },
                      timestamp: { type: 'string', format: 'date-time' },
                      tables: {
                        type: 'object',
                        properties: {
                          srvs_departments: { type: 'integer', example: 1 },
                          srvs_subjects: { type: 'integer', example: 3 },
                          srvs_users: { type: 'integer', example: 4 },
                          srvs_admins: { type: 'integer', example: 1 },
                          srvs_department_heads: { type: 'integer', example: 1 },
                          srvs_faculties: { type: 'integer', example: 1 },
                          srvs_students: { type: 'integer', example: 1 },
                          srvs_syllabi: { type: 'integer', example: 2 },
                          srvs_syllabus_versions: { type: 'integer', example: 2 },
                          srvs_enrollments: { type: 'integer', example: 1 },
                        },
                      },
                      seededAdmin: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer', example: 1 },
                          idNumber: { type: 'string', example: '00000' },
                          email: { type: 'string', example: 'admin@srvs.local' },
                          fullName: { type: 'string', example: 'System Administrator' },
                          role: { type: 'string', example: 'Admin' },
                          accountStatus: { type: 'string', example: 'Active' },
                        },
                      },
                    },
                  },
                },
              },
            },
            500: {
              description: 'Database connection failure or query timeout',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'unhealthy' },
                      database: { type: 'string', example: 'PostgreSQL' },
                      latencyMs: { type: 'string', example: '1500ms' },
                      error: { type: 'string', example: 'Connection refused' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec);
}
