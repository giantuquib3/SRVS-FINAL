const fs = require('fs');

// We will load the existing openapi route and update the spec
const filePath = 'src/app/api/openapi.json/route.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update '/api/auth/login' requestBody to document username, idNumber, and email
const loginRequestBodyReplacement = `          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['password'],
                  properties: {
                    idNumber: {
                      type: 'integer',
                      example: 2022012708,
                      description: 'Institutional user ID number (10 digits for Students, 5 digits for Educators/DeptHeads, or 0 for Admin). Can also pass string via username.',
                    },
                    username: {
                      type: 'string',
                      example: '2022012708',
                      description: 'Institutional ID number, admin alias ("admin", "00000"), or email address.',
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
          },`;

content = content.replace(/          requestBody: \{\s*required: true,\s*content: \{\s*'application\/json': \{\s*schema: \{\s*type: 'object',\s*required: \['idNumber', 'password'\],[\s\S]*?example: \{\s*idNumber: 2022012708,\s*password: 'Password123!',\s*\},\s*\},\s*\},\s*\},/m, loginRequestBodyReplacement);

// 2. Update '/api/auth/register' to allow Student and Faculty role
content = content.replace(
  /role: \{ type: 'string', enum: \['Student'\], example: 'Student', description: 'Optional. Defaults to Student. Any other value \(Educator, DepartmentHead, Admin\) is rejected with 403\.' \},/g,
  "role: { type: 'string', enum: ['Student', 'Faculty', 'Educator'], example: 'Student', description: 'Account role (Student or Faculty/Educator). Admin and DepartmentHead self-registration is blocked with 403.' },"
);

// 3. Update '/api/auth/register/student' to include program in required or properties
content = content.replace(
  /required: \['idNumber', 'fullName', 'email', 'password', 'departmentId'\],\s*properties: \{\s*idNumber: \{ type: 'integer', example: 2022012708, description: 'Student ID \(10 digits\)' \},\s*fullName: \{ type: 'string', example: 'Juan Dela Cruz' \},\s*email: \{ type: 'string', format: 'email', example: 'juan@usjr.edu.ph' \},\s*password: \{ type: 'string', format: 'password', minLength: 6, example: 'StudentPass123!' \},\s*departmentId: \{ type: 'string', enum: \['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'\], example: 'CPE' \},\s*program: \{ type: 'string', example: 'BS Computer Engineering' \},\s*\},/m,
  `required: ['idNumber', 'fullName', 'email', 'password', 'departmentId'],
                  properties: {
                    idNumber: { type: 'integer', example: 2022012708, description: 'Student ID (exactly 10 digits)' },
                    fullName: { type: 'string', example: 'Juan Dela Cruz', description: 'Full student name' },
                    email: { type: 'string', format: 'email', example: 'juan@usjr.edu.ph', description: 'Institutional email ending with @usjr.edu.ph' },
                    password: { type: 'string', format: 'password', minLength: 6, example: 'StudentPass123!' },
                    departmentId: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'], example: 'CPE', description: 'Academic department code' },
                    program: { type: 'string', example: 'BS Computer Engineering', description: 'Academic degree program' },
                    yearLevel: { type: 'string', enum: ['1st Year', '2nd Year', '3rd Year', '4th Year'], default: '1st Year', example: '1st Year' },
                  },`
);

// 4. Update '/api/users' GET to add all supported query parameters
const usersGetParamsReplacement = `          parameters: [
            {
              name: 'status',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['Active', 'PendingApproval', 'Rejected', 'Deactivated'] },
              description: 'Filter by account status.',
            },
            {
              name: 'role',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['Admin', 'DepartmentHead', 'Educator', 'Student'] },
              description: 'Filter by user role.',
            },
            {
              name: 'departmentId',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'] },
              description: 'Filter by academic department code (Admin only; DeptHeads automatically scoped to own department).',
            },
            {
              name: 'departmentCode',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'] },
              description: 'Alias for departmentId.',
            },
            {
              name: 'idNumber',
              in: 'query',
              required: false,
              schema: { type: 'integer', example: 2022012708 },
              description: 'Filter by exact institutional user ID number.',
            },
            {
              name: 'userId',
              in: 'query',
              required: false,
              schema: { type: 'integer' },
              description: 'Alias for idNumber.',
            },
            {
              name: 'id',
              in: 'query',
              required: false,
              schema: { type: 'integer' },
              description: 'Alias for idNumber.',
            },
            {
              name: 'search',
              in: 'query',
              required: false,
              schema: { type: 'string', example: 'Juan' },
              description: 'Search string across full name, email, or numeric ID.',
            },
          ],`;

content = content.replace(/          parameters: \[\s*\{\s*name: 'status',[\s\S]*?description: 'Search substring across full name and email\.',\s*\}\,\s*\],/m, usersGetParamsReplacement);

// 5. Update '/api/users' DELETE to document parameters
const usersDeleteReplacement = `        delete: {
          tags: ['2. Users & Administration'],
          summary: 'Deactivate User Account',
          description: 'Safely deactivates an account by setting \`accountStatus = "Deactivated"\` while preserving audit history, enrollments, and syllabus authoring records.',
          operationId: 'deactivateUser',
          security: [{ CookieAuth: [] }],
          parameters: [
            {
              name: 'userId',
              in: 'query',
              required: false,
              schema: { type: 'integer', example: 2022012708 },
              description: 'Institutional user ID number to deactivate.',
            },
            {
              name: 'idNumber',
              in: 'query',
              required: false,
              schema: { type: 'integer' },
              description: 'Alias for userId.',
            },
            {
              name: 'id',
              in: 'query',
              required: false,
              schema: { type: 'integer' },
              description: 'Alias for userId.',
            },
          ],
          responses: {
            '200': { description: 'User account deactivated successfully.' },
            '400': { description: 'Missing userId or attempting self-deactivation.' },
            '403': { description: 'Unauthorized or cross-department operation.' },
            '404': { description: 'User not found.' },
          },
        },`;

content = content.replace(/        delete: \{\s*tags: \['2\. Users & Administration'\],[\s\S]*?responses: \{\s*'200': \{ description: 'User account deactivated successfully\.' \},[\s\S]*?\},/m, usersDeleteReplacement);

// 6. Update '/api/courses' GET parameters to include courseId, courseCode, id, code
const coursesGetParamsReplacement = `          parameters: [
            {
              name: 'departmentId',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'] },
              description: 'Filter courses by academic department code.',
            },
            {
              name: 'courseId',
              in: 'query',
              required: false,
              schema: { type: 'integer', example: 10 },
              description: 'Filter by internal database course ID.',
            },
            {
              name: 'id',
              in: 'query',
              required: false,
              schema: { type: 'integer' },
              description: 'Alias for courseId.',
            },
            {
              name: 'courseCode',
              in: 'query',
              required: false,
              schema: { type: 'string', example: 'CPE101' },
              description: 'Filter by institutional course code.',
            },
            {
              name: 'code',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Alias for courseCode.',
            },
            {
              name: 'yearLevel',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['1st Year', '2nd Year', '3rd Year', '4th Year'] },
            },
            {
              name: 'semester',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['1st Semester', '2nd Semester', 'Summer'] },
            },
            {
              name: 'search',
              in: 'query',
              required: false,
              schema: { type: 'string', example: 'Circuits' },
              description: 'Search string across code, title, and professorName.',
            },
          ],`;

content = content.replace(/          parameters: \[\s*\{\s*name: 'departmentId',[\s\S]*?description: 'Search substring across course code and title\.',\s*\}\,\s*\],/m, coursesGetParamsReplacement);

// 7. Update '/api/syllabi' GET parameters to include search, semester, academicYear, mySyllabi
const syllabiGetParamsReplacement = `          parameters: [
            {
              name: 'departmentId',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'] },
            },
            {
              name: 'status',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['Draft', 'Submitted', 'Approved', 'Rejected', 'ACTIVE', 'ARCHIVED'] },
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
              name: 'semester',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['1st Semester', '2nd Semester', 'Summer'] },
            },
            {
              name: 'academicYear',
              in: 'query',
              required: false,
              schema: { type: 'string', example: '2026-2027' },
            },
            {
              name: 'search',
              in: 'query',
              required: false,
              schema: { type: 'string', example: 'Data Structures' },
              description: 'Search across course code, title, instructor name, and description.',
            },
            {
              name: 'mySyllabi',
              in: 'query',
              required: false,
              schema: { type: 'boolean' },
              description: 'Filter syllabi authored by the authenticated educator.',
            },
          ],`;

content = content.replace(/          parameters: \[\s*\{\s*name: 'departmentId',[\s\S]*?name: 'instructorId',[\s\S]*?\}\,\s*\],/m, syllabiGetParamsReplacement);

// 8. Update '/api/students' GET parameters to include department, userId, id
const studentsGetParamsReplacement = `          parameters: [
            {
              name: 'departmentId',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'] },
              description: 'Department filter.',
            },
            {
              name: 'department',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Alias for departmentId.',
            },
            {
              name: 'studentId',
              in: 'query',
              required: false,
              schema: { type: 'integer', example: 2022012708 },
              description: 'Filter by student 10-digit ID number.',
            },
            {
              name: 'idNumber',
              in: 'query',
              required: false,
              schema: { type: 'integer' },
              description: 'Alias for studentId.',
            },
            {
              name: 'userId',
              in: 'query',
              required: false,
              schema: { type: 'integer' },
              description: 'Alias for studentId.',
            },
            {
              name: 'id',
              in: 'query',
              required: false,
              schema: { type: 'integer' },
              description: 'Alias for studentId.',
            },
            {
              name: 'yearLevel',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['1st Year', '2nd Year', '3rd Year', '4th Year'] },
            },
            {
              name: 'search',
              in: 'query',
              required: false,
              schema: { type: 'string', example: 'Carlos' },
              description: 'Search student name, email, or ID.',
            },
          ],`;

content = content.replace(/          parameters: \[\s*\{\s*name: 'departmentId',[\s\S]*?description: 'Search student name or email\.',\s*\}\,\s*\],/m, studentsGetParamsReplacement);

// 9. Update '/api/department-head/pending-users' parameters
const pendingUsersParamsReplacement = `          parameters: [
            {
              name: 'departmentId',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['CPE', 'EE', 'CE', 'ECE', 'IE', 'ME'] },
              description: 'Department filter (Admin only; DeptHeads automatically scoped to own department).',
            },
            {
              name: 'role',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['Student', 'Faculty', 'Educator'] },
              description: 'Filter by applicant role.',
            },
            {
              name: 'search',
              in: 'query',
              required: false,
              schema: { type: 'string', example: 'Juan' },
              description: 'Search applicant name, email, or numeric ID.',
            },
            {
              name: 'format',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['flat', 'detailed'], default: 'flat' },
              description: 'Response format: "flat" returns an array of pending users, "detailed" returns { pendingUsers, counts: { students, faculty, total } }.',
            },
          ],`;

content = content.replace(/          parameters: \[\s*\{\s*name: 'departmentId',[\s\S]*?description: 'Filter by applicant role \(Student or Faculty\)\.',\s*\}\,\s*\],/m, pendingUsersParamsReplacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated parameters and request bodies in openapi.json/route.ts');
