import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'USJ-R SRVS API Documentation — Official Complete Specification',
      version: '2.0.0',
      description: 'Official API documentation for the Syllabus Repository, Revision and Versioning System (SRVS) of the University of San Jose - Recoletos (USJ-R).',
      contact: {
        name: 'USJ-R SRVS System Administrator',
        email: 'admin@usjr.edu.ph',
      },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Development Server (Port 3000)' },
    ],
    tags: [
      {
        name: '1. Authentication',
        description: 'Session authentication, user registration, JWT cookie management, and identity verification.',
      },
      {
        name: '2. Users & Administration',
        description: 'Master institutional user directory (Admins, Department Heads, Educators, and Students), account approvals, role assignments, and deactivation.',
      },
      {
        name: '3. Departments',
        description: 'Institutional engineering departments catalog (CPE, EE, CE, ECE, IE, ME) and departmental statistics.',
      },
      {
        name: '4. Courses',
        description: 'Academic course curriculum catalog, credit units, prerequisites, department assignments, and professor mappings.',
      },
      {
        name: '5. Enrollments',
        description: 'Student course enrollments with composite primary keys allowing multiple course enrollments per student.',
      },
      {
        name: '6. Syllabus Management',
        description: 'Syllabus drafting, single PDF document uploads (max 20MB, DOCX not allowed), revision authoring, and version tracking.',
      },
      {
        name: '7. Syllabus Review & Approval',
        description: 'Department Head review workflow: Draft -> Submitted -> Under Review -> Approved / Rejected, remarks, and previous version comparisons.',
      },
      {
        name: '8. Audit Logs',
        description: 'Institutional security audit trails recording authentication, syllabus revisions, course catalog modifications, and enrollment changes.',
      },
      {
        name: '9. Dashboard / System Health',
        description: 'Role-scoped dashboard analytics and database connection latency diagnostics.',
      },
      {
        name: '10. Notifications & Announcements',
        description: 'In-app notifications and department announcements. NOTE: currently stub implementations — no database table backs them yet, so GET always returns an empty list.',
      },
    ],
    paths: {
      // =======================================================================
      // 1. AUTHENTICATION
      // =======================================================================
      '/api/auth/login': {
        post: {
          tags: ['1. Authentication'],
          summary: 'User Login with Institutional ID Number',
          description: 'Authenticate an institutional user using their ID number (or email) and password. Sets an HTTP-only secure session cookie (`srvs_token`).',
          operationId: 'loginUser',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['idNumber', 'password'],
                  properties: {
                    idNumber: {
                      type: 'integer',
                      example: 2022012708,
                      description: 'Institutional user ID number (10 digits for Students, 5 digits for Educators/DeptHeads/Admin, or 0 for Root Admin).',
                    },
                    password: {
                      type: 'string',
                      format: 'password',
                      example: 'Password123!',
                      description: 'User account password.',
                    },
                  },
                },
                example: {
                  idNumber: 2022012708,
                  password: 'Password123!',
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Authentication successful. Returns user profile and sets session cookie.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AuthSuccessResponse' },
                  example: {
                    success: true,
                    user: {
                      id: 2022012708,
                      idNumber: 2022012708,
                      email: 'gian@usjr.edu.ph',
                      fullName: 'Gian Carlo',
                      role: 'Student',
                      departmentId: 'CPE',
                      departmentName: 'Computer Engineering Department',
                    },
                  },
                },
              },
            },
            '400': { description: 'Missing required ID number or password.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '401': { description: 'Invalid credentials.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '403': { description: 'Account pending approval or deactivated.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/auth/register': {
        post: {
          tags: ['1. Authentication'],
          summary: 'Register New Institutional User Account',
          description: 'Self-register an institutional account. Students require exactly 10 digits; Educators and Department Heads require exactly 5 digits. Institutional email must end with `@usjr.edu.ph`.',
          operationId: 'registerUser',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['idNumber', 'email', 'password', 'firstName', 'lastName', 'role', 'departmentId'],
                  properties: {
                    idNumber: { type: 'integer', example: 2022012708, description: '10-digit ID for Students, 5-digit ID for Educators/Chairs' },
                    email: { type: 'string', format: 'email', example: 'gian@usjr.edu.ph', description: 'Institutional email ending with @usjr.edu.ph' },
                    password: { type: 'string', format: 'password', example: 'Password123!', minLength: 6 },
                    firstName: { type: 'string', example: 'Gian' },
                    lastName: { type: 'string', example: 'Carlo' },
                    role: { type: 'string', enum: ['Student', 'Educator', 'DepartmentHead', 'Admin'], example: 'Student' },
                    departmentId: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'], example: 'CPE' },
                  },
                },
                example: {
                  idNumber: 2022012708,
                  email: 'gian@usjr.edu.ph',
                  password: 'Password123!',
                  firstName: 'Gian',
                  lastName: 'Carlo',
                  role: 'Student',
                  departmentId: 'CPE',
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Account registered successfully.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/RegisterSuccessResponse' },
                  example: {
                    message: 'Account registered successfully! Your account is pending administrator approval before you can log in.',
                    user: {
                      id: 2022012708,
                      idNumber: 2022012708,
                      email: 'gian@usjr.edu.ph',
                      fullName: 'Gian Carlo',
                      role: 'Student',
                      departmentId: 'CPE',
                      accountStatus: 'PendingApproval',
                    },
                  },
                },
              },
            },
            '400': { description: 'Validation failed: ID format, institutional email format, or invalid department code.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '409': { description: 'User with this ID number or email already exists.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/auth/logout': {
        post: {
          tags: ['1. Authentication'],
          summary: 'User Logout',
          description: 'Clears the session cookie (`srvs_token`) and logs the logout event in audit trail. **No parameters or request body** — the user is identified from the session cookie.',
          operationId: 'logoutUser',
          security: [{ CookieAuth: [] }],
          responses: {
            '200': {
              description: 'Successfully logged out.',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string', example: 'Logged out successfully.' } } },
                },
              },
            },
          },
        },
      },
      '/api/auth/forgot-password': {
        post: {
          tags: ['1. Authentication'],
          summary: 'Reset Password with ID Number + Institutional Email',
          description: 'Resets the password of the account whose `idNumber` AND `email` both match. Rejected/Deactivated accounts cannot reset.',
          operationId: 'forgotPassword',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['idNumber', 'email', 'newPassword'],
                  properties: {
                    idNumber: { type: 'integer', example: 2022012708 },
                    email: { type: 'string', format: 'email', example: 'gian.tuquib@usjr.edu.ph' },
                    newPassword: { type: 'string', format: 'password', minLength: 6, example: 'NewPass123!' },
                    confirmPassword: { type: 'string', format: 'password', example: 'NewPass123!' },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Password reset successful.' },
            '400': { description: 'Missing fields, password too short, or passwords do not match.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            '403': { description: 'Account is rejected or deactivated.' },
            '404': { description: 'No account matches this ID number and email.' },
          },
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['1. Authentication'],
          summary: 'Get Authenticated Session Profile',
          description: 'Returns profile details and active course enrollments of the currently logged-in user. **No parameters or request body** — the user is identified from the session cookie.',
          operationId: 'getCurrentSession',
          security: [{ CookieAuth: [] }],
          responses: {
            '200': {
              description: 'Profile of current authenticated session.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      user: { $ref: '#/components/schemas/UserProfile' },
                    },
                  },
                  example: {
                    user: {
                      id: 2022012708,
                      idNumber: 2022012708,
                      email: 'gian@usjr.edu.ph',
                      fullName: 'Gian Carlo',
                      role: 'Student',
                      departmentId: 'CPE',
                      departmentCode: 'CPE',
                      departmentName: 'Computer Engineering Department',
                      yearLevel: '1st Year',
                      enrolledSubjects: 'CPE101',
                      enrollments: [],
                    },
                  },
                },
              },
            },
            '401': { description: 'Not authenticated or session expired.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },

      // =======================================================================
      // 2. USERS & ADMINISTRATION
      // =======================================================================
      '/api/users': {
        get: {
          tags: ['2. Users & Administration'],
          summary: 'List Institutional Users',
          description: 'Retrieve users list. Department Heads automatically only view Educators and Students within their assigned department (Department Isolation). Admins view all users.',
          operationId: 'getUsers',
          parameters: [
            { name: 'idNumber', in: 'query', schema: { type: 'integer', example: 2022012708 }, description: 'Filter by exact numeric ID number' },
            { name: 'role', in: 'query', schema: { type: 'string', enum: ['Admin', 'DepartmentHead', 'Educator', 'Student'] } },
            { name: 'departmentId', in: 'query', schema: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'] } },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['Active', 'PendingApproval', 'Rejected', 'Deactivated'] } },
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Keyword search across name, email, or numeric ID' },
          ],
          responses: {
            '200': {
              description: 'List of institutional users and summary counts.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/UsersListResponse' },
                  example: {
                    users: [
                      {
                        id: 2022012708,
                        idNumber: 2022012708,
                        email: 'gian@usjr.edu.ph',
                        fullName: 'Gian Carlo',
                        role: 'Student',
                        departmentId: 'CPE',
                        departmentName: 'Computer Engineering Department',
                        accountStatus: 'Active',
                        academicRank: null,
                        yearLevel: '1st Year',
                        enrolledCourses: ['CPE101'],
                        createdAt: '2026-09-01T08:00:00.000Z',
                      },
                    ],
                    total: 1,
                    counts: { total: 1, deptHeads: 0, educators: 0, students: 1, admins: 0 },
                  },
                },
              },
            },
            '403': { description: 'Unauthorized: Requires Administrator or Department Head role.' },
          },
        },
        post: {
          tags: ['2. Users & Administration'],
          summary: 'Create Institutional User (Admin Only)',
          description: 'Administrators can provision user accounts directly with specific roles and department assignments.',
          operationId: 'createUser',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['idNumber', 'email', 'fullName', 'role', 'password'],
                  properties: {
                    idNumber: { type: 'integer', example: 10001, description: '10-digit ID for Students, 5-digit for Faculty/Chairs' },
                    email: { type: 'string', format: 'email', example: 'faculty@usjr.edu.ph' },
                    fullName: { type: 'string', example: 'Engr. Alan Turing' },
                    role: { type: 'string', enum: ['Admin', 'DepartmentHead', 'Educator', 'Student'], example: 'Educator' },
                    departmentId: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'], example: 'CPE' },
                    password: { type: 'string', example: 'Password123!' },
                    accountStatus: { type: 'string', enum: ['Active', 'PendingApproval', 'Rejected', 'Deactivated'], example: 'Active' },
                  },
                },
                example: {
                  idNumber: 10001,
                  email: 'faculty@usjr.edu.ph',
                  fullName: 'Engr. Alan Turing',
                  role: 'Educator',
                  departmentId: 'CPE',
                  password: 'Password123!',
                  accountStatus: 'Active',
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'User successfully created.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      user: { $ref: '#/components/schemas/UserProfile' },
                    },
                  },
                  example: {
                    success: true,
                    user: {
                      id: 10001,
                      idNumber: 10001,
                      email: 'faculty@usjr.edu.ph',
                      fullName: 'Engr. Alan Turing',
                      role: 'Educator',
                      departmentId: 'CPE',
                      departmentName: 'Computer Engineering Department',
                      accountStatus: 'Active',
                      academicRank: 'Faculty Member',
                      yearLevel: null,
                      createdAt: '2026-09-29T10:00:00.000Z',
                    },
                  },
                },
              },
            },
            '400': { description: 'Missing required fields or invalid ID format.' },
            '403': { description: 'Unauthorized: Admin access required.' },
            '409': { description: 'User ID or email already exists.' },
          },
        },
        patch: {
          tags: ['2. Users & Administration'],
          summary: 'Update User Profile or Status (Approve/Reject/Deactivate)',
          description: 'Approve or reject pending registrations, update role, department, or deactivate users.',
          operationId: 'updateUser',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['idNumber'],
                  properties: {
                    idNumber: { type: 'integer', example: 2022012708 },
                    action: { type: 'string', enum: ['Approve', 'Reject', 'Deactivate', 'Activate'], example: 'Approve' },
                    role: { type: 'string', enum: ['Admin', 'DepartmentHead', 'Educator', 'Student'] },
                    departmentId: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'] },
                    accountStatus: { type: 'string', enum: ['Active', 'PendingApproval', 'Rejected', 'Deactivated'] },
                  },
                },
                example: {
                  idNumber: 2022012708,
                  action: 'Approve',
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'User updated successfully.',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, user: { $ref: '#/components/schemas/UserProfile' } } },
                  example: {
                    success: true,
                    user: {
                      id: 2022012708,
                      idNumber: 2022012708,
                      email: 'gian@usjr.edu.ph',
                      fullName: 'Gian Carlo',
                      role: 'Student',
                      departmentId: 'CPE',
                      departmentName: 'Computer Engineering Department',
                      accountStatus: 'Active',
                    },
                  },
                },
              },
            },
            '404': { description: 'User not found.' },
          },
        },
        delete: {
          tags: ['2. Users & Administration'],
          summary: 'Deactivate User Account (Audit-Preserving)',
          description: 'Deactivates an account to prevent login while preserving all institutional audit trails, syllabus revisions, and enrollment histories intact.',
          operationId: 'deactivateUser',
          parameters: [
            { name: 'idNumber', in: 'query', required: true, schema: { type: 'integer', example: 2022012708 }, description: 'Institutional ID number of user to deactivate' },
          ],
          responses: {
            '200': {
              description: 'User account deactivated successfully.',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' } } },
                  example: {
                    success: true,
                    message: 'User account 2022012708 deactivated successfully. Institutional audit records and author history preserved.',
                  },
                },
              },
            },
            '400': { description: 'Cannot deactivate own account or missing ID.' },
            '404': { description: 'User not found.' },
          },
        },
      },
      '/api/students': {
        get: {
          tags: ['2. Users & Administration'],
          summary: 'List Enrolled Students Directory (Admin / Department Head)',
          description: 'Retrieve students with enrolled course lists. Department Heads are restricted to their assigned department.',
          operationId: 'getStudents',
          parameters: [
            { name: 'studentId', in: 'query', schema: { type: 'integer', example: 2022012708 }, description: 'Filter by student 10-digit ID number' },
            { name: 'idNumber', in: 'query', schema: { type: 'integer', example: 2022012708 }, description: 'Alternative alias for student ID number' },
            { name: 'departmentId', in: 'query', schema: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'] }, description: 'Filter by department code' },
            { name: 'search', in: 'query', schema: { type: 'string', example: 'Gian' }, description: 'Search by full name, email, or ID number' },
          ],
          responses: {
            '200': {
              description: 'List of students.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      students: { type: 'array', items: { type: 'object' } },
                      count: { type: 'integer', example: 1 },
                    },
                  },
                  example: {
                    students: [
                      {
                        id: 2022012708,
                        idNumber: '2022012708',
                        fullName: 'Gian Carlo',
                        email: 'gian@usjr.edu.ph',
                        department: 'CPE',
                        departmentName: 'Computer Engineering Department',
                        yearLevel: '4th Year',
                        accountStatus: 'Active',
                        enrolledCourses: [1, 2],
                      },
                    ],
                    count: 1,
                  },
                },
              },
            },
            '401': { description: 'Unauthorized.' },
            '403': { description: 'Forbidden: Requires Admin or Department Head role.' },
          },
        },
      },

      // =======================================================================
      // 3. DEPARTMENTS
      // =======================================================================
      '/api/departments': {
        get: {
          tags: ['3. Departments'],
          summary: 'List Academic Engineering Departments',
          description: 'Returns the 6 institutional engineering departments (CPE, EE, CE, ECE, IE, ME) with real-time course, student, and faculty counts.',
          operationId: 'getDepartments',
          parameters: [
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Filter departments by code or name' },
          ],
          responses: {
            '200': {
              description: 'List of engineering departments.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      departments: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Department' },
                      },
                    },
                  },
                  example: {
                    departments: [
                      {
                        id: 'CPE',
                        code: 'CPE',
                        name: 'Computer Engineering Department',
                        description: 'College of Engineering',
                        _count: { subjects: 13, courses: 13, users: 5, educators: 2, students: 2, syllabi: 3 },
                      },
                      {
                        id: 'EE',
                        code: 'EE',
                        name: 'Electrical Engineering Department',
                        description: 'College of Engineering',
                        _count: { subjects: 8, courses: 8, users: 3, educators: 1, students: 1, syllabi: 1 },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },

      // =======================================================================
      // 4. COURSES
      // =======================================================================
      '/api/courses': {
        get: {
          tags: ['4. Courses'],
          summary: 'List Courses Catalog',
          description: 'Retrieve academic courses catalog. Non-admin users are strictly scoped to courses within their assigned department (Department Isolation).',
          operationId: 'getCourses',
          parameters: [
            { name: 'courseId', in: 'query', schema: { type: 'integer', example: 1 }, description: 'Internal database integer course record ID' },
            { name: 'courseCode', in: 'query', schema: { type: 'string', example: 'CPE101' }, description: 'Institutional course code' },
            { name: 'departmentId', in: 'query', schema: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'] } },
            { name: 'semester', in: 'query', schema: { type: 'string', example: '1st Semester' } },
            { name: 'yearLevel', in: 'query', schema: { type: 'string', example: '1st Year' } },
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search course code or title' },
          ],
          responses: {
            '200': {
              description: 'List of academic courses.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      courses: { type: 'array', items: { $ref: '#/components/schemas/Course' } },
                      total: { type: 'integer', example: 1 },
                    },
                  },
                  example: {
                    courses: [
                      {
                        id: 1,
                        code: 'CPE101',
                        title: 'Computer Engineering as a Discipline',
                        description: 'Introduction to hardware and software engineering principles.',
                        units: 3,
                        lecHours: 3,
                        labHours: 0,
                        prerequisite: 'None',
                        yearLevel: '1st Year',
                        semester: '1st Semester',
                        departmentId: 'CPE',
                        professorName: 'Engr. Alan Turing',
                        department: { id: 'CPE', code: 'CPE', name: 'Computer Engineering Department' },
                        isEnrolled: true,
                        syllabi: [],
                        createdAt: '2026-09-01T08:00:00.000Z',
                        updatedAt: '2026-09-01T08:00:00.000Z',
                      },
                    ],
                    total: 1,
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['4. Courses'],
          summary: 'Create Course (Department Head / Admin)',
          description: 'Department Heads can create courses within their assigned department. Admins can create courses across any department.',
          operationId: 'createCourse',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['code', 'title', 'departmentId'],
                  properties: {
                    code: { type: 'string', example: 'CPE101', description: 'Institutional course code' },
                    title: { type: 'string', example: 'Computer Engineering as a Discipline' },
                    description: { type: 'string', example: 'Foundational concepts in computer engineering.' },
                    units: { type: 'integer', example: 3 },
                    lecHours: { type: 'integer', example: 3 },
                    labHours: { type: 'integer', example: 0 },
                    prerequisite: { type: 'string', example: 'None' },
                    yearLevel: { type: 'string', example: '1st Year' },
                    semester: { type: 'string', example: '1st Semester' },
                    departmentId: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'], example: 'CPE' },
                    professorName: { type: 'string', example: 'Engr. Alan Turing', description: 'Faculty member responsible for syllabus' },
                  },
                },
                example: {
                  code: 'CPE101',
                  title: 'Computer Engineering as a Discipline',
                  description: 'Foundational concepts in computer engineering.',
                  units: 3,
                  lecHours: 3,
                  labHours: 0,
                  prerequisite: 'None',
                  yearLevel: '1st Year',
                  semester: '1st Semester',
                  departmentId: 'CPE',
                  professorName: 'Engr. Alan Turing',
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Course created successfully.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      course: { $ref: '#/components/schemas/Course' },
                    },
                  },
                  example: {
                    success: true,
                    course: {
                      id: 1,
                      code: 'CPE101',
                      title: 'Computer Engineering as a Discipline',
                      description: 'Foundational concepts in computer engineering.',
                      units: 3,
                      lecHours: 3,
                      labHours: 0,
                      prerequisite: 'None',
                      yearLevel: '1st Year',
                      semester: '1st Semester',
                      departmentId: 'CPE',
                      professorName: 'Engr. Alan Turing',
                      department: { id: 'CPE', code: 'CPE', name: 'Computer Engineering Department' },
                      createdAt: '2026-09-29T10:00:00.000Z',
                      updatedAt: '2026-09-29T10:00:00.000Z',
                    },
                  },
                },
              },
            },
            '400': { description: 'Missing required code, title, or invalid departmentId.' },
            '403': { description: 'Department Head attempted to create course outside their assigned department.' },
            '409': { description: 'Course code already exists.' },
          },
        },
        delete: {
          tags: ['4. Courses'],
          summary: 'Delete Course',
          description: 'Delete a course by database integer `courseId` or string `courseCode`.',
          operationId: 'deleteCourse',
          parameters: [
            { name: 'courseId', in: 'query', schema: { type: 'integer', example: 1 }, description: 'Database ID of course' },
            { name: 'courseCode', in: 'query', schema: { type: 'string', example: 'CPE101' }, description: 'Course code' },
          ],
          responses: {
            '200': {
              description: 'Course deleted successfully.',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' } } },
                  example: { success: true, message: 'Course CPE101 deleted successfully.' },
                },
              },
            },
            '403': { description: 'Department Head attempted to delete course outside their department.' },
            '404': { description: 'Course not found.' },
          },
        },
      },

      // =======================================================================
      // 5. ENROLLMENTS
      // =======================================================================
      '/api/enrollments': {
        get: {
          tags: ['5. Enrollments'],
          summary: 'List Course Enrollments',
          description: 'Retrieve enrollments. Students only see their own enrollments; Department Heads only see enrollments for courses in their department.',
          operationId: 'getEnrollments',
          parameters: [
            { name: 'studentId', in: 'query', schema: { type: 'integer', example: 2022012708 }, description: '10-digit numeric Student ID' },
            { name: 'courseId', in: 'query', schema: { type: 'integer', example: 1 }, description: 'Internal database course ID' },
            { name: 'courseCode', in: 'query', schema: { type: 'string', example: 'CPE101' } },
          ],
          responses: {
            '200': {
              description: 'List of student course enrollments.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      enrollments: { type: 'array', items: { $ref: '#/components/schemas/Enrollment' } },
                      total: { type: 'integer', example: 1 },
                    },
                  },
                  example: {
                    enrollments: [
                      {
                        id: '2022012708_1',
                        studentId: 2022012708,
                        studentName: 'Gian Carlo',
                        courseId: 1,
                        semester: '1st Semester',
                        academicYear: '2026-2027',
                        section: 'A',
                        status: 'ENROLLED',
                        createdAt: '2026-09-01T08:00:00.000Z',
                        student: {
                          id: 2022012708,
                          idNumber: 2022012708,
                          fullName: 'Gian Carlo',
                          email: 'gian@usjr.edu.ph',
                        },
                        course: {
                          id: 1,
                          code: 'CPE101',
                          title: 'Computer Engineering as a Discipline',
                          units: 3,
                          departmentId: 'CPE',
                          professorName: 'Engr. Alan Turing',
                        },
                      },
                    ],
                    total: 1,
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['5. Enrollments'],
          summary: 'Enroll Student in Course',
          description: 'Enroll a student into a course. The composite key (`studentId`, `courseId`) permits a student to enroll in multiple distinct courses.',
          operationId: 'createEnrollment',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['studentId', 'courseId'],
                  properties: {
                    studentId: { type: 'integer', example: 2022012708, description: '10-digit Student ID number' },
                    courseId: { type: 'integer', example: 1, description: 'Internal database course ID' },
                    courseCode: { type: 'string', example: 'CPE101', description: 'Optional course code alternative' },
                    semester: { type: 'string', example: '1st Semester' },
                    academicYear: { type: 'string', example: '2026-2027' },
                    section: { type: 'string', example: 'A' },
                  },
                },
                example: {
                  studentId: 2022012708,
                  courseId: 1,
                  semester: '1st Semester',
                  academicYear: '2026-2027',
                  section: 'A',
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Student enrolled successfully.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      enrollment: { $ref: '#/components/schemas/Enrollment' },
                    },
                  },
                  example: {
                    success: true,
                    enrollment: {
                      id: '2022012708_1',
                      studentId: 2022012708,
                      studentName: 'Gian Carlo',
                      courseId: 1,
                      semester: '1st Semester',
                      academicYear: '2026-2027',
                      section: 'A',
                      status: 'ENROLLED',
                      createdAt: '2026-09-29T10:00:00.000Z',
                      student: {
                        id: 2022012708,
                        idNumber: 2022012708,
                        fullName: 'Gian Carlo',
                        email: 'gian@usjr.edu.ph',
                      },
                      course: {
                        id: 1,
                        code: 'CPE101',
                        title: 'Computer Engineering as a Discipline',
                        units: 3,
                        departmentId: 'CPE',
                        professorName: 'Engr. Alan Turing',
                      },
                    },
                  },
                },
              },
            },
            '400': { description: 'Missing or invalid studentId or courseId.' },
            '403': { description: 'Department Head attempted to enroll outside their department.' },
            '409': { description: 'Student is already enrolled in this course.' },
          },
        },
        delete: {
          tags: ['5. Enrollments'],
          summary: 'Unenroll Student from Course',
          description: 'Removes an enrollment record by `studentId` and `courseId`.',
          operationId: 'deleteEnrollment',
          parameters: [
            { name: 'studentId', in: 'query', required: true, schema: { type: 'integer', example: 2022012708 } },
            { name: 'courseId', in: 'query', required: true, schema: { type: 'integer', example: 1 } },
          ],
          responses: {
            '200': {
              description: 'Student unenrolled successfully.',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' } } },
                  example: { success: true, message: 'Student unenrolled successfully.' },
                },
              },
            },
            '404': { description: 'Enrollment record not found.' },
          },
        },
      },

      // =======================================================================
      // 6. SYLLABUS MANAGEMENT
      // =======================================================================
      '/api/syllabi': {
        get: {
          tags: ['6. Syllabus Management'],
          summary: 'List Syllabi Catalog',
          description: 'Retrieve syllabus repository records. Department Heads and Educators are restricted to their assigned department. Students only see approved syllabi for courses they are enrolled in.',
          operationId: 'getSyllabi',
          parameters: [
            { name: 'courseId', in: 'query', schema: { type: 'integer', example: 1 }, description: 'Database course integer ID' },
            { name: 'courseCode', in: 'query', schema: { type: 'string', example: 'CPE101' }, description: 'Course code' },
            { name: 'instructorId', in: 'query', schema: { type: 'integer', example: 10001 } },
            { name: 'departmentId', in: 'query', schema: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'] } },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'ALL'] } },
            { name: 'mySyllabi', in: 'query', schema: { type: 'boolean', example: false }, description: 'Filter only syllabi authored by the logged-in educator' },
          ],
          responses: {
            '200': {
              description: 'List of syllabi.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      syllabi: { type: 'array', items: { $ref: '#/components/schemas/Syllabus' } },
                      total: { type: 'integer', example: 1 },
                    },
                  },
                  example: {
                    syllabi: [
                      {
                        id: 10,
                        courseId: 1,
                        instructorId: 10001,
                        departmentId: 'CPE',
                        academicYear: '2026-2027',
                        semester: '1st Semester',
                        section: 'A',
                        status: 'Approved',
                        currentVersionNumber: 1,
                        course: { id: 1, code: 'CPE101', title: 'Computer Engineering as a Discipline', units: 3, departmentId: 'CPE' },
                        instructor: { id: 10001, idNumber: 10001, fullName: 'Engr. Alan Turing', email: 'faculty@usjr.edu.ph', role: 'Educator' },
                        latestVersion: { id: 25, versionNumber: 1, approvalStatus: 'Approved', fileUrl: '/uploads/syllabi/cpe101.pdf', fileType: 'PDF' },
                      },
                    ],
                    total: 1,
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['6. Syllabus Management'],
          summary: 'Create or Submit New Syllabus (Educator / Dept Head)',
          description: 'Creates Version 1 of a syllabus. Uploader identity (`instructorId`) is strictly verified from authenticated session. Revisions follow workflow: `Draft` -> `Submitted` -> `Under Review` -> `Approved` / `Rejected`.',
          operationId: 'createSyllabus',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['courseId', 'semester', 'academicYear'],
                  properties: {
                    courseId: { type: 'integer', example: 1, description: 'Internal database course ID' },
                    courseCode: { type: 'string', example: 'CPE101' },
                    semester: { type: 'string', example: '1st Semester' },
                    academicYear: { type: 'string', example: '2026-2027' },
                    section: { type: 'string', example: 'A' },
                    courseDescription: { type: 'string', example: 'Introduction to hardware and software engineering principles.' },
                    learningOutcomes: { type: 'array', items: { type: 'string' }, example: ['Understand digital systems', 'Design logic gates'] },
                    saveAsDraft: { type: 'boolean', example: false, description: 'If false, submits for Department Head review' },
                    fileUrl: { type: 'string', example: '/uploads/syllabi/cpe101.pdf', description: 'URL of uploaded PDF document' },
                    fileName: { type: 'string', example: 'cpe101_syllabus.pdf' },
                    fileType: { type: 'string', example: 'PDF', enum: ['PDF'] },
                    fileSize: { type: 'integer', example: 1048576 },
                  },
                },
                example: {
                  courseId: 1,
                  semester: '1st Semester',
                  academicYear: '2026-2027',
                  section: 'A',
                  courseDescription: 'Introduction to hardware and software engineering principles.',
                  learningOutcomes: ['Understand digital systems', 'Design logic gates'],
                  saveAsDraft: false,
                  fileUrl: '/uploads/syllabi/cpe101.pdf',
                  fileName: 'cpe101_syllabus.pdf',
                  fileType: 'PDF',
                  fileSize: 1048576,
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Syllabus created or submitted successfully.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      syllabus: { $ref: '#/components/schemas/Syllabus' },
                      version: { $ref: '#/components/schemas/SyllabusVersion' },
                      message: { type: 'string', example: 'Syllabus submitted for department head review and approval.' },
                    },
                  },
                  example: {
                    success: true,
                    syllabus: {
                      id: 10,
                      courseId: 1,
                      instructorId: 10001,
                      departmentId: 'CPE',
                      academicYear: '2026-2027',
                      semester: '1st Semester',
                      section: 'A',
                      status: 'Submitted',
                      currentVersionNumber: 1,
                    },
                    version: {
                      id: 25,
                      syllabusId: 10,
                      versionNumber: 1,
                      approvalStatus: 'Submitted',
                      fileUrl: '/uploads/syllabi/cpe101.pdf',
                      fileType: 'PDF',
                      fileSize: 1048576,
                    },
                    message: 'Syllabus submitted for department head review and approval.',
                  },
                },
              },
            },
            '400': { description: 'Missing required course, semester, academic year, or non-PDF file.' },
            '403': { description: 'Unauthorized or creating syllabus outside assigned department.' },
          },
        },
      },
      '/api/syllabi/{id}': {
        get: {
          tags: ['6. Syllabus Management'],
          summary: 'Get Syllabus Details & Version History',
          description: 'Retrieve full syllabus record, all sequential versions, review feedback, and document attachments.',
          operationId: 'getSyllabusById',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 10 }, description: 'Syllabus ID' },
          ],
          responses: {
            '200': {
              description: 'Syllabus details and full version revision history.',
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
            '403': { description: 'Forbidden: Department isolation or student not enrolled in course.' },
            '404': { description: 'Syllabus not found.' },
          },
        },
        patch: {
          tags: ['6. Syllabus Management'],
          summary: 'Submit Syllabus Revision (Create New Version)',
          description: 'Authors and Department Heads submit sequential syllabus versions (e.g. Version 2, 3) with change summary.',
          operationId: 'reviseSyllabus',
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
                    changeSummary: { type: 'string', example: 'Updated course outcomes and added cloud computing topic for AY 2026-2027.' },
                    courseDescription: { type: 'string' },
                    learningOutcomes: { type: 'array', items: { type: 'string' } },
                    saveAsDraft: { type: 'boolean', example: false },
                    submitForApproval: { type: 'boolean', example: true },
                    fileUrl: { type: 'string', example: '/uploads/syllabi/cpe101_v2.pdf' },
                    fileType: { type: 'string', enum: ['PDF'], example: 'PDF' },
                  },
                },
                example: {
                  changeSummary: 'Updated course outcomes and added cloud computing topic for AY 2026-2027.',
                  courseDescription: 'Comprehensive overview of modern computer engineering disciplines.',
                  saveAsDraft: false,
                  submitForApproval: true,
                  fileUrl: '/uploads/syllabi/cpe101_v2.pdf',
                  fileType: 'PDF',
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'New revision created and submitted for review.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      version: { $ref: '#/components/schemas/SyllabusVersion' },
                      message: { type: 'string', example: 'Version 2 submitted for Department Head review.' },
                    },
                  },
                  example: {
                    success: true,
                    version: {
                      id: 26,
                      syllabusId: 10,
                      versionNumber: 2,
                      changeSummary: 'Updated course outcomes and added cloud computing topic for AY 2026-2027.',
                      approvalStatus: 'Submitted',
                      fileUrl: '/uploads/syllabi/cpe101_v2.pdf',
                      fileType: 'PDF',
                    },
                    message: 'Version 2 submitted for Department Head review.',
                  },
                },
              },
            },
            '400': { description: 'Missing change summary or non-PDF file.' },
            '403': { description: 'Forbidden: Only author or assigned Department Head can edit.' },
          },
        },
        delete: {
          tags: ['6. Syllabus Management'],
          summary: 'Delete Syllabus',
          description: 'Delete a syllabus record by ID (Admin or Department Head for assigned department).',
          operationId: 'deleteSyllabus',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 10 } },
          ],
          responses: {
            '200': {
              description: 'Syllabus deleted successfully.',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { success: { type: 'boolean', example: true }, message: { type: 'string' } } },
                  example: { success: true, message: 'Syllabus 10 deleted successfully.' },
                },
              },
            },
            '403': { description: 'Forbidden.' },
            '404': { description: 'Syllabus not found.' },
          },
        },
      },
      '/api/syllabi/upload': {
        post: {
          tags: ['6. Syllabus Management'],
          summary: 'Upload Syllabus Document (PDF Only, Max 20MB)',
          description: 'Upload a syllabus file attachment. The SRVS system strictly accepts **PDF syllabi only** (`.pdf`). Maximum file size is **20 MB**. DOCX and other document formats are rejected.',
          operationId: 'uploadSyllabusDocument',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['file'],
                  properties: {
                    file: { type: 'string', format: 'binary', description: 'PDF syllabus document (max 20MB)' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'PDF document uploaded successfully.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      fileName: { type: 'string', example: 'cpe101_syllabus.pdf' },
                      fileUrl: { type: 'string', example: '/uploads/syllabi/cpe101_syllabus_171000000.pdf' },
                      fileType: { type: 'string', example: 'PDF' },
                      fileSize: { type: 'integer', example: 1048576 },
                    },
                  },
                  example: {
                    success: true,
                    fileName: 'cpe101_syllabus.pdf',
                    fileUrl: '/uploads/syllabi/cpe101_syllabus_171000000.pdf',
                    fileType: 'PDF',
                    fileSize: 1048576,
                  },
                },
              },
            },
            '400': { description: 'Invalid format (non-PDF) or file size exceeds 20MB limit.' },
            '403': { description: 'Unauthorized: Only Educators and Department Heads may upload documents.' },
          },
        },
      },
      '/api/syllabi/{id}/versions': {
        get: {
          tags: ['6. Syllabus Management'],
          summary: 'Get All Revision Versions for Syllabus',
          description: 'Retrieve full chronological version history, snapshots, and diff content for a syllabus by ID.',
          operationId: 'getSyllabusVersions',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 10 }, description: 'Syllabus ID' },
          ],
          responses: {
            '200': {
              description: 'Version history retrieved successfully.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      syllabus: { $ref: '#/components/schemas/Syllabus' },
                      versions: { type: 'array', items: { $ref: '#/components/schemas/SyllabusVersion' } },
                    },
                  },
                  example: {
                    syllabus: { id: 10, courseId: 1, departmentId: 'CPE', status: 'Submitted', currentVersionNumber: 1 },
                    versions: [
                      {
                        id: 25,
                        versionNumber: 1,
                        syllabusId: 10,
                        changeSummary: 'Initial syllabus drafting (Version 1)',
                        approvalStatus: 'Submitted',
                        fileUrl: '/uploads/syllabi/cpe101.pdf',
                        fileType: 'PDF',
                      },
                    ],
                  },
                },
              },
            },
            '401': { description: 'Unauthorized.' },
            '403': { description: 'Forbidden outside assigned department or student access.' },
            '404': { description: 'Syllabus not found.' },
          },
        },
      },
      '/api/syllabi/{id}/submit': {
        post: {
          tags: ['6. Syllabus Management'],
          summary: 'Submit Syllabus for Department Head Review',
          description: 'Transitions a syllabus from `Draft` to `Submitted` status, notifying the Department Head for review.',
          operationId: 'submitSyllabusForReview',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 10 }, description: 'Syllabus ID to submit' },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    notes: { type: 'string', example: 'Ready for Department Head review.', description: 'Optional submission remarks' },
                  },
                },
                example: {
                  notes: 'Ready for Department Head review.',
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Syllabus submitted for review successfully.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string' },
                      syllabus: { $ref: '#/components/schemas/Syllabus' },
                    },
                  },
                  example: {
                    success: true,
                    message: 'Syllabus submitted for review.',
                    syllabus: { id: 10, status: 'Submitted', submittedAt: '2026-09-29T10:00:00.000Z' },
                  },
                },
              },
            },
            '403': { description: 'Unauthorized: Only author or Department Head may submit.' },
            '404': { description: 'Syllabus not found.' },
          },
        },
      },
      '/api/syllabi/{id}/restore': {
        post: {
          tags: ['6. Syllabus Management'],
          summary: 'Restore Historical Syllabus Version',
          description: 'Restores a previous historical version, creating a new Draft version snapshot.',
          operationId: 'restoreSyllabusVersion',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 10 }, description: 'Syllabus ID' },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['versionNumber'],
                  properties: {
                    versionNumber: { type: 'integer', example: 1, description: 'Target version number to restore' },
                  },
                },
                example: {
                  versionNumber: 1,
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Historical version restored successfully as a new draft.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string' },
                      syllabus: { $ref: '#/components/schemas/Syllabus' },
                      version: { $ref: '#/components/schemas/SyllabusVersion' },
                    },
                  },
                  example: {
                    success: true,
                    message: 'Version 1 restored as new Version 2.',
                    syllabus: { id: 10, currentVersionNumber: 2 },
                    version: { id: 26, versionNumber: 2, changeType: 'Restore', approvalStatus: 'DRAFT' },
                  },
                },
              },
            },
            '400': { description: 'Missing target versionNumber.' },
            '403': { description: 'Unauthorized: Only author or Department Head may restore.' },
            '404': { description: 'Syllabus or target version not found.' },
          },
        },
      },

      // =======================================================================
      // 7. SYLLABUS REVIEW & APPROVAL
      // =======================================================================
      '/api/syllabus-approvals': {
        get: {
          tags: ['7. Syllabus Review & Approval'],
          summary: 'List Pending Syllabus Approvals (Department Head / Admin)',
          description: 'Retrieve pending submissions awaiting review. Department Heads strictly view submissions belonging to their assigned department (Department Isolation).',
          operationId: 'getSyllabusApprovals',
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'UNDER_REVIEW', 'ALL'], default: 'SUBMITTED' } },
            { name: 'departmentId', in: 'query', schema: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'] } },
            { name: 'courseId', in: 'query', schema: { type: 'integer' } },
            { name: 'courseCode', in: 'query', schema: { type: 'string', example: 'CPE101' } },
          ],
          responses: {
            '200': {
              description: 'List of syllabus approval requests and status tallies.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      department: { type: 'object' },
                      approvals: { type: 'array', items: { $ref: '#/components/schemas/SyllabusVersion' } },
                      stats: { type: 'object', properties: { pending: { type: 'integer' }, approved: { type: 'integer' }, rejected: { type: 'integer' }, total: { type: 'integer' } } },
                    },
                  },
                  example: {
                    department: { id: 'CPE', code: 'CPE', name: 'Computer Engineering Department' },
                    approvals: [
                      {
                        id: 25,
                        versionNumber: 1,
                        syllabusId: 10,
                        changeSummary: 'Initial syllabus drafting (Version 1)',
                        approvalStatus: 'Submitted',
                        fileUrl: '/uploads/syllabi/cpe101.pdf',
                        fileType: 'PDF',
                        syllabus: {
                          id: 10,
                          course: { id: 1, code: 'CPE101', title: 'Computer Engineering as a Discipline', departmentId: 'CPE' },
                          instructor: { id: 10001, idNumber: 10001, fullName: 'Engr. Alan Turing', email: 'faculty@usjr.edu.ph' },
                        },
                      },
                    ],
                    stats: { pending: 1, approved: 4, rejected: 0, total: 5 },
                  },
                },
              },
            },
            '403': { description: 'Unauthorized: Requires Department Head or Admin role.' },
          },
        },
        post: {
          tags: ['7. Syllabus Review & Approval'],
          summary: 'Approve or Reject Syllabus Version (Department Head)',
          description: 'Department Heads approve or reject submissions. Reviewer identity (`reviewedById`) is strictly recorded from the authenticated session. Department Heads can only review their department.',
          operationId: 'reviewSyllabus',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['versionId', 'action'],
                  properties: {
                    versionId: { type: 'integer', example: 25, description: 'ID of SyllabusVersion being approved or rejected' },
                    action: { type: 'string', enum: ['Approve', 'Reject', 'Under_Review'], example: 'Approve' },
                    remarks: { type: 'string', example: 'Approved for 1st Semester AY 2026-2027.', description: 'Reviewer feedback or remarks' },
                  },
                },
                example: {
                  versionId: 25,
                  action: 'Approve',
                  remarks: 'Approved for 1st Semester AY 2026-2027.',
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Review action processed successfully.',
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
                  example: {
                    success: true,
                    message: 'Syllabus v1 approved successfully.',
                    status: 'APPROVED',
                  },
                },
              },
            },
            '400': { description: 'Missing versionId or invalid review action.' },
            '403': { description: 'Unauthorized: Only Department Heads in assigned department may review.' },
            '404': { description: 'Syllabus version not found.' },
          },
        },
      },
      '/api/syllabus-approvals/{id}': {
        get: {
          tags: ['7. Syllabus Review & Approval'],
          summary: 'Get Approval Request Details with Version Comparison',
          description: 'Retrieve detailed approval request including course metadata, submitted outcomes, and previous approved version for diff comparison.',
          operationId: 'getApprovalDetail',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 25 } },
          ],
          responses: {
            '200': {
              description: 'Detailed approval data and prior approved version for comparison.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      approval: { $ref: '#/components/schemas/SyllabusVersion' },
                      previousApprovedVersion: { type: 'object' },
                      isSelfSubmission: { type: 'boolean', example: false },
                    },
                  },
                },
              },
            },
            '403': { description: 'Forbidden outside assigned department.' },
            '404': { description: 'Approval request not found.' },
          },
        },
      },
      '/api/syllabi/{id}/review': {
        post: {
          tags: ['7. Syllabus Review & Approval'],
          summary: 'Review & Approve or Reject Syllabus (Department Head / Admin)',
          description: 'Department Head decision on syllabus. Action must be `Approve` or `Reject`. Reviewer identity is securely verified from authenticated session cookie.',
          operationId: 'reviewSyllabusById',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 10 }, description: 'Syllabus ID to review' },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['action'],
                  properties: {
                    action: { type: 'string', enum: ['Approve', 'Reject'], example: 'Approve', description: 'Review decision' },
                    remarks: { type: 'string', example: 'Meets academic syllabus standards and learning outcomes.', description: 'Feedback or remarks' },
                  },
                },
                example: {
                  action: 'Approve',
                  remarks: 'Meets academic syllabus standards and learning outcomes.',
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Syllabus review decision applied successfully.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string' },
                      syllabus: { $ref: '#/components/schemas/Syllabus' },
                    },
                  },
                  example: {
                    success: true,
                    message: 'Syllabus successfully approved.',
                    syllabus: {
                      id: 10,
                      status: 'Approved',
                      reviewerRemarks: 'Meets academic syllabus standards and learning outcomes.',
                      reviewedAt: '2026-09-29T11:00:00.000Z',
                      reviewedByUserId: 10001,
                    },
                  },
                },
              },
            },
            '400': { description: 'Invalid review action. Must be Approve or Reject.' },
            '403': { description: 'Forbidden: Requires Department Head of assigned department or Admin.' },
            '404': { description: 'Syllabus not found.' },
          },
        },
      },

      // =======================================================================
      // 8. AUDIT LOGS
      // =======================================================================
      '/api/audit-logs': {
        get: {
          tags: ['8. Audit Logs'],
          summary: 'Inspect System Security & Activity Audit Trail (Admin Only)',
          description: 'System Administrators can inspect immutable event logs tracking authentication, registrations, course alterations, syllabus submissions, and approvals.',
          operationId: 'getAuditLogs',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', example: 50 }, description: 'Number of logs to return (max 500)' },
            { name: 'actionType', in: 'query', schema: { type: 'string', example: 'Login' } },
            { name: 'idNumber', in: 'query', schema: { type: 'integer', example: 2022012708 }, description: 'Filter by user ID number' },
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Keyword search across descriptions and entity IDs' },
          ],
          responses: {
            '200': {
              description: 'Chronological list of audit records.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      logs: { type: 'array', items: { $ref: '#/components/schemas/AuditLog' } },
                    },
                  },
                  example: {
                    logs: [
                      {
                        id: 1,
                        userId: 2022012708,
                        userDisplayName: 'Gian Carlo',
                        actionType: 'Login',
                        resultStatus: 'Success',
                        description: 'User successfully logged in as [Student]',
                        entityType: 'User',
                        entityId: '2022012708',
                        ipAddress: '127.0.0.1',
                        createdAt: '2026-09-29T10:00:00.000Z',
                      },
                    ],
                  },
                },
              },
            },
            '403': { description: 'Unauthorized: Requires Administrator role.' },
          },
        },
      },

      // =======================================================================
      // 9. DASHBOARD / SYSTEM HEALTH
      // =======================================================================
      '/api/dashboard/stats': {
        get: {
          tags: ['9. Dashboard / System Health'],
          summary: 'Get Role-Scoped Dashboard Analytics',
          description: 'Returns real-time analytics tailored to the authenticated user role: institutional metrics for Admin, departmental overview for Department Head, course & syllabus stats for Educator, enrolled courses for Student.',
          operationId: 'getDashboardStats',
          responses: {
            '200': {
              description: 'Analytics object customized for user role.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      role: { type: 'string', example: 'DepartmentHead' },
                      stats: { type: 'object' },
                    },
                  },
                  example: {
                    role: 'DepartmentHead',
                    department: { id: 'CPE', code: 'CPE', name: 'Computer Engineering Department' },
                    stats: {
                      totalCourses: 13,
                      totalSyllabi: 10,
                      draftSyllabi: 2,
                      submittedSyllabi: 1,
                      approvedSyllabi: 7,
                      rejectedSyllabi: 0,
                      educatorsCount: 5,
                      studentsCount: 22,
                      pendingRegistrations: 1,
                      pendingApprovals: 1,
                      missingSyllabi: 6,
                    },
                  },
                },
              },
            },
            '401': { description: 'Unauthorized.' },
          },
        },
      },
      '/api/system/db-status': {
        get: {
          tags: ['9. Dashboard / System Health'],
          summary: 'Live Database Health & Latency Diagnostics',
          description: 'Live PostgreSQL connection check, query latency test, and table row counts across all core entities.',
          operationId: 'getDbStatus',
          responses: {
            '200': {
              description: 'Database connection health and table statistics.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'healthy' },
                      database: { type: 'string', example: 'PostgreSQL (Supabase Pooler)' },
                      latencyMs: { type: 'string', example: '32ms' },
                      timestamp: { type: 'string', format: 'date-time' },
                      tables: { type: 'object' },
                    },
                  },
                  example: {
                    status: 'healthy',
                    database: 'PostgreSQL (Supabase Pooler)',
                    latencyMs: '32ms',
                    timestamp: '2026-09-29T10:00:00.000Z',
                    tables: {
                      departments: 6,
                      users: 22,
                      courses: 13,
                      syllabi: 10,
                      syllabus_versions: 25,
                      enrollments: 9,
                      audit_logs: 130,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        CookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'srvs_token',
          description: 'Secure, HTTP-only JWT session cookie set on login.',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Invalid ID number or password.' },
          },
        },
        AuthSuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            user: { $ref: '#/components/schemas/UserProfile' },
          },
        },
        RegisterSuccessResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Account registered successfully!' },
            user: { $ref: '#/components/schemas/UserProfile' },
          },
        },
        UserProfile: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 2022012708, description: 'Institutional ID number' },
            idNumber: { type: 'integer', example: 2022012708, description: 'Institutional ID number' },
            email: { type: 'string', format: 'email', example: 'gian@usjr.edu.ph' },
            fullName: { type: 'string', example: 'Gian Carlo' },
            role: { type: 'string', enum: ['Admin', 'DepartmentHead', 'Educator', 'Student'], example: 'Student' },
            departmentId: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'], example: 'CPE' },
            departmentName: { type: 'string', example: 'Computer Engineering Department' },
            accountStatus: { type: 'string', enum: ['Active', 'PendingApproval', 'Rejected', 'Deactivated'], example: 'Active' },
            academicRank: { type: 'string', nullable: true, example: null },
            yearLevel: { type: 'string', nullable: true, example: '1st Year' },
            enrolledSubjects: { type: 'string', example: 'CPE101' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        UsersListResponse: {
          type: 'object',
          properties: {
            users: { type: 'array', items: { $ref: '#/components/schemas/UserProfile' } },
            total: { type: 'integer', example: 1 },
            counts: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                deptHeads: { type: 'integer' },
                educators: { type: 'integer' },
                students: { type: 'integer' },
                admins: { type: 'integer' },
              },
            },
          },
        },
        Department: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'CPE' },
            code: { type: 'string', example: 'CPE' },
            name: { type: 'string', example: 'Computer Engineering Department' },
            description: { type: 'string', example: 'College of Engineering' },
            _count: {
              type: 'object',
              properties: {
                courses: { type: 'integer', example: 13 },
                educators: { type: 'integer', example: 2 },
                students: { type: 'integer', example: 2 },
                syllabi: { type: 'integer', example: 3 },
              },
            },
          },
        },
        Course: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1, description: 'Internal database course ID' },
            code: { type: 'string', example: 'CPE101', description: 'Institutional course code' },
            title: { type: 'string', example: 'Computer Engineering as a Discipline' },
            description: { type: 'string', nullable: true, example: 'Foundational concepts in computer engineering.' },
            units: { type: 'integer', example: 3 },
            lecHours: { type: 'integer', example: 3 },
            labHours: { type: 'integer', example: 0 },
            prerequisite: { type: 'string', example: 'None' },
            yearLevel: { type: 'string', example: '1st Year' },
            semester: { type: 'string', example: '1st Semester' },
            departmentId: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'], example: 'CPE' },
            professorName: { type: 'string', nullable: true, example: 'Engr. Alan Turing', description: 'Professor responsible for syllabus' },
            department: { type: 'object', properties: { id: { type: 'string', example: 'CPE' }, code: { type: 'string', example: 'CPE' }, name: { type: 'string', example: 'Computer Engineering Department' } } },
            isEnrolled: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Enrollment: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '2022012708_1', description: 'Composite enrollment key (studentId_courseId)' },
            studentId: { type: 'integer', example: 2022012708, description: '10-digit student ID number' },
            studentName: { type: 'string', example: 'Gian Carlo' },
            courseId: { type: 'integer', example: 1, description: 'Internal database course ID' },
            semester: { type: 'string', example: '1st Semester' },
            academicYear: { type: 'string', example: '2026-2027' },
            section: { type: 'string', example: 'A' },
            status: { type: 'string', enum: ['ENROLLED', 'COMPLETED', 'DROPPED'], example: 'ENROLLED' },
            student: { $ref: '#/components/schemas/UserProfile' },
            course: { $ref: '#/components/schemas/Course' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Syllabus: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 10 },
            courseId: { type: 'integer', example: 1 },
            instructorId: { type: 'integer', example: 10001, description: '5-digit educator ID number' },
            departmentId: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'], example: 'CPE' },
            academicYear: { type: 'string', example: '2026-2027' },
            semester: { type: 'string', example: '1st Semester' },
            section: { type: 'string', example: 'A' },
            status: { type: 'string', enum: ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'ACTIVE', 'ARCHIVED'], example: 'Approved' },
            currentVersionNumber: { type: 'integer', example: 1 },
            reviewerRemarks: { type: 'string', nullable: true, example: 'Approved for 1st Semester AY 2026-2027.' },
            course: { $ref: '#/components/schemas/Course' },
            instructor: { $ref: '#/components/schemas/UserProfile' },
            department: { type: 'object' },
            latestVersion: { $ref: '#/components/schemas/SyllabusVersion' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        SyllabusVersion: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 25 },
            syllabusId: { type: 'integer', example: 10 },
            versionNumber: { type: 'integer', example: 1 },
            changeSummary: { type: 'string', example: 'Initial syllabus drafting (Version 1)' },
            approvalStatus: { type: 'string', enum: ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'APPROVED', 'REJECTED'], example: 'Approved' },
            statusAtSave: { type: 'string', example: 'Approved' },
            fileName: { type: 'string', nullable: true, example: 'cpe101_syllabus.pdf' },
            fileUrl: { type: 'string', nullable: true, example: '/uploads/syllabi/cpe101.pdf' },
            fileType: { type: 'string', nullable: true, example: 'PDF', enum: ['PDF'] },
            fileSize: { type: 'integer', nullable: true, example: 1048576 },
            submittedAt: { type: 'string', format: 'date-time', nullable: true },
            submittedById: { type: 'integer', nullable: true, example: 10001 },
            reviewedAt: { type: 'string', format: 'date-time', nullable: true },
            reviewedById: { type: 'integer', nullable: true, example: 10000 },
            rejectionReason: { type: 'string', nullable: true },
            content: { type: 'object' },
            syllabus: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AuditLog: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            userId: { type: 'integer', nullable: true, example: 2022012708 },
            userDisplayName: { type: 'string', nullable: true, example: 'Gian Carlo' },
            actionType: { type: 'string', example: 'Login' },
            resultStatus: { type: 'string', enum: ['Success', 'Failed', 'Warning'], example: 'Success' },
            description: { type: 'string', example: 'User successfully logged in as [Student]' },
            entityType: { type: 'string', nullable: true, example: 'User' },
            entityId: { type: 'string', nullable: true, example: '2022012708' },
            ipAddress: { type: 'string', nullable: true, example: '127.0.0.1' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec);
}
