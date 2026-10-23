import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const currentOrigin = new URL(req.url).origin;
  const specClone = {
    ...openApiSpec,
    servers: [
      { url: currentOrigin, description: `Active Origin (${currentOrigin})` },
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

const openApiSpec = {
  "openapi": "3.0.3",
  "info": {
    "title": "USJ-R SRVS API Documentation — Official Complete Specification",
    "version": "2.0.0",
    "description": "Official API documentation for the Syllabus Repository, Revision and Versioning System (SRVS) of the University of San Jose - Recoletos (USJ-R).",
    "contact": {
      "name": "USJ-R SRVS System Administrator",
      "email": "admin@usjr.edu.ph"
    }
  },
  "servers": [
    {
      "url": "/",
      "description": "Current Environment (Same-Origin Relative)"
    },
    {
      "url": "http://localhost:3000",
      "description": "Local Dev Server (Port 3000)"
    },
    {
      "url": "http://127.0.0.1:3000",
      "description": "Loopback (127.0.0.1:3000)"
    }
  ],
  "tags": [
    {
      "name": "1. Authentication",
      "description": "Session authentication, user registration, JWT cookie management, and identity verification."
    },
    {
      "name": "2. Users & Administration",
      "description": "Master institutional user directory (Admins, Department Heads, Educators, and Students), account approvals, role assignments, and deactivation."
    },
    {
      "name": "2b. Department Head Administration",
      "description": "Department-level administrator endpoints strictly scoped to the Department Head assigned department (CPE, EE, CE, ECE, IE, ME). Department Heads can create Faculty/Educators and Students with temporary passwords (mustChangePassword=true), view department users, and review/approve/reject student self-registrations."
    },
    {
      "name": "3. Departments",
      "description": "Institutional engineering departments catalog (CPE, EE, CE, ECE, IE, ME) and departmental statistics."
    },
    {
      "name": "4. Academic Subjects (Curriculum)",
      "description": "Academic subjects curriculum catalog (e.g. Programming, Networking, Mathematics), credit units, lecture/lab hours, prerequisites, and department assignments. /api/courses is supported as an alias."
    },
    {
      "name": "5. Enrollments",
      "description": "Student ⟷ subject enrollments stored in the student_subjects junction table (many-to-many: one student, many subjects; one subject, many students). Each student can be enrolled in a subject only once (UNIQUE studentId + subjectId)."
    },
    {
      "name": "6. Syllabus Management",
      "description": "Syllabus drafting, single PDF document uploads (max 20MB, DOCX not allowed), revision authoring, and version tracking."
    },
    {
      "name": "7. Syllabus Review & Approval",
      "description": "Department Head review workflow: Draft -> Submitted -> Under Review -> Approved / Rejected, remarks, and previous version comparisons."
    },
    {
      "name": "8. Audit Logs",
      "description": "Institutional security audit trails recording authentication, syllabus revisions, course catalog modifications, and enrollment changes."
    },
    {
      "name": "9. Dashboard / System Health",
      "description": "Role-scoped dashboard analytics and database connection latency diagnostics."
    },
    {
      "name": "10. Notifications & Announcements",
      "description": "In-app notifications and department announcements. NOTE: currently stub implementations — no database table backs them yet, so GET always returns an empty list."
    }
  ],
  "paths": {
    "/api/auth/login": {
      "post": {
        "tags": [
          "1. Authentication"
        ],
        "summary": "User Login with Institutional ID Number",
        "description": "Authenticate an institutional user using their ID number (or email) and password. Sets an HTTP-only secure session cookie (`srvs_token`).",
        "operationId": "loginUser",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "password"
                ],
                "properties": {
                  "idNumber": {
                    "type": "integer",
                    "example": 2022012708,
                    "description": "Institutional user ID number (10 digits for Students, 5 digits for Educators/DeptHeads, or 0 for Admin). Can also pass string via username."
                  },
                  "username": {
                    "type": "string",
                    "example": "2022012708",
                    "description": "User login ID identifier (alias of idNumber / email)"
                  },
                  "password": {
                    "type": "string",
                    "format": "password",
                    "example": "Password123!",
                    "description": "User account password."
                  },
                  "email": {
                    "type": "string",
                    "format": "email",
                    "example": "user@usjr.edu.ph",
                    "description": "Alternative login institutional email"
                  }
                }
              },
              "example": {
                "idNumber": 2022012708,
                "password": "Password123!"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Authentication successful. Returns user profile and sets session cookie.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/AuthSuccessResponse"
                },
                "example": {
                  "success": true,
                  "user": {
                    "id": 2022012708,
                    "idNumber": 2022012708,
                    "email": "gian@usjr.edu.ph",
                    "fullName": "Gian Carlo",
                    "role": "Student",
                    "departmentId": "CPE",
                    "departmentName": "Computer Engineering Department"
                  }
                }
              }
            }
          },
          "400": {
            "description": "Missing required ID number or password.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "401": {
            "description": "Invalid credentials.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "403": {
            "description": "Account pending approval or deactivated.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/register": {
      "post": {
        "tags": [
          "1. Authentication"
        ],
        "summary": "Self-Register Student or Faculty Account",
        "description": "Public self-registration for Students (10-digit ID) and Faculty (5-digit ID). Accounts start with PendingApproval status.",
        "operationId": "registerUser",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "idNumber",
                  "email",
                  "password",
                  "firstName",
                  "lastName",
                  "departmentId"
                ],
                "properties": {
                  "idNumber": {
                    "type": "integer",
                    "example": 2022012708,
                    "description": "Student ID number — exactly 10 digits"
                  },
                  "email": {
                    "type": "string",
                    "format": "email",
                    "example": "gian@usjr.edu.ph",
                    "description": "Institutional email ending with @usjr.edu.ph"
                  },
                  "password": {
                    "type": "string",
                    "format": "password",
                    "example": "Password123!",
                    "minLength": 6
                  },
                  "firstName": {
                    "type": "string",
                    "example": "Gian"
                  },
                  "lastName": {
                    "type": "string",
                    "example": "Tuquib"
                  },
                  "role": {
                    "type": "string",
                    "enum": [
                      "Student",
                      "Faculty",
                      "Educator"
                    ],
                    "example": "Student",
                    "description": "Account role (Student or Faculty/Educator). Admin and DepartmentHead self-registration is blocked with 403."
                  },
                  "departmentId": {
                    "type": "string",
                    "enum": [
                      "CPE",
                      "EE",
                      "CE",
                      "ECE",
                      "IE",
                      "ME"
                    ],
                    "example": "CPE"
                  },
                  "username": {
                    "type": "string",
                    "description": "Institutional ID number alias"
                  },
                  "employeeId": {
                    "type": "string",
                    "example": "10001",
                    "description": "5-digit Faculty ID number alias"
                  },
                  "studentId": {
                    "type": "string",
                    "example": "2022012708",
                    "description": "10-digit Student ID number alias"
                  },
                  "fullName": {
                    "type": "string",
                    "example": "Gian Tuquib",
                    "description": "Full legal name"
                  },
                  "program": {
                    "type": "string",
                    "example": "BS Computer Engineering",
                    "description": "Academic degree program for students"
                  },
                  "yearLevel": {
                    "type": "string",
                    "enum": [
                      "1st Year",
                      "2nd Year",
                      "3rd Year",
                      "4th Year"
                    ],
                    "example": "1st Year"
                  },
                  "academicRank": {
                    "type": "string",
                    "example": "Faculty Member",
                    "description": "Academic rank for educators"
                  }
                }
              },
              "example": {
                "idNumber": 2022012708,
                "email": "gian@usjr.edu.ph",
                "password": "Password123!",
                "firstName": "Gian",
                "lastName": "Carlo",
                "role": "Student",
                "departmentId": "CPE"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Account registered successfully.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/RegisterSuccessResponse"
                },
                "example": {
                  "message": "Account registered successfully! Your account is pending administrator approval before you can log in.",
                  "user": {
                    "id": 2022012708,
                    "idNumber": 2022012708,
                    "email": "gian@usjr.edu.ph",
                    "fullName": "Gian Carlo",
                    "role": "Student",
                    "departmentId": "CPE",
                    "accountStatus": "PendingApproval"
                  }
                }
              }
            }
          },
          "400": {
            "description": "Validation failed: Student ID must be 10 digits, institutional email format, password length, or invalid department code.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "403": {
            "description": "Forbidden: only Student accounts can be self-registered. Educator, Department Head, and Admin accounts must be created by an Admin.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "409": {
            "description": "User with this ID number or email already exists.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/register/student": {
      "post": {
        "tags": [
          "1. Authentication"
        ],
        "summary": "Student Self-Registration (10-Digit ID)",
        "description": "Dedicated student self-registration endpoint. Student ID must be exactly 10 digits and institutional email must end with `@usjr.edu.ph`. Saved with `PendingApproval` status and automatically routed to the Department Head.",
        "operationId": "registerStudent",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "idNumber",
                  "fullName",
                  "email",
                  "password",
                  "departmentId"
                ],
                "properties": {
                  "idNumber": {
                    "type": "integer",
                    "example": 2022012708,
                    "description": "Student ID (exactly 10 digits)"
                  },
                  "fullName": {
                    "type": "string",
                    "example": "Juan Dela Cruz",
                    "description": "Full student name"
                  },
                  "email": {
                    "type": "string",
                    "format": "email",
                    "example": "juan@usjr.edu.ph",
                    "description": "Institutional email ending with @usjr.edu.ph"
                  },
                  "password": {
                    "type": "string",
                    "format": "password",
                    "minLength": 6,
                    "example": "StudentPass123!"
                  },
                  "departmentId": {
                    "type": "string",
                    "enum": [
                      "CPE",
                      "EE",
                      "CE",
                      "ECE",
                      "IE",
                      "ME"
                    ],
                    "example": "CPE",
                    "description": "Academic department code"
                  },
                  "program": {
                    "type": "string",
                    "example": "BS Computer Engineering"
                  },
                  "yearLevel": {
                    "type": "string",
                    "enum": [
                      "1st Year",
                      "2nd Year",
                      "3rd Year",
                      "4th Year"
                    ],
                    "example": "1st Year"
                  },
                  "studentId": {
                    "type": "string",
                    "example": "2022012708",
                    "description": "10-digit Student ID alias"
                  },
                  "username": {
                    "type": "string",
                    "example": "2022012708",
                    "description": "Student ID alias"
                  },
                  "firstName": {
                    "type": "string",
                    "example": "Gian"
                  },
                  "lastName": {
                    "type": "string",
                    "example": "Tuquib"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Student registered successfully with PendingApproval status."
          },
          "400": {
            "description": "Validation failed (ID not 10 digits, invalid email, short password)."
          },
          "409": {
            "description": "Account with this ID or email already exists."
          }
        }
      }
    },
    "/api/auth/register/faculty": {
      "post": {
        "tags": [
          "1. Authentication"
        ],
        "summary": "Faculty Self-Registration (5-Digit ID)",
        "description": "Dedicated faculty self-registration endpoint. Faculty ID must be exactly 5 digits and institutional email must end with `@usjr.edu.ph`. Saved with `PendingApproval` status and automatically routed to the Department Head.",
        "operationId": "registerFaculty",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "idNumber",
                  "fullName",
                  "email",
                  "password",
                  "departmentId"
                ],
                "properties": {
                  "idNumber": {
                    "type": "integer",
                    "example": 12345,
                    "description": "Faculty employee ID (5 digits)"
                  },
                  "fullName": {
                    "type": "string",
                    "example": "Engr. Ralph Lima"
                  },
                  "email": {
                    "type": "string",
                    "format": "email",
                    "example": "ralph@usjr.edu.ph"
                  },
                  "password": {
                    "type": "string",
                    "format": "password",
                    "minLength": 6,
                    "example": "FacultyPass123!"
                  },
                  "departmentId": {
                    "type": "string",
                    "enum": [
                      "CPE",
                      "EE",
                      "CE",
                      "ECE",
                      "IE",
                      "ME"
                    ],
                    "example": "CPE"
                  },
                  "academicRank": {
                    "type": "string",
                    "example": "Assistant Professor"
                  },
                  "employeeId": {
                    "type": "string",
                    "example": "10001",
                    "description": "5-digit Faculty ID alias"
                  },
                  "username": {
                    "type": "string",
                    "example": "10001",
                    "description": "Faculty ID alias"
                  },
                  "firstName": {
                    "type": "string",
                    "example": "Gian"
                  },
                  "lastName": {
                    "type": "string",
                    "example": "Tuquib"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Faculty registered successfully with PendingApproval status."
          },
          "400": {
            "description": "Validation failed (ID not 5 digits, invalid email, short password)."
          },
          "409": {
            "description": "Account with this ID or email already exists."
          }
        }
      }
    },
    "/api/auth/logout": {
      "post": {
        "tags": [
          "1. Authentication"
        ],
        "summary": "User Logout",
        "description": "Clears the session cookie (`srvs_token`) and logs the logout event in audit trail. **No parameters or request body** — the user is identified from the session cookie.",
        "operationId": "logoutUser",
        "security": [
          {
            "CookieAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Successfully logged out.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "message": {
                      "type": "string",
                      "example": "Logged out successfully."
                    }
                  }
                }
              }
            }
          }
        },
        "requestBody": {
          "required": false,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "reason": {
                    "type": "string",
                    "example": "User clicked logout button"
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/forgot-password": {
      "post": {
        "tags": [
          "1. Authentication"
        ],
        "summary": "Reset Password with ID Number + Institutional Email",
        "description": "Resets the password of the account whose `idNumber` AND `email` both match. Rejected/Deactivated accounts cannot reset.",
        "operationId": "forgotPassword",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "idNumber",
                  "email",
                  "newPassword"
                ],
                "properties": {
                  "idNumber": {
                    "type": "integer",
                    "example": 2022012708
                  },
                  "email": {
                    "type": "string",
                    "format": "email",
                    "example": "gian.tuquib@usjr.edu.ph"
                  },
                  "newPassword": {
                    "type": "string",
                    "format": "password",
                    "minLength": 6,
                    "example": "NewPass123!"
                  },
                  "confirmPassword": {
                    "type": "string",
                    "example": "NewPass2026!",
                    "description": "Password confirmation matching newPassword"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Password reset successful."
          },
          "400": {
            "description": "Missing fields, password too short, or passwords do not match.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "403": {
            "description": "Account is rejected or deactivated."
          },
          "404": {
            "description": "No account matches this ID number and email."
          }
        }
      }
    },
    "/api/auth/me": {
      "get": {
        "tags": [
          "1. Authentication"
        ],
        "summary": "Get Authenticated Session Profile",
        "description": "Returns profile details and active course enrollments of the currently logged-in user. **No parameters or request body** — the user is identified from the session cookie.",
        "operationId": "getCurrentSession",
        "security": [
          {
            "CookieAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Profile of current authenticated session.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "user": {
                      "$ref": "#/components/schemas/UserProfile"
                    }
                  }
                },
                "example": {
                  "user": {
                    "id": 2022012708,
                    "idNumber": 2022012708,
                    "email": "gian@usjr.edu.ph",
                    "fullName": "Gian Carlo",
                    "role": "Student",
                    "departmentId": "CPE",
                    "departmentCode": "CPE",
                    "departmentName": "Computer Engineering Department",
                    "yearLevel": "1st Year",
                    "enrolledSubjects": "CPE101",
                    "enrollments": []
                  }
                }
              }
            }
          },
          "401": {
            "description": "Not authenticated or session expired.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    "/api/users": {
      "get": {
        "tags": [
          "2. Users & Administration"
        ],
        "summary": "List Institutional Users",
        "description": "Retrieve users list. Department Heads automatically only view Educators and Students within their assigned department (Department Isolation). Admins view all users.",
        "operationId": "getUsers",
        "parameters": [
          {
            "name": "idNumber",
            "in": "query",
            "schema": {
              "type": "integer",
              "example": 2022012708
            },
            "description": "Filter by exact numeric ID number"
          },
          {
            "name": "role",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "Admin",
                "DepartmentHead",
                "Educator",
                "Student"
              ]
            }
          },
          {
            "name": "departmentId",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "CPE",
                "EE",
                "CE",
                "ECE",
                "IE",
                "ME"
              ]
            }
          },
          {
            "name": "status",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "Active",
                "PendingApproval",
                "Rejected",
                "Deactivated"
              ]
            }
          },
          {
            "name": "search",
            "in": "query",
            "schema": {
              "type": "string"
            },
            "description": "Keyword search across name, email, or numeric ID"
          },
          {
            "name": "departmentCode",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "CPE",
                "EE",
                "CE",
                "ECE",
                "IE",
                "ME"
              ]
            },
            "description": "Filter directory by department code (alias of departmentId)"
          },
          {
            "name": "userId",
            "in": "query",
            "schema": {
              "type": "integer"
            },
            "description": "Filter directory by user numeric ID (alias of idNumber)"
          },
          {
            "name": "id",
            "in": "query",
            "schema": {
              "type": "integer"
            },
            "description": "Filter directory by user numeric ID (alias of idNumber)"
          }
        ],
        "responses": {
          "200": {
            "description": "List of institutional users and summary counts.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/UsersListResponse"
                },
                "example": {
                  "users": [
                    {
                      "id": 2022012708,
                      "idNumber": 2022012708,
                      "email": "gian@usjr.edu.ph",
                      "fullName": "Gian Carlo",
                      "role": "Student",
                      "departmentId": "CPE",
                      "departmentName": "Computer Engineering Department",
                      "accountStatus": "Active",
                      "academicRank": null,
                      "yearLevel": "1st Year",
                      "enrolledCourses": [
                        "CPE101"
                      ],
                      "createdAt": "2026-09-01T08:00:00.000Z"
                    }
                  ],
                  "total": 1,
                  "counts": {
                    "total": 1,
                    "deptHeads": 0,
                    "educators": 0,
                    "students": 1,
                    "admins": 0
                  }
                }
              }
            }
          },
          "403": {
            "description": "Unauthorized: Requires Administrator or Department Head role."
          }
        }
      },
      "post": {
        "tags": [
          "2. Users & Administration"
        ],
        "summary": "Create Admin or Department Head Account (Admin Only)",
        "description": "Administrators can provision only Admin and Department Head accounts. Students and Faculty must self-register through the public registration portal.",
        "operationId": "createUser",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "idNumber",
                  "email",
                  "fullName",
                  "role",
                  "password"
                ],
                "properties": {
                  "idNumber": {
                    "type": "integer",
                    "example": 10001,
                    "description": "5-digit ID (or 0 for Super Admin)"
                  },
                  "email": {
                    "type": "string",
                    "format": "email",
                    "example": "cpe.head@usjr.edu.ph"
                  },
                  "fullName": {
                    "type": "string",
                    "example": "Dr. Computer Eng Chair"
                  },
                  "role": {
                    "type": "string",
                    "enum": [
                      "Admin",
                      "DepartmentHead"
                    ],
                    "example": "DepartmentHead"
                  },
                  "departmentId": {
                    "type": "string",
                    "enum": [
                      "CPE",
                      "EE",
                      "CE",
                      "ECE",
                      "IE",
                      "ME"
                    ],
                    "example": "CPE",
                    "description": "Required for DepartmentHead"
                  },
                  "password": {
                    "type": "string",
                    "example": "Password123!"
                  },
                  "accountStatus": {
                    "type": "string",
                    "enum": [
                      "Active",
                      "Deactivated"
                    ],
                    "example": "Active"
                  },
                  "userId": {
                    "type": "integer",
                    "example": 10001,
                    "description": "User ID (alias of idNumber)"
                  },
                  "academicRank": {
                    "type": "string",
                    "example": "Department Chairperson"
                  },
                  "yearLevel": {
                    "type": "string",
                    "enum": [
                      "1st Year",
                      "2nd Year",
                      "3rd Year",
                      "4th Year"
                    ],
                    "example": "1st Year"
                  },
                  "program": {
                    "type": "string",
                    "example": "BS Computer Engineering"
                  }
                }
              },
              "example": {
                "idNumber": 10001,
                "email": "faculty@usjr.edu.ph",
                "fullName": "Engr. Alan Turing",
                "role": "Educator",
                "departmentId": "CPE",
                "password": "Password123!",
                "accountStatus": "Active"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "User successfully created.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "user": {
                      "$ref": "#/components/schemas/UserProfile"
                    }
                  }
                },
                "example": {
                  "success": true,
                  "user": {
                    "id": 10001,
                    "idNumber": 10001,
                    "email": "faculty@usjr.edu.ph",
                    "fullName": "Engr. Alan Turing",
                    "role": "Educator",
                    "departmentId": "CPE",
                    "departmentName": "Computer Engineering Department",
                    "accountStatus": "Active",
                    "academicRank": "Faculty Member",
                    "yearLevel": null,
                    "createdAt": "2026-09-29T10:00:00.000Z"
                  }
                }
              }
            }
          },
          "400": {
            "description": "Missing required fields or invalid ID format."
          },
          "403": {
            "description": "Unauthorized: Admin access required."
          },
          "409": {
            "description": "User ID or email already exists."
          }
        }
      },
      "patch": {
        "tags": [
          "2. Users & Administration"
        ],
        "summary": "Update User Profile or Status (Approve/Reject/Deactivate)",
        "description": "Approve or reject pending registrations, update role, department, or deactivate users.",
        "operationId": "updateUser",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "idNumber"
                ],
                "properties": {
                  "idNumber": {
                    "type": "integer",
                    "example": 2022012708
                  },
                  "action": {
                    "type": "string",
                    "enum": [
                      "Approve",
                      "Reject",
                      "Deactivate",
                      "Activate"
                    ],
                    "example": "Approve"
                  },
                  "role": {
                    "type": "string",
                    "enum": [
                      "Admin",
                      "DepartmentHead",
                      "Educator",
                      "Student"
                    ]
                  },
                  "departmentId": {
                    "type": "string",
                    "enum": [
                      "CPE",
                      "EE",
                      "CE",
                      "ECE",
                      "IE",
                      "ME"
                    ]
                  },
                  "accountStatus": {
                    "type": "string",
                    "enum": [
                      "Active",
                      "PendingApproval",
                      "Rejected",
                      "Deactivated"
                    ]
                  },
                  "userId": {
                    "type": "integer",
                    "example": 10001,
                    "description": "Target user numeric ID (alias of idNumber)"
                  },
                  "newRole": {
                    "type": "string",
                    "enum": [
                      "Admin",
                      "DepartmentHead",
                      "Educator",
                      "Student"
                    ],
                    "example": "DepartmentHead",
                    "description": "Updated user role"
                  },
                  "fullName": {
                    "type": "string",
                    "example": "Gian Tuquib"
                  },
                  "academicRank": {
                    "type": "string",
                    "example": "Associate Professor"
                  },
                  "yearLevel": {
                    "type": "string",
                    "enum": [
                      "1st Year",
                      "2nd Year",
                      "3rd Year",
                      "4th Year"
                    ],
                    "example": "2nd Year"
                  },
                  "program": {
                    "type": "string",
                    "example": "BS Computer Engineering"
                  },
                  "reason": {
                    "type": "string",
                    "example": "Administrative account update"
                  },
                  "rejectionReason": {
                    "type": "string",
                    "example": "Incomplete documentation"
                  }
                }
              },
              "example": {
                "idNumber": 2022012708,
                "action": "Approve"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "User updated successfully.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "user": {
                      "$ref": "#/components/schemas/UserProfile"
                    }
                  }
                },
                "example": {
                  "success": true,
                  "user": {
                    "id": 2022012708,
                    "idNumber": 2022012708,
                    "email": "gian@usjr.edu.ph",
                    "fullName": "Gian Carlo",
                    "role": "Student",
                    "departmentId": "CPE",
                    "departmentName": "Computer Engineering Department",
                    "accountStatus": "Active"
                  }
                }
              }
            }
          },
          "404": {
            "description": "User not found."
          }
        }
      },
      "delete": {
        "tags": [
          "2. Users & Administration"
        ],
        "summary": "Deactivate User Account (Audit-Preserving)",
        "description": "Deactivates an account to prevent login while preserving all institutional audit trails, syllabus revisions, and enrollment histories intact.",
        "operationId": "deactivateUser",
        "parameters": [
          {
            "name": "idNumber",
            "in": "query",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 2022012708
            },
            "description": "Institutional ID number of user to deactivate"
          },
          {
            "name": "userId",
            "in": "query",
            "schema": {
              "type": "integer"
            },
            "description": "Numeric user ID to deactivate (alias of idNumber)"
          },
          {
            "name": "id",
            "in": "query",
            "schema": {
              "type": "integer"
            },
            "description": "Numeric user ID to deactivate (alias of idNumber)"
          }
        ],
        "responses": {
          "200": {
            "description": "User account deactivated successfully.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                },
                "example": {
                  "success": true,
                  "message": "User account 2022012708 deactivated successfully. Institutional audit records and author history preserved."
                }
              }
            }
          },
          "400": {
            "description": "Cannot deactivate own account or missing ID."
          },
          "404": {
            "description": "User not found."
          }
        }
      }
    },
    "/api/students": {
      "get": {
        "tags": [
          "2. Users & Administration"
        ],
        "summary": "List Enrolled Students Directory (Admin / Department Head)",
        "description": "Retrieve students with enrolled course lists. Department Heads are restricted to their assigned department.",
        "operationId": "getStudents",
        "parameters": [
          {
            "name": "studentId",
            "in": "query",
            "schema": {
              "type": "integer",
              "example": 2022012708
            },
            "description": "Filter by student 10-digit ID number"
          },
          {
            "name": "idNumber",
            "in": "query",
            "schema": {
              "type": "integer",
              "example": 2022012708
            },
            "description": "Alternative alias for student ID number"
          },
          {
            "name": "departmentId",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "CPE",
                "EE",
                "CE",
                "ECE",
                "IE",
                "ME"
              ]
            },
            "description": "Filter by department code"
          },
          {
            "name": "search",
            "in": "query",
            "schema": {
              "type": "string",
              "example": "Gian"
            },
            "description": "Search by full name, email, or ID number"
          },
          {
            "name": "department",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "CPE",
                "EE",
                "CE",
                "ECE",
                "IE",
                "ME"
              ]
            },
            "description": "Department code filter (alias of departmentId)"
          },
          {
            "name": "userId",
            "in": "query",
            "schema": {
              "type": "integer"
            },
            "description": "Student ID filter (alias of studentId / idNumber)"
          },
          {
            "name": "id",
            "in": "query",
            "schema": {
              "type": "integer"
            },
            "description": "Student primary key ID filter (alias of studentId / idNumber)"
          }
        ],
        "responses": {
          "200": {
            "description": "List of students.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "students": {
                      "type": "array",
                      "items": {
                        "type": "object"
                      }
                    },
                    "count": {
                      "type": "integer",
                      "example": 1
                    }
                  }
                },
                "example": {
                  "students": [
                    {
                      "id": 2022012708,
                      "idNumber": "2022012708",
                      "fullName": "Gian Carlo",
                      "email": "gian@usjr.edu.ph",
                      "department": "CPE",
                      "departmentName": "Computer Engineering Department",
                      "yearLevel": "4th Year",
                      "accountStatus": "Active",
                      "enrolledCourses": [
                        1,
                        2
                      ]
                    }
                  ],
                  "count": 1
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized."
          },
          "403": {
            "description": "Forbidden: Requires Admin or Department Head role."
          }
        }
      }
    },
    "/api/department-head/pending-users": {
      "get": {
        "tags": [
          "2b. Department Head Administration"
        ],
        "summary": "List Pending User Registrations (Department Head / Admin)",
        "description": "Retrieve pending Student and Faculty self-registration requests belonging strictly to the Department Head assigned department (`PendingApproval` status). Department isolation is enforced server-side. Returns array of pending users by default or detailed summary when `?format=detailed` is requested.",
        "operationId": "getPendingUsers",
        "parameters": [
          {
            "name": "role",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "student",
                "faculty",
                "all"
              ]
            },
            "description": "Filter by user role"
          },
          {
            "name": "search",
            "in": "query",
            "schema": {
              "type": "string"
            },
            "description": "Search by full name, email, or numeric ID"
          },
          {
            "name": "format",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "array",
                "detailed"
              ]
            },
            "description": "Response format"
          },
          {
            "name": "departmentId",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "CPE",
                "EE",
                "CE",
                "ECE",
                "IE",
                "ME"
              ]
            },
            "description": "Department filter (Administrator use; Department Heads are strictly scoped to their assigned department)"
          }
        ],
        "responses": {
          "200": {
            "description": "Array or detailed list of pending student and faculty registrations.",
            "content": {
              "application/json": {
                "example": [
                  {
                    "id": 2022012708,
                    "idNumber": 2022012708,
                    "role": "Student",
                    "type": "Student",
                    "name": "Juan Dela Cruz",
                    "fullName": "Juan Dela Cruz",
                    "email": "juan@usjr.edu.ph",
                    "department": "CPE",
                    "departmentId": "CPE",
                    "program": "BS Computer Engineering",
                    "status": "PendingApproval",
                    "accountStatus": "PendingApproval"
                  },
                  {
                    "id": 12345,
                    "idNumber": 12345,
                    "role": "Faculty",
                    "type": "Faculty",
                    "name": "Ralph Lima",
                    "fullName": "Ralph Lima",
                    "email": "ralph@usjr.edu.ph",
                    "department": "CPE",
                    "departmentId": "CPE",
                    "academicRank": "Assistant Professor",
                    "status": "PendingApproval",
                    "accountStatus": "PendingApproval"
                  }
                ]
              }
            }
          },
          "401": {
            "description": "Unauthorized."
          },
          "403": {
            "description": "Forbidden: Requires Department Head or Admin role."
          }
        }
      }
    },
    "/api/department-head/users/{id}/approve": {
      "post": {
        "tags": [
          "2b. Department Head Administration"
        ],
        "summary": "Approve User Registration (Department Head / Admin)",
        "description": "Approve a pending Student or Faculty registration request (`PendingApproval -> Active`). Server strictly verifies that the user belongs to the Department Head assigned department. Cross-department approvals return HTTP 403 Forbidden. Records `StudentApproved` or `FacultyApproved` in the audit trail.",
        "operationId": "approveDepartmentUser",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 2022012708
            },
            "description": "User numeric ID (10 digits for student, 5 digits for faculty)"
          }
        ],
        "responses": {
          "200": {
            "description": "User registration approved successfully.",
            "content": {
              "application/json": {
                "example": {
                  "success": true,
                  "message": "Student registration for Juan Dela Cruz has been approved. The user may now log in.",
                  "user": {
                    "id": 2022012708,
                    "fullName": "Juan Dela Cruz",
                    "role": "Student",
                    "departmentId": "CPE",
                    "accountStatus": "Active"
                  }
                }
              }
            }
          },
          "400": {
            "description": "Invalid user ID or account not pending approval."
          },
          "403": {
            "description": "Forbidden: Cannot approve user belonging to another department."
          },
          "404": {
            "description": "User registration record not found."
          }
        }
      }
    },
    "/api/department-head/users/{id}/reject": {
      "post": {
        "tags": [
          "2b. Department Head Administration"
        ],
        "summary": "Reject User Registration (Department Head / Admin)",
        "description": "Reject a pending Student or Faculty registration request (`PendingApproval -> Rejected`). Rejection reason is saved and returned when user attempts to sign in. Server enforces strict department scoping. Records `StudentRejected` or `FacultyRejected` in audit trail.",
        "operationId": "rejectDepartmentUser",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 2022012708
            },
            "description": "User numeric ID"
          }
        ],
        "requestBody": {
          "required": false,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "reason": {
                    "type": "string",
                    "example": "Applicant does not belong to this department."
                  }
                }
              },
              "example": {
                "reason": "Invalid student ID number."
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "User registration rejected successfully.",
            "content": {
              "application/json": {
                "example": {
                  "success": true,
                  "message": "Student registration for Juan Dela Cruz has been rejected.",
                  "user": {
                    "id": 2022012708,
                    "fullName": "Juan Dela Cruz",
                    "role": "Student",
                    "departmentId": "CPE",
                    "accountStatus": "Rejected",
                    "rejectionReason": "Invalid student ID number."
                  }
                }
              }
            }
          },
          "403": {
            "description": "Forbidden: Cannot reject user belonging to another department."
          },
          "404": {
            "description": "User record not found."
          }
        }
      }
    },
    "/api/department-head/faculty": {
      "get": {
        "tags": [
          "2b. Department Head Administration"
        ],
        "summary": "List Department Faculty Members (Department Head / Admin)",
        "description": "Retrieve faculty members belonging strictly to the authenticated Department Head assigned department (CPE, EE, CE, ECE, IE, ME). Department isolation is enforced server-side. System Administrators can view all or filter by department.",
        "operationId": "getDepartmentFaculty",
        "parameters": [
          {
            "name": "search",
            "in": "query",
            "schema": {
              "type": "string"
            },
            "description": "Keyword search by full name, email, or 5-digit numeric ID"
          },
          {
            "name": "status",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "Active",
                "Deactivated"
              ]
            },
            "description": "Filter by account status"
          },
          {
            "name": "departmentId",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "CPE",
                "EE",
                "CE",
                "ECE",
                "IE",
                "ME"
              ]
            },
            "description": "Department filter (Administrator use; Department Heads are strictly scoped to their assigned department)"
          }
        ],
        "responses": {
          "200": {
            "description": "List of department faculty members.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "faculty": {
                      "type": "array",
                      "items": {
                        "type": "object"
                      }
                    },
                    "total": {
                      "type": "integer",
                      "example": 4
                    },
                    "departmentId": {
                      "type": "string",
                      "example": "CPE"
                    }
                  }
                },
                "example": {
                  "faculty": [
                    {
                      "id": 10001,
                      "idNumber": 10001,
                      "email": "cpe.head@usjr.edu.ph",
                      "fullName": "Dr. Computer Eng Chair",
                      "role": "Educator",
                      "departmentId": "CPE",
                      "departmentName": "Computer Engineering Department",
                      "academicRank": "Chairperson",
                      "accountStatus": "Active",
                      "mustChangePassword": false,
                      "createdAt": "2026-01-01T08:00:00.000Z"
                    }
                  ],
                  "total": 1,
                  "departmentId": "CPE"
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized: Session missing or invalid."
          },
          "403": {
            "description": "Forbidden: Department Head or Admin access required."
          }
        }
      },
      "post": {
        "tags": [
          "2b. Department Head Administration"
        ],
        "summary": "Create Faculty Member in Department (Department Head / Admin)",
        "description": "Allows a Department Head to create a new Faculty / Educator account strictly within their own assigned department. The account is created with a temporary password and `MustChangePassword = true`. Cross-department creation is blocked server-side (HTTP 403).",
        "operationId": "createDepartmentFaculty",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "idNumber",
                  "fullName",
                  "email"
                ],
                "properties": {
                  "idNumber": {
                    "type": "integer",
                    "example": 10002,
                    "description": "Faculty ID number (must be exactly 5 digits)"
                  },
                  "fullName": {
                    "type": "string",
                    "example": "Engr. Juan Dela Cruz",
                    "description": "Faculty full name"
                  },
                  "email": {
                    "type": "string",
                    "format": "email",
                    "example": "jdelacruz@usjr.edu.ph",
                    "description": "Institutional email (must end with @usjr.edu.ph)"
                  },
                  "academicRank": {
                    "type": "string",
                    "example": "Faculty Member",
                    "description": "Faculty rank / title"
                  },
                  "password": {
                    "type": "string",
                    "example": "USJR@Faculty2026",
                    "description": "Temporary initial password"
                  },
                  "userId": {
                    "type": "integer",
                    "example": 10001,
                    "description": "Faculty 5-digit ID (alias of idNumber)"
                  },
                  "departmentId": {
                    "type": "string",
                    "enum": [
                      "CPE",
                      "EE",
                      "CE",
                      "ECE",
                      "IE",
                      "ME"
                    ],
                    "example": "CPE",
                    "description": "Department code"
                  },
                  "accountStatus": {
                    "type": "string",
                    "enum": [
                      "Active",
                      "PendingApproval",
                      "Rejected",
                      "Deactivated"
                    ],
                    "example": "Active"
                  }
                }
              },
              "example": {
                "idNumber": 10002,
                "fullName": "Engr. Juan Dela Cruz",
                "email": "jdelacruz@usjr.edu.ph",
                "academicRank": "Assistant Professor",
                "password": "USJR@Faculty2026"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Faculty account created successfully.",
            "content": {
              "application/json": {
                "example": {
                  "success": true,
                  "message": "Faculty account created successfully for Engr. Juan Dela Cruz.",
                  "user": {
                    "id": 10002,
                    "idNumber": 10002,
                    "email": "jdelacruz@usjr.edu.ph",
                    "fullName": "Engr. Juan Dela Cruz",
                    "role": "Educator",
                    "departmentId": "CPE",
                    "departmentName": "Computer Engineering Department",
                    "academicRank": "Assistant Professor",
                    "accountStatus": "Active",
                    "mustChangePassword": true
                  },
                  "temporaryPassword": "USJR@Faculty2026"
                }
              }
            }
          },
          "400": {
            "description": "Validation failed (e.g., ID not 5 digits or invalid email)."
          },
          "403": {
            "description": "Forbidden: Cannot create accounts outside assigned department, or attempting to create Admin/DeptHead role."
          },
          "409": {
            "description": "User with this ID or email already exists."
          }
        }
      }
    },
    "/api/department-head/faculty/{id}": {
      "put": {
        "tags": [
          "2b. Department Head Administration"
        ],
        "summary": "Update / Activate / Deactivate Department Faculty (Department Head / Admin)",
        "description": "Update faculty details or activate/deactivate account. Server enforces that the target faculty belongs strictly to the Department Head department.",
        "operationId": "updateDepartmentFaculty",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 10002
            },
            "description": "5-digit faculty ID"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "fullName": {
                    "type": "string",
                    "example": "Engr. Juan Dela Cruz"
                  },
                  "email": {
                    "type": "string",
                    "example": "jdelacruz@usjr.edu.ph"
                  },
                  "academicRank": {
                    "type": "string",
                    "example": "Associate Professor"
                  },
                  "accountStatus": {
                    "type": "string",
                    "enum": [
                      "Active",
                      "Deactivated"
                    ],
                    "example": "Active"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Faculty account updated successfully."
          },
          "403": {
            "description": "Forbidden: Target faculty belongs to another department."
          },
          "404": {
            "description": "Faculty member not found."
          }
        }
      },
      "get": {
        "tags": [
          "2b. Department Head Administration"
        ],
        "summary": "Retrieve Department Faculty Member by ID",
        "description": "Fetches details of an individual faculty member within the Department Head assigned department.",
        "security": [
          {
            "bearerAuth": []
          },
          {
            "cookieAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer"
            },
            "description": "Faculty 5-digit ID number"
          }
        ],
        "responses": {
          "200": {
            "description": "Faculty details retrieved.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "user": {
                      "$ref": "#/components/schemas/User"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Invalid faculty ID."
          },
          "403": {
            "description": "Forbidden — cross-department access prohibited."
          },
          "404": {
            "description": "Faculty member not found."
          },
          "500": {
            "description": "Internal server error."
          }
        }
      },
      "patch": {
        "tags": [
          "2b. Department Head Administration"
        ],
        "summary": "Partial Update Department Faculty Member (PATCH Alias)",
        "description": "Updates faculty profile, academic rank, account status, or resets password with mustChangePassword flag.",
        "security": [
          {
            "bearerAuth": []
          },
          {
            "cookieAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer"
            },
            "description": "Faculty 5-digit institutional ID number"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "fullName": {
                    "type": "string",
                    "example": "Engr. Juan Dela Cruz"
                  },
                  "email": {
                    "type": "string",
                    "example": "jdelacruz@usjr.edu.ph"
                  },
                  "academicRank": {
                    "type": "string",
                    "example": "Associate Professor"
                  },
                  "accountStatus": {
                    "type": "string",
                    "enum": [
                      "Active",
                      "Deactivated"
                    ],
                    "example": "Active"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Faculty account updated successfully."
          },
          "403": {
            "description": "Forbidden: Target faculty belongs to another department."
          },
          "404": {
            "description": "Faculty member not found."
          }
        }
      }
    },
    "/api/department-head/students": {
      "get": {
        "tags": [
          "2b. Department Head Administration"
        ],
        "summary": "List Department Students (Department Head / Admin)",
        "description": "Retrieve students belonging strictly to the Department Head assigned department. Department isolation is strictly enforced server-side.",
        "operationId": "getDepartmentStudents",
        "parameters": [
          {
            "name": "search",
            "in": "query",
            "schema": {
              "type": "string"
            },
            "description": "Keyword search by full name, email, or 10-digit student ID"
          },
          {
            "name": "status",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "Active",
                "PendingApproval",
                "Rejected",
                "Deactivated"
              ]
            }
          },
          {
            "name": "yearLevel",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "1st Year",
                "2nd Year",
                "3rd Year",
                "4th Year"
              ]
            }
          },
          {
            "name": "departmentId",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "CPE",
                "EE",
                "CE",
                "ECE",
                "IE",
                "ME"
              ]
            },
            "description": "Department filter (Administrator use; Department Heads are strictly scoped to their assigned department)"
          }
        ],
        "responses": {
          "200": {
            "description": "List of department students.",
            "content": {
              "application/json": {
                "example": {
                  "students": [
                    {
                      "id": 2026010001,
                      "idNumber": 2026010001,
                      "email": "m.santos@usjr.edu.ph",
                      "fullName": "Maria Santos",
                      "role": "Student",
                      "departmentId": "CPE",
                      "departmentName": "Computer Engineering Department",
                      "yearLevel": "1st Year",
                      "program": "BS Computer Engineering",
                      "accountStatus": "Active",
                      "mustChangePassword": false,
                      "enrolledCourses": [
                        "CPE101"
                      ]
                    }
                  ],
                  "total": 1,
                  "departmentId": "CPE"
                }
              }
            }
          },
          "403": {
            "description": "Forbidden: Department Head or Admin access required."
          }
        }
      },
      "post": {
        "tags": [
          "2b. Department Head Administration"
        ],
        "summary": "Create Student Account in Department (Department Head / Admin)",
        "description": "Allows a Department Head to create a new Student account strictly within their own assigned department with temporary password and `MustChangePassword = true`. Cross-department creation is blocked server-side.",
        "operationId": "createDepartmentStudent",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "idNumber",
                  "fullName",
                  "email"
                ],
                "properties": {
                  "idNumber": {
                    "type": "integer",
                    "example": 2026010001,
                    "description": "Student ID number (must be exactly 10 digits)"
                  },
                  "fullName": {
                    "type": "string",
                    "example": "Maria Santos",
                    "description": "Student full name"
                  },
                  "email": {
                    "type": "string",
                    "format": "email",
                    "example": "m.santos@usjr.edu.ph",
                    "description": "Institutional email"
                  },
                  "yearLevel": {
                    "type": "string",
                    "example": "1st Year"
                  },
                  "program": {
                    "type": "string",
                    "example": "BS Computer Engineering"
                  },
                  "password": {
                    "type": "string",
                    "example": "USJR@Student2026"
                  },
                  "studentId": {
                    "type": "integer",
                    "example": 2022012708,
                    "description": "Student 10-digit ID (alias of idNumber)"
                  },
                  "userId": {
                    "type": "integer",
                    "example": 2022012708,
                    "description": "Student 10-digit ID (alias of idNumber)"
                  },
                  "departmentId": {
                    "type": "string",
                    "enum": [
                      "CPE",
                      "EE",
                      "CE",
                      "ECE",
                      "IE",
                      "ME"
                    ],
                    "example": "CPE"
                  },
                  "accountStatus": {
                    "type": "string",
                    "enum": [
                      "Active",
                      "PendingApproval",
                      "Rejected",
                      "Deactivated"
                    ],
                    "example": "Active"
                  }
                }
              },
              "example": {
                "idNumber": 2026010001,
                "fullName": "Maria Santos",
                "email": "m.santos@usjr.edu.ph",
                "yearLevel": "1st Year",
                "program": "BS Computer Engineering",
                "password": "USJR@Student2026"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Student account created successfully.",
            "content": {
              "application/json": {
                "example": {
                  "success": true,
                  "message": "Student account created successfully for Maria Santos.",
                  "user": {
                    "id": 2026010001,
                    "idNumber": 2026010001,
                    "email": "m.santos@usjr.edu.ph",
                    "fullName": "Maria Santos",
                    "role": "Student",
                    "departmentId": "CPE",
                    "departmentName": "Computer Engineering Department",
                    "yearLevel": "1st Year",
                    "program": "BS Computer Engineering",
                    "accountStatus": "Active",
                    "mustChangePassword": true
                  },
                  "temporaryPassword": "USJR@Student2026"
                }
              }
            }
          },
          "400": {
            "description": "Validation failed (e.g. ID not 10 digits)."
          },
          "403": {
            "description": "Forbidden: Cannot create students outside assigned department."
          },
          "409": {
            "description": "User with this ID or email already exists."
          }
        }
      }
    },
    "/api/department-head/students/{id}": {
      "put": {
        "tags": [
          "2b. Department Head Administration"
        ],
        "summary": "Update / Activate / Deactivate Department Student (Department Head / Admin)",
        "description": "Update student details or activate/deactivate account. Server enforces that the target student belongs strictly to the Department Head assigned department.",
        "operationId": "updateDepartmentStudent",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 2026010001
            },
            "description": "10-digit student ID"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "fullName": {
                    "type": "string",
                    "example": "Maria Santos"
                  },
                  "email": {
                    "type": "string",
                    "example": "m.santos@usjr.edu.ph"
                  },
                  "yearLevel": {
                    "type": "string",
                    "example": "2nd Year"
                  },
                  "program": {
                    "type": "string",
                    "example": "BS Computer Engineering"
                  },
                  "accountStatus": {
                    "type": "string",
                    "enum": [
                      "Active",
                      "Deactivated"
                    ]
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Student account updated successfully."
          },
          "403": {
            "description": "Forbidden: Target student belongs to another department."
          },
          "404": {
            "description": "Student not found."
          }
        }
      },
      "get": {
        "tags": [
          "2b. Department Head Administration"
        ],
        "summary": "Retrieve Department Student by ID",
        "description": "Fetches details of an individual student within the Department Head assigned department.",
        "security": [
          {
            "bearerAuth": []
          },
          {
            "cookieAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer"
            },
            "description": "Student 10-digit ID number"
          }
        ],
        "responses": {
          "200": {
            "description": "Student details retrieved.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "user": {
                      "$ref": "#/components/schemas/User"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Invalid student ID."
          },
          "403": {
            "description": "Forbidden — cross-department access prohibited."
          },
          "404": {
            "description": "Student not found."
          },
          "500": {
            "description": "Internal server error."
          }
        }
      },
      "patch": {
        "tags": [
          "2b. Department Head Administration"
        ],
        "summary": "Partial Update Department Student (PATCH Alias)",
        "description": "Updates student record, year level, degree program, account status, or resets password.",
        "security": [
          {
            "bearerAuth": []
          },
          {
            "cookieAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer"
            },
            "description": "Student 10-digit ID number"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "fullName": {
                    "type": "string",
                    "example": "Maria Santos"
                  },
                  "email": {
                    "type": "string",
                    "example": "m.santos@usjr.edu.ph"
                  },
                  "yearLevel": {
                    "type": "string",
                    "example": "2nd Year"
                  },
                  "program": {
                    "type": "string",
                    "example": "BS Computer Engineering"
                  },
                  "accountStatus": {
                    "type": "string",
                    "enum": [
                      "Active",
                      "Deactivated"
                    ]
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Student account updated successfully."
          },
          "403": {
            "description": "Forbidden: Target student belongs to another department."
          },
          "404": {
            "description": "Student not found."
          }
        }
      }
    },
    "/api/department-head/student-registrations": {
      "get": {
        "tags": [
          "2b. Department Head Administration"
        ],
        "summary": "List Student Self-Registration Requests (Department Head / Admin)",
        "description": "Retrieve pending student self-registration requests belonging strictly to the Department Head assigned department (`PendingApproval` status). Allows Department Heads to review incoming registrations before granting login access.",
        "operationId": "getStudentRegistrations",
        "parameters": [
          {
            "name": "status",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "PendingApproval",
                "Active",
                "Rejected",
                "all"
              ],
              "default": "PendingApproval"
            },
            "description": "Filter by registration status"
          },
          {
            "name": "search",
            "in": "query",
            "schema": {
              "type": "string"
            },
            "description": "Search by student name, email, or ID"
          },
          {
            "name": "departmentId",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "CPE",
                "EE",
                "CE",
                "ECE",
                "IE",
                "ME"
              ]
            },
            "description": "Department filter (Administrator use; Department Heads are strictly scoped to their assigned department)"
          }
        ],
        "responses": {
          "200": {
            "description": "List of student registration requests for the department.",
            "content": {
              "application/json": {
                "example": {
                  "registrations": [
                    {
                      "id": 2022010099,
                      "idNumber": 2022010099,
                      "studentId": "2022010099",
                      "email": "student.pending@usjr.edu.ph",
                      "fullName": "Pending Approval User",
                      "role": "Student",
                      "departmentId": "CPE",
                      "departmentName": "Computer Engineering Department",
                      "program": "BS Computer Engineering",
                      "yearLevel": "1st Year",
                      "accountStatus": "PendingApproval",
                      "rejectionReason": null,
                      "reviewedBy": null,
                      "reviewedAt": null,
                      "createdAt": "2026-03-01T10:00:00.000Z"
                    }
                  ],
                  "total": 1,
                  "departmentId": "CPE"
                }
              }
            }
          },
          "403": {
            "description": "Forbidden: Requires Department Head or Admin role."
          }
        }
      }
    },
    "/api/department-head/student-registrations/{id}": {
      "get": {
        "tags": [
          "2b. Department Head Administration"
        ],
        "summary": "View Single Student Registration Request (Department Head / Admin)",
        "description": "View full registration details and audit review history for a specific student registration request. Department isolation is strictly enforced.",
        "operationId": "getStudentRegistrationById",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 2022010099
            },
            "description": "Student 10-digit ID"
          }
        ],
        "responses": {
          "200": {
            "description": "Registration request details with review audit history."
          },
          "403": {
            "description": "Forbidden: Registration belongs to another department."
          },
          "404": {
            "description": "Registration record not found."
          }
        }
      }
    },
    "/api/department-head/student-registrations/{id}/approve": {
      "post": {
        "tags": [
          "2b. Department Head Administration"
        ],
        "summary": "Approve Student Registration Request (Department Head / Admin)",
        "description": "Approve a pending student self-registration request (`PendingApproval -> Active`). Once approved, the student is allowed to log in. Cross-department approval is strictly blocked (HTTP 403). Records `StudentRegistrationApproved` in audit trail.",
        "operationId": "approveStudentRegistration",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 2022010099
            },
            "description": "Student 10-digit ID"
          }
        ],
        "responses": {
          "200": {
            "description": "Student registration approved successfully.",
            "content": {
              "application/json": {
                "example": {
                  "success": true,
                  "message": "Student registration for Pending Approval User has been approved. The student may now log in.",
                  "student": {
                    "id": 2022010099,
                    "email": "student.pending@usjr.edu.ph",
                    "fullName": "Pending Approval User",
                    "role": "Student",
                    "departmentId": "CPE",
                    "departmentName": "Computer Engineering Department",
                    "accountStatus": "Active"
                  }
                }
              }
            }
          },
          "403": {
            "description": "Forbidden: Student belongs to another department."
          },
          "404": {
            "description": "Student registration record not found."
          }
        }
      }
    },
    "/api/department-head/student-registrations/{id}/reject": {
      "post": {
        "tags": [
          "2b. Department Head Administration"
        ],
        "summary": "Reject Student Registration Request (Department Head / Admin)",
        "description": "Reject a pending student self-registration request (`PendingApproval -> Rejected`). The rejection reason is stored and returned to the student if they attempt to log in. Records `StudentRegistrationRejected` in audit trail.",
        "operationId": "rejectStudentRegistration",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 2022010099
            },
            "description": "Student 10-digit ID"
          }
        ],
        "requestBody": {
          "required": false,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "reason": {
                    "type": "string",
                    "example": "Unverified enrolled ID number."
                  },
                  "rejectionReason": {
                    "type": "string",
                    "example": "Unverified enrolled ID number."
                  }
                }
              },
              "example": {
                "reason": "Student ID does not match department master enrollment records. Please visit the Department office."
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Student registration rejected successfully.",
            "content": {
              "application/json": {
                "example": {
                  "success": true,
                  "message": "Student registration for Pending Approval User has been rejected.",
                  "student": {
                    "id": 2022010099,
                    "email": "student.pending@usjr.edu.ph",
                    "fullName": "Pending Approval User",
                    "role": "Student",
                    "departmentId": "CPE",
                    "accountStatus": "Rejected",
                    "rejectionReason": "Student ID does not match department master enrollment records."
                  }
                }
              }
            }
          },
          "403": {
            "description": "Forbidden: Student belongs to another department."
          },
          "404": {
            "description": "Student registration record not found."
          }
        }
      }
    },
    "/api/departments": {
      "get": {
        "tags": [
          "3. Departments"
        ],
        "summary": "List Academic Engineering Departments",
        "description": "Returns the 6 institutional engineering departments (CPE, EE, CE, ECE, IE, ME) with real-time course, student, and faculty counts.",
        "operationId": "getDepartments",
        "parameters": [
          {
            "name": "search",
            "in": "query",
            "schema": {
              "type": "string"
            },
            "description": "Filter departments by code or name"
          }
        ],
        "responses": {
          "200": {
            "description": "List of engineering departments.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "departments": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/Department"
                      }
                    }
                  }
                },
                "example": {
                  "departments": [
                    {
                      "id": "CPE",
                      "code": "CPE",
                      "name": "Computer Engineering Department",
                      "description": "College of Engineering",
                      "_count": {
                        "subjects": 13,
                        "courses": 13,
                        "users": 5,
                        "educators": 2,
                        "students": 2,
                        "syllabi": 3
                      }
                    },
                    {
                      "id": "EE",
                      "code": "EE",
                      "name": "Electrical Engineering Department",
                      "description": "College of Engineering",
                      "_count": {
                        "subjects": 8,
                        "courses": 8,
                        "users": 3,
                        "educators": 1,
                        "students": 1,
                        "syllabi": 1
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/courses": {
      "get": {
        "tags": [
          "4. Academic Subjects (Curriculum)"
        ],
        "summary": "List Curriculum Subjects (Backwards-Compatibility Alias)",
        "description": "Backwards-compatibility alias delegating to /api/subjects. Returns academic subjects array with both 'subjects' and 'courses' keys.",
        "operationId": "getCoursesAlias",
        "parameters": [
          {
            "name": "subjectId",
            "in": "query",
            "schema": {
              "type": "integer",
              "example": 1
            },
            "description": "Subject ID filter"
          },
          {
            "name": "code",
            "in": "query",
            "schema": {
              "type": "string",
              "example": "CPE101"
            },
            "description": "Subject code filter"
          },
          {
            "name": "search",
            "in": "query",
            "schema": {
              "type": "string",
              "example": "Programming"
            },
            "description": "Search query for subject code or title"
          },
          {
            "name": "departmentId",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "CPE",
                "EE",
                "CE",
                "ECE",
                "IE",
                "ME"
              ]
            },
            "description": "Department code filter"
          },
          {
            "name": "yearLevel",
            "in": "query",
            "schema": {
              "type": "string",
              "example": "1st Year"
            },
            "description": "Academic year level filter"
          },
          {
            "name": "semester",
            "in": "query",
            "schema": {
              "type": "string",
              "example": "1st Semester"
            },
            "description": "Semester filter"
          },
          {
            "name": "courseId",
            "in": "query",
            "schema": {
              "type": "integer"
            },
            "description": "Backwards-compatibility alias for subjectId"
          },
          {
            "name": "courseCode",
            "in": "query",
            "schema": {
              "type": "string"
            },
            "description": "Backwards-compatibility alias for code"
          }
        ],
        "responses": {
          "200": {
            "description": "List of curriculum academic subjects.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "subjects": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/Subject"
                      }
                    },
                    "courses": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/Subject"
                      }
                    },
                    "total": {
                      "type": "integer",
                      "example": 14
                    }
                  }
                }
              }
            }
          }
        }
      },
      "post": {
        "tags": [
          "4. Academic Subjects (Curriculum)"
        ],
        "summary": "Create Subject (Backwards-Compatibility Alias)",
        "description": "Backwards-compatibility alias delegating to POST /api/subjects.",
        "operationId": "createCourseAlias",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "code",
                  "title",
                  "departmentId"
                ],
                "properties": {
                  "code": {
                    "type": "string",
                    "example": "CPE201",
                    "description": "Unique subject code"
                  },
                  "title": {
                    "type": "string",
                    "example": "Data Structures and Algorithms",
                    "description": "Subject title"
                  },
                  "description": {
                    "type": "string",
                    "example": "Fundamental data structures and algorithmic complexity."
                  },
                  "units": {
                    "type": "integer",
                    "default": 3,
                    "example": 3
                  },
                  "lecHours": {
                    "type": "integer",
                    "default": 3,
                    "example": 3
                  },
                  "labHours": {
                    "type": "integer",
                    "default": 0,
                    "example": 0
                  },
                  "prerequisite": {
                    "type": "string",
                    "example": "CPE101"
                  },
                  "yearLevel": {
                    "type": "string",
                    "example": "2nd Year"
                  },
                  "semester": {
                    "type": "string",
                    "example": "1st Semester"
                  },
                  "departmentId": {
                    "type": "string",
                    "enum": [
                      "CPE",
                      "EE",
                      "CE",
                      "ECE",
                      "IE",
                      "ME"
                    ],
                    "example": "CPE"
                  },
                  "professorName": {
                    "type": "string",
                    "example": "Engr. Ada Lovelace"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Academic subject created successfully.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "message": {
                      "type": "string",
                      "example": "Subject created successfully."
                    },
                    "subject": {
                      "$ref": "#/components/schemas/Subject"
                    },
                    "course": {
                      "$ref": "#/components/schemas/Subject"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Missing required fields or invalid input."
          },
          "403": {
            "description": "Forbidden: Department Head restricted to their department."
          },
          "409": {
            "description": "Subject code already exists."
          }
        }
      }
    },
    "/api/enrollments": {
      "get": {
        "tags": [
          "5. Enrollments"
        ],
        "summary": "List Student–Subject Enrollments",
        "description": "Lists rows of the student_subjects junction table joined with the student (users) and subject (subjects), including the subject's latest APPROVED syllabus. Students only see their own enrollments; Department Heads see enrollments for subjects in their department; Administrators see all; Educators are forbidden. Student names come from users.fullName and subject titles from subjects.title (neither is stored on student_subjects). Returns status = ENROLLED unless ?status= is given.",
        "operationId": "getEnrollments",
        "parameters": [
          {
            "name": "studentId",
            "in": "query",
            "schema": {
              "type": "integer",
              "example": 2022012708
            },
            "description": "Student ID (ignored for Students — they always see their own). Alias: idNumber"
          },
          {
            "name": "subjectId",
            "in": "query",
            "schema": {
              "type": "integer",
              "example": 3
            },
            "description": "Subject primary key (subjects.id). Alias: courseId"
          },
          {
            "name": "subjectCode",
            "in": "query",
            "schema": {
              "type": "string",
              "example": "CPE301"
            },
            "description": "Subject code. Alias: courseCode"
          },
          {
            "name": "status",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "ENROLLED",
                "COMPLETED",
                "DROPPED",
                "ALL"
              ],
              "default": "ENROLLED"
            },
            "description": "Enrollment status filter; ALL returns every status"
          },
          {
            "name": "semester",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "1st Semester",
                "2nd Semester",
                "Summer"
              ]
            }
          },
          {
            "name": "academicYear",
            "in": "query",
            "schema": {
              "type": "string",
              "example": "2026-2027"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "List of enrollments.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "enrollments": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/Enrollment"
                      }
                    },
                    "total": {
                      "type": "integer",
                      "example": 1
                    }
                  }
                },
                "example": {
                  "enrollments": [
                    {
                      "id": 21,
                      "studentId": 2022012708,
                      "studentName": "Gian Carlo Tuquib",
                      "subjectId": 3,
                      "courseId": 3,
                      "status": "ENROLLED",
                      "academicYear": "2026-2027",
                      "semester": "1st Semester",
                      "enrolledById": 10001,
                      "enrolledBy": {
                        "id": 10001,
                        "fullName": "Engr. CPE Chairperson",
                        "role": "DepartmentHead"
                      },
                      "createdAt": "2026-10-23T08:00:00.000Z",
                      "student": {
                        "id": 2022012708,
                        "idNumber": 2022012708,
                        "fullName": "Gian Carlo Tuquib",
                        "email": "gian.tuquib@usjr.edu.ph",
                        "departmentId": "CPE",
                        "yearLevel": "3rd Year"
                      },
                      "subject": {
                        "id": 3,
                        "code": "CPE301",
                        "title": "Computer Architecture and Organization",
                        "units": 3,
                        "departmentId": "CPE",
                        "professorName": "Dr. Alan Turing",
                        "department": {
                          "id": "CPE",
                          "code": "CPE",
                          "name": "Computer Engineering Department"
                        },
                        "activeSyllabus": {
                          "id": 1,
                          "status": "APPROVED",
                          "academicYear": "2026-2027",
                          "semester": "1st Semester",
                          "currentVersionNumber": 2
                        }
                      }
                    }
                  ],
                  "total": 1
                }
              }
            }
          },
          "401": {
            "description": "Not authenticated.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "403": {
            "description": "Role not permitted to list enrollments (e.g. Educator).",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      },
      "post": {
        "tags": [
          "5. Enrollments"
        ],
        "summary": "Enroll Student in a Subject",
        "description": "Creates a student_subjects row. A student may be enrolled in many subjects and a subject may have many students, but the same student can be enrolled in a given subject only once (checked by the API and enforced by the uq_student_subjects UNIQUE constraint). The student must exist and have role Student (also enforced by a database trigger); the subject must exist (foreign keys). Students can only enroll themselves; Department Heads only within their own department; Educators are forbidden. The session user is recorded as enrolledById.",
        "operationId": "createEnrollment",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "studentId": {
                    "type": "integer",
                    "example": 2022012708,
                    "description": "Student University ID (users.id). Required for Admin/DepartmentHead; ignored for Students (the session user is used). Alias: idNumber"
                  },
                  "subjectId": {
                    "type": "integer",
                    "example": 3,
                    "description": "Subject ID (subjects.id). Alias: courseId"
                  },
                  "subjectCode": {
                    "type": "string",
                    "example": "CPE301",
                    "description": "Alternative to subjectId. Alias: courseCode"
                  },
                  "status": {
                    "type": "string",
                    "enum": [
                      "ENROLLED",
                      "COMPLETED",
                      "DROPPED"
                    ],
                    "example": "ENROLLED",
                    "description": "Default ENROLLED. Students may only create ENROLLED records.",
                    "default": "ENROLLED"
                  },
                  "academicYear": {
                    "type": "string",
                    "pattern": "^\\d{4}-\\d{4}$",
                    "example": "2026-2027",
                    "description": "School year the student takes the subject (CHECK: YYYY-YYYY).",
                    "default": "2026-2027"
                  },
                  "semester": {
                    "type": "string",
                    "enum": [
                      "1st Semester",
                      "2nd Semester",
                      "Summer"
                    ],
                    "example": "1st Semester",
                    "default": "1st Semester"
                  }
                }
              },
              "example": {
                "studentId": 2022012708,
                "subjectId": 3,
                "semester": "1st Semester",
                "academicYear": "2026-2027",
                "status": "ENROLLED"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Student enrolled.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "enrollment": {
                      "$ref": "#/components/schemas/Enrollment"
                    }
                  }
                },
                "example": {
                  "success": true,
                  "enrollment": {
                    "id": 21,
                    "studentId": 2022012708,
                    "studentName": "Gian Carlo Tuquib",
                    "subjectId": 3,
                    "courseId": 3,
                    "status": "ENROLLED",
                    "academicYear": "2026-2027",
                    "semester": "1st Semester",
                    "enrolledById": 10001,
                    "enrolledBy": {
                      "id": 10001,
                      "fullName": "Engr. CPE Chairperson",
                      "role": "DepartmentHead"
                    },
                    "createdAt": "2026-10-23T08:00:00.000Z",
                    "student": {
                      "id": 2022012708,
                      "idNumber": 2022012708,
                      "fullName": "Gian Carlo Tuquib",
                      "email": "gian.tuquib@usjr.edu.ph",
                      "departmentId": "CPE",
                      "yearLevel": "3rd Year"
                    },
                    "subject": {
                      "id": 3,
                      "code": "CPE301",
                      "title": "Computer Architecture and Organization",
                      "units": 3,
                      "departmentId": "CPE",
                      "professorName": "Dr. Alan Turing",
                      "department": {
                        "id": "CPE",
                        "code": "CPE",
                        "name": "Computer Engineering Department"
                      }
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Missing/invalid studentId, invalid status / academicYear / semester, or the user is not a Student.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                },
                "example": {
                  "error": "User Dr. Alan Turing (ID: 10001) has role \"DepartmentHead\". Only users whose role is \"Student\" may be enrolled in subjects."
                }
              }
            }
          },
          "401": {
            "description": "Not authenticated.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "403": {
            "description": "Role not permitted, or department isolation violated.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "404": {
            "description": "Student or subject not found.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                },
                "example": {
                  "error": "Subject not found. Please provide a valid subjectId or subjectCode."
                }
              }
            }
          },
          "409": {
            "description": "The student is already enrolled in this subject.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                },
                "example": {
                  "error": "Gian Carlo Tuquib is already enrolled in [CPE301] Computer Architecture and Organization."
                }
              }
            }
          }
        }
      },
      "patch": {
        "tags": [
          "5. Enrollments"
        ],
        "summary": "Update Enrollment Status / Term",
        "description": "Changes the status (e.g. mark COMPLETED or DROPPED), academic year or semester of one enrollment. Admin or Department Head (own department only). The change is written to the audit log. studentId and subjectId cannot be changed — delete and re-create the enrollment instead.",
        "operationId": "updateEnrollment",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "id"
                ],
                "properties": {
                  "id": {
                    "type": "integer",
                    "example": 21,
                    "description": "student_subjects.id"
                  },
                  "status": {
                    "type": "string",
                    "enum": [
                      "ENROLLED",
                      "COMPLETED",
                      "DROPPED"
                    ],
                    "example": "ENROLLED",
                    "description": "Enrollment status (CHECK constraint). Only ENROLLED gives the student access to the approved syllabus."
                  },
                  "academicYear": {
                    "type": "string",
                    "pattern": "^\\d{4}-\\d{4}$",
                    "example": "2026-2027",
                    "description": "School year the student takes the subject (CHECK: YYYY-YYYY)."
                  },
                  "semester": {
                    "type": "string",
                    "enum": [
                      "1st Semester",
                      "2nd Semester",
                      "Summer"
                    ],
                    "example": "1st Semester"
                  }
                }
              },
              "example": {
                "id": 21,
                "status": "COMPLETED"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Enrollment updated.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "enrollment": {
                      "$ref": "#/components/schemas/Enrollment"
                    }
                  }
                },
                "example": {
                  "success": true,
                  "enrollment": {
                    "id": 21,
                    "studentId": 2022012708,
                    "studentName": "Gian Carlo Tuquib",
                    "subjectId": 3,
                    "courseId": 3,
                    "status": "COMPLETED",
                    "academicYear": "2026-2027",
                    "semester": "1st Semester",
                    "enrolledById": 10001,
                    "enrolledBy": {
                      "id": 10001,
                      "fullName": "Engr. CPE Chairperson",
                      "role": "DepartmentHead"
                    },
                    "createdAt": "2026-10-23T08:00:00.000Z",
                    "student": {
                      "id": 2022012708,
                      "idNumber": 2022012708,
                      "fullName": "Gian Carlo Tuquib",
                      "email": "gian.tuquib@usjr.edu.ph",
                      "departmentId": "CPE",
                      "yearLevel": "3rd Year"
                    },
                    "subject": {
                      "id": 3,
                      "code": "CPE301",
                      "title": "Computer Architecture and Organization",
                      "units": 3,
                      "departmentId": "CPE",
                      "professorName": "Dr. Alan Turing",
                      "department": {
                        "id": "CPE",
                        "code": "CPE",
                        "name": "Computer Engineering Department"
                      }
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Missing id, nothing to update, or an invalid status / academicYear / semester.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "401": {
            "description": "Not authenticated.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "403": {
            "description": "Not an Admin / Department Head, or the subject belongs to another department.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "404": {
            "description": "Enrollment not found.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      },
      "delete": {
        "tags": [
          "5. Enrollments"
        ],
        "summary": "Unenroll Student from Subject",
        "description": "Deletes a student_subjects row, identified by its id or by studentId + subjectId/subjectCode. Students may only remove their own enrollments; Department Heads only within their department. The action is recorded in the audit log.",
        "operationId": "deleteEnrollment",
        "parameters": [
          {
            "name": "id",
            "in": "query",
            "schema": {
              "type": "integer",
              "example": 21
            },
            "description": "Enrollment primary key (student_subjects.id) — preferred"
          },
          {
            "name": "studentId",
            "in": "query",
            "schema": {
              "type": "integer",
              "example": 2022012708
            },
            "description": "Student ID (ignored for Students). Alias: idNumber"
          },
          {
            "name": "subjectId",
            "in": "query",
            "schema": {
              "type": "integer",
              "example": 3
            },
            "description": "Subject ID. Alias: courseId"
          },
          {
            "name": "subjectCode",
            "in": "query",
            "schema": {
              "type": "string",
              "example": "CPE301"
            },
            "description": "Subject code. Alias: courseCode"
          }
        ],
        "responses": {
          "200": {
            "description": "Student unenrolled.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                },
                "example": {
                  "success": true,
                  "message": "Student unenrolled successfully."
                }
              }
            }
          },
          "400": {
            "description": "Neither an enrollment id nor studentId + subjectId/subjectCode was provided.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "401": {
            "description": "Not authenticated.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "403": {
            "description": "Not allowed to manage this enrollment.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          "404": {
            "description": "Enrollment not found.",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    "/api/syllabi": {
      "get": {
        "tags": [
          "6. Syllabus Management"
        ],
        "summary": "List Syllabi Catalog",
        "description": "Retrieve syllabus repository records. Department Heads and Educators are restricted to their assigned department. Students only see approved syllabi for courses they are enrolled in.",
        "operationId": "getSyllabi",
        "parameters": [
          {
            "name": "courseId",
            "in": "query",
            "schema": {
              "type": "integer",
              "example": 1
            },
            "description": "Database course integer ID"
          },
          {
            "name": "courseCode",
            "in": "query",
            "schema": {
              "type": "string",
              "example": "CPE101"
            },
            "description": "Course code"
          },
          {
            "name": "instructorId",
            "in": "query",
            "schema": {
              "type": "integer",
              "example": 10001
            }
          },
          {
            "name": "departmentId",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "CPE",
                "EE",
                "CE",
                "ECE",
                "IE",
                "ME"
              ]
            }
          },
          {
            "name": "status",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "DRAFT",
                "SUBMITTED",
                "UNDER_REVIEW",
                "APPROVED",
                "REJECTED",
                "ARCHIVED",
                "ALL"
              ]
            }
          },
          {
            "name": "mySyllabi",
            "in": "query",
            "schema": {
              "type": "boolean",
              "example": false
            },
            "description": "Filter only syllabi authored by the logged-in educator"
          },
          {
            "name": "semester",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "1st Semester",
                "2nd Semester",
                "Summer"
              ]
            },
            "description": "Filter syllabi by academic semester"
          },
          {
            "name": "academicYear",
            "in": "query",
            "schema": {
              "type": "string"
            },
            "description": "Filter syllabi by academic year (e.g. 2024-2025)"
          },
          {
            "name": "search",
            "in": "query",
            "schema": {
              "type": "string"
            },
            "description": "Search string matching course code, course title, or instructor name"
          },
          {
            "name": "id",
            "in": "query",
            "schema": {
              "type": "integer"
            },
            "description": "Course internal database ID filter (alias of courseId)"
          },
          {
            "name": "idNumber",
            "in": "query",
            "schema": {
              "type": "integer"
            },
            "description": "Instructor ID number filter (alias of instructorId)"
          }
        ],
        "responses": {
          "200": {
            "description": "List of syllabi.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "syllabi": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/Syllabus"
                      }
                    },
                    "total": {
                      "type": "integer",
                      "example": 1
                    }
                  }
                },
                "example": {
                  "syllabi": [
                    {
                      "id": 10,
                      "courseId": 1,
                      "instructorId": 10001,
                      "departmentId": "CPE",
                      "academicYear": "2026-2027",
                      "semester": "1st Semester",
                      "section": "A",
                      "status": "Approved",
                      "currentVersionNumber": 1,
                      "course": {
                        "id": 1,
                        "code": "CPE101",
                        "title": "Computer Engineering as a Discipline",
                        "units": 3,
                        "departmentId": "CPE"
                      },
                      "instructor": {
                        "id": 10001,
                        "idNumber": 10001,
                        "fullName": "Engr. Alan Turing",
                        "email": "faculty@usjr.edu.ph",
                        "role": "Educator"
                      },
                      "latestVersion": {
                        "id": 25,
                        "versionNumber": 1,
                        "approvalStatus": "Approved",
                        "fileUrl": "/uploads/syllabi/cpe101.pdf",
                        "fileType": "PDF"
                      }
                    }
                  ],
                  "total": 1
                }
              }
            }
          }
        }
      },
      "post": {
        "tags": [
          "6. Syllabus Management"
        ],
        "summary": "Create or Submit New Syllabus (Educator / Dept Head)",
        "description": "Creates Version 1 of a syllabus. Uploader identity (`instructorId`) is strictly verified from authenticated session. Revisions follow workflow: `Draft` -> `Submitted` -> `Under Review` -> `Approved` / `Rejected`.",
        "operationId": "createSyllabus",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "courseId",
                  "semester",
                  "academicYear"
                ],
                "properties": {
                  "courseId": {
                    "type": "integer",
                    "example": 1,
                    "description": "Internal database course ID"
                  },
                  "courseCode": {
                    "type": "string",
                    "example": "CPE101"
                  },
                  "semester": {
                    "type": "string",
                    "example": "1st Semester"
                  },
                  "academicYear": {
                    "type": "string",
                    "example": "2026-2027"
                  },
                  "section": {
                    "type": "string",
                    "example": "A"
                  },
                  "courseDescription": {
                    "type": "string",
                    "example": "Introduction to hardware and software engineering principles."
                  },
                  "learningOutcomes": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "example": [
                      "Understand digital systems",
                      "Design logic gates"
                    ]
                  },
                  "saveAsDraft": {
                    "type": "boolean",
                    "example": false,
                    "description": "If false, submits for Department Head review"
                  },
                  "fileUrl": {
                    "type": "string",
                    "example": "/uploads/syllabi/cpe101.pdf",
                    "description": "URL of uploaded PDF document"
                  },
                  "fileName": {
                    "type": "string",
                    "example": "cpe101_syllabus.pdf"
                  },
                  "fileType": {
                    "type": "string",
                    "example": "PDF",
                    "enum": [
                      "PDF"
                    ]
                  },
                  "fileSize": {
                    "type": "integer",
                    "example": 1048576
                  },
                  "topics": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "Course weekly modules and lecture topics"
                  },
                  "references": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "Course references and textbooks"
                  },
                  "gradingSystem": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    },
                    "description": "Grading scale and assessment weight breakdown"
                  },
                  "schedule": {
                    "type": "string",
                    "example": "MWF 08:00 - 09:30 AM",
                    "description": "Class meeting schedule"
                  },
                  "instructorId": {
                    "type": "integer",
                    "description": "Assigned instructor numeric ID (for Department Head creations)"
                  }
                }
              },
              "example": {
                "courseId": 1,
                "semester": "1st Semester",
                "academicYear": "2026-2027",
                "section": "A",
                "courseDescription": "Introduction to hardware and software engineering principles.",
                "learningOutcomes": [
                  "Understand digital systems",
                  "Design logic gates"
                ],
                "saveAsDraft": false,
                "fileUrl": "/uploads/syllabi/cpe101.pdf",
                "fileName": "cpe101_syllabus.pdf",
                "fileType": "PDF",
                "fileSize": 1048576
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Syllabus created or submitted successfully.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "syllabus": {
                      "$ref": "#/components/schemas/Syllabus"
                    },
                    "version": {
                      "$ref": "#/components/schemas/SyllabusVersion"
                    },
                    "message": {
                      "type": "string",
                      "example": "Syllabus submitted for department head review and approval."
                    }
                  }
                },
                "example": {
                  "success": true,
                  "syllabus": {
                    "id": 10,
                    "courseId": 1,
                    "instructorId": 10001,
                    "departmentId": "CPE",
                    "academicYear": "2026-2027",
                    "semester": "1st Semester",
                    "section": "A",
                    "status": "Submitted",
                    "currentVersionNumber": 1
                  },
                  "version": {
                    "id": 25,
                    "syllabusId": 10,
                    "versionNumber": 1,
                    "approvalStatus": "Submitted",
                    "fileUrl": "/uploads/syllabi/cpe101.pdf",
                    "fileType": "PDF",
                    "fileSize": 1048576
                  },
                  "message": "Syllabus submitted for department head review and approval."
                }
              }
            }
          },
          "400": {
            "description": "Missing required course, semester, academic year, or non-PDF file."
          },
          "403": {
            "description": "Unauthorized or creating syllabus outside assigned department."
          }
        }
      }
    },
    "/api/syllabi/{id}": {
      "get": {
        "tags": [
          "6. Syllabus Management"
        ],
        "summary": "Get Syllabus Details & Version History",
        "description": "Retrieve full syllabus record, all sequential versions, review feedback, and document attachments.",
        "operationId": "getSyllabusById",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 10
            },
            "description": "Syllabus ID"
          }
        ],
        "responses": {
          "200": {
            "description": "Syllabus details and full version revision history.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "syllabus": {
                      "$ref": "#/components/schemas/Syllabus"
                    },
                    "currentVersion": {
                      "$ref": "#/components/schemas/SyllabusVersion"
                    },
                    "versions": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/SyllabusVersion"
                      }
                    },
                    "canEdit": {
                      "type": "boolean",
                      "example": true
                    }
                  }
                }
              }
            }
          },
          "403": {
            "description": "Forbidden: Department isolation or student not enrolled in course."
          },
          "404": {
            "description": "Syllabus not found."
          }
        }
      },
      "patch": {
        "tags": [
          "6. Syllabus Management"
        ],
        "summary": "Submit Syllabus Revision (Create New Version)",
        "description": "Authors and Department Heads submit sequential syllabus versions (e.g. Version 2, 3) with change summary.",
        "operationId": "reviseSyllabus",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 10
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "changeSummary"
                ],
                "properties": {
                  "changeSummary": {
                    "type": "string",
                    "example": "Updated course outcomes and added cloud computing topic for AY 2026-2027."
                  },
                  "courseDescription": {
                    "type": "string"
                  },
                  "learningOutcomes": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "saveAsDraft": {
                    "type": "boolean",
                    "example": false
                  },
                  "submitForApproval": {
                    "type": "boolean",
                    "example": true
                  },
                  "fileUrl": {
                    "type": "string",
                    "example": "/uploads/syllabi/CPE101_Rev2.pdf"
                  },
                  "fileType": {
                    "type": "string",
                    "enum": [
                      "PDF"
                    ],
                    "example": "PDF"
                  },
                  "topics": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "references": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "gradingSystem": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "schedule": {
                    "type": "string",
                    "example": "TTh 01:30 - 03:00 PM"
                  },
                  "fileName": {
                    "type": "string",
                    "example": "CPE101_Syllabus_Rev2.pdf"
                  },
                  "fileSize": {
                    "type": "integer",
                    "example": 1048576
                  }
                }
              },
              "example": {
                "changeSummary": "Updated course outcomes and added cloud computing topic for AY 2026-2027.",
                "courseDescription": "Comprehensive overview of modern computer engineering disciplines.",
                "saveAsDraft": false,
                "submitForApproval": true,
                "fileUrl": "/uploads/syllabi/cpe101_v2.pdf",
                "fileType": "PDF"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "New revision created and submitted for review.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "version": {
                      "$ref": "#/components/schemas/SyllabusVersion"
                    },
                    "message": {
                      "type": "string",
                      "example": "Version 2 submitted for Department Head review."
                    }
                  }
                },
                "example": {
                  "success": true,
                  "version": {
                    "id": 26,
                    "syllabusId": 10,
                    "versionNumber": 2,
                    "changeSummary": "Updated course outcomes and added cloud computing topic for AY 2026-2027.",
                    "approvalStatus": "Submitted",
                    "fileUrl": "/uploads/syllabi/cpe101_v2.pdf",
                    "fileType": "PDF"
                  },
                  "message": "Version 2 submitted for Department Head review."
                }
              }
            }
          },
          "400": {
            "description": "Missing change summary or non-PDF file."
          },
          "403": {
            "description": "Forbidden: Only author or assigned Department Head can edit."
          }
        }
      },
      "put": {
        "tags": [
          "6. Syllabus Management"
        ],
        "summary": "Submit Syllabus Revision (PUT Alias)",
        "description": "PUT alias for PATCH /api/syllabi/{id} allowing full revision update or draft save.",
        "operationId": "reviseSyllabusPut",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 10
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "changeSummary"
                ],
                "properties": {
                  "changeSummary": {
                    "type": "string",
                    "example": "Updated course outcomes and added cloud computing topic for AY 2026-2027."
                  },
                  "courseDescription": {
                    "type": "string"
                  },
                  "learningOutcomes": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "saveAsDraft": {
                    "type": "boolean",
                    "example": false
                  },
                  "submitForApproval": {
                    "type": "boolean",
                    "example": true
                  },
                  "fileUrl": {
                    "type": "string",
                    "example": "/uploads/syllabi/CPE101_Rev2.pdf"
                  },
                  "fileType": {
                    "type": "string",
                    "enum": [
                      "PDF"
                    ],
                    "example": "PDF"
                  },
                  "topics": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "references": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "gradingSystem": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  },
                  "schedule": {
                    "type": "string",
                    "example": "TTh 01:30 - 03:00 PM"
                  },
                  "fileName": {
                    "type": "string",
                    "example": "CPE101_Syllabus_Rev2.pdf"
                  },
                  "fileSize": {
                    "type": "integer",
                    "example": 1048576
                  }
                }
              },
              "example": {
                "changeSummary": "Updated course outcomes and added cloud computing topic for AY 2026-2027.",
                "courseDescription": "Comprehensive overview of modern computer engineering disciplines.",
                "saveAsDraft": false,
                "submitForApproval": true,
                "fileUrl": "/uploads/syllabi/cpe101_v2.pdf",
                "fileType": "PDF"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Syllabus updated successfully."
          },
          "400": {
            "description": "Validation failed."
          },
          "403": {
            "description": "Forbidden."
          }
        }
      },
      "delete": {
        "tags": [
          "6. Syllabus Management"
        ],
        "summary": "Delete Syllabus",
        "description": "Delete a syllabus record by ID (Admin or Department Head for assigned department).",
        "operationId": "deleteSyllabus",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 10
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Syllabus deleted successfully.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "message": {
                      "type": "string"
                    }
                  }
                },
                "example": {
                  "success": true,
                  "message": "Syllabus 10 deleted successfully."
                }
              }
            }
          },
          "403": {
            "description": "Forbidden."
          },
          "404": {
            "description": "Syllabus not found."
          }
        }
      }
    },
    "/api/syllabi/upload": {
      "post": {
        "tags": [
          "6. Syllabus Management"
        ],
        "summary": "Upload Syllabus Document (PDF Only, Max 20MB)",
        "description": "Upload a syllabus file attachment. The SRVS system strictly accepts **PDF syllabi only** (`.pdf`). Maximum file size is **20 MB**. DOCX and other document formats are rejected.",
        "operationId": "uploadSyllabusDocument",
        "requestBody": {
          "required": true,
          "content": {
            "multipart/form-data": {
              "schema": {
                "type": "object",
                "required": [
                  "file"
                ],
                "properties": {
                  "file": {
                    "type": "string",
                    "format": "binary",
                    "description": "PDF syllabus document (max 20MB)"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "PDF document uploaded successfully.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "fileName": {
                      "type": "string",
                      "example": "cpe101_syllabus.pdf"
                    },
                    "fileUrl": {
                      "type": "string",
                      "example": "/uploads/syllabi/cpe101_syllabus_171000000.pdf"
                    },
                    "fileType": {
                      "type": "string",
                      "example": "PDF"
                    },
                    "fileSize": {
                      "type": "integer",
                      "example": 1048576
                    }
                  }
                },
                "example": {
                  "success": true,
                  "fileName": "cpe101_syllabus.pdf",
                  "fileUrl": "/uploads/syllabi/cpe101_syllabus_171000000.pdf",
                  "fileType": "PDF",
                  "fileSize": 1048576
                }
              }
            }
          },
          "400": {
            "description": "Invalid format (non-PDF) or file size exceeds 20MB limit."
          },
          "403": {
            "description": "Unauthorized: Only Educators and Department Heads may upload documents."
          }
        }
      }
    },
    "/api/syllabi/{id}/versions": {
      "get": {
        "tags": [
          "6. Syllabus Management"
        ],
        "summary": "Get All Revision Versions for Syllabus",
        "description": "Retrieve full chronological version history, snapshots, and diff content for a syllabus by ID.",
        "operationId": "getSyllabusVersions",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 10
            },
            "description": "Syllabus ID"
          }
        ],
        "responses": {
          "200": {
            "description": "Version history retrieved successfully.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "syllabus": {
                      "$ref": "#/components/schemas/Syllabus"
                    },
                    "versions": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/SyllabusVersion"
                      }
                    }
                  }
                },
                "example": {
                  "syllabus": {
                    "id": 10,
                    "courseId": 1,
                    "departmentId": "CPE",
                    "status": "Submitted",
                    "currentVersionNumber": 1
                  },
                  "versions": [
                    {
                      "id": 25,
                      "versionNumber": 1,
                      "syllabusId": 10,
                      "changeSummary": "Initial syllabus drafting (Version 1)",
                      "approvalStatus": "Submitted",
                      "fileUrl": "/uploads/syllabi/cpe101.pdf",
                      "fileType": "PDF"
                    }
                  ]
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized."
          },
          "403": {
            "description": "Forbidden outside assigned department or student access."
          },
          "404": {
            "description": "Syllabus not found."
          }
        }
      }
    },
    "/api/syllabi/{id}/submit": {
      "post": {
        "tags": [
          "6. Syllabus Management"
        ],
        "summary": "Submit Syllabus for Department Head Review",
        "description": "Transitions a syllabus from `Draft` to `Submitted` status, notifying the Department Head for review.",
        "operationId": "submitSyllabusForReview",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 10
            },
            "description": "Syllabus ID to submit"
          }
        ],
        "requestBody": {
          "required": false,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "notes": {
                    "type": "string",
                    "example": "Ready for Department Head review.",
                    "description": "Optional submission remarks"
                  }
                }
              },
              "example": {
                "notes": "Ready for Department Head review."
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Syllabus submitted for review successfully.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "message": {
                      "type": "string"
                    },
                    "syllabus": {
                      "$ref": "#/components/schemas/Syllabus"
                    }
                  }
                },
                "example": {
                  "success": true,
                  "message": "Syllabus submitted for review.",
                  "syllabus": {
                    "id": 10,
                    "status": "Submitted",
                    "submittedAt": "2026-09-29T10:00:00.000Z"
                  }
                }
              }
            }
          },
          "403": {
            "description": "Unauthorized: Only author or Department Head may submit."
          },
          "404": {
            "description": "Syllabus not found."
          }
        }
      }
    },
    "/api/syllabi/{id}/restore": {
      "post": {
        "tags": [
          "6. Syllabus Management"
        ],
        "summary": "Restore Historical Syllabus Version",
        "description": "Restores a previous historical version, creating a new Draft version snapshot.",
        "operationId": "restoreSyllabusVersion",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 10
            },
            "description": "Syllabus ID"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "versionNumber"
                ],
                "properties": {
                  "versionNumber": {
                    "type": "integer",
                    "example": 1,
                    "description": "Target version number to restore"
                  }
                }
              },
              "example": {
                "versionNumber": 1
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Historical version restored successfully as a new draft.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "message": {
                      "type": "string"
                    },
                    "syllabus": {
                      "$ref": "#/components/schemas/Syllabus"
                    },
                    "version": {
                      "$ref": "#/components/schemas/SyllabusVersion"
                    }
                  }
                },
                "example": {
                  "success": true,
                  "message": "Version 1 restored as new Version 2.",
                  "syllabus": {
                    "id": 10,
                    "currentVersionNumber": 2
                  },
                  "version": {
                    "id": 26,
                    "versionNumber": 2,
                    "changeType": "Restore",
                    "approvalStatus": "DRAFT"
                  }
                }
              }
            }
          },
          "400": {
            "description": "Missing target versionNumber."
          },
          "403": {
            "description": "Unauthorized: Only author or Department Head may restore."
          },
          "404": {
            "description": "Syllabus or target version not found."
          }
        }
      }
    },
    "/api/syllabus-approvals": {
      "get": {
        "tags": [
          "7. Syllabus Review & Approval"
        ],
        "summary": "List Pending Syllabus Approvals (Department Head / Admin)",
        "description": "Retrieve pending submissions awaiting review. Department Heads strictly view submissions belonging to their assigned department (Department Isolation).",
        "operationId": "getSyllabusApprovals",
        "parameters": [
          {
            "name": "status",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "SUBMITTED",
                "UNDER_REVIEW",
                "APPROVED",
                "REJECTED",
                "ALL"
              ],
              "default": "SUBMITTED"
            }
          },
          {
            "name": "departmentId",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "CPE",
                "EE",
                "CE",
                "ECE",
                "IE",
                "ME"
              ]
            }
          },
          {
            "name": "courseId",
            "in": "query",
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "courseCode",
            "in": "query",
            "schema": {
              "type": "string",
              "example": "CPE101"
            }
          },
          {
            "name": "instructorId",
            "in": "query",
            "schema": {
              "type": "integer"
            },
            "description": "Filter approval requests by instructor ID number"
          },
          {
            "name": "idNumber",
            "in": "query",
            "schema": {
              "type": "integer"
            },
            "description": "Filter approval requests by instructor ID number (alias of instructorId)"
          },
          {
            "name": "syllabusId",
            "in": "query",
            "schema": {
              "type": "integer"
            },
            "description": "Filter approval requests by parent syllabus record ID"
          }
        ],
        "responses": {
          "200": {
            "description": "List of syllabus approval requests and status tallies.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "department": {
                      "type": "object"
                    },
                    "approvals": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/SyllabusVersion"
                      }
                    },
                    "stats": {
                      "type": "object",
                      "properties": {
                        "pending": {
                          "type": "integer"
                        },
                        "approved": {
                          "type": "integer"
                        },
                        "rejected": {
                          "type": "integer"
                        },
                        "total": {
                          "type": "integer"
                        }
                      }
                    }
                  }
                },
                "example": {
                  "department": {
                    "id": "CPE",
                    "code": "CPE",
                    "name": "Computer Engineering Department"
                  },
                  "approvals": [
                    {
                      "id": 25,
                      "versionNumber": 1,
                      "syllabusId": 10,
                      "changeSummary": "Initial syllabus drafting (Version 1)",
                      "approvalStatus": "Submitted",
                      "fileUrl": "/uploads/syllabi/cpe101.pdf",
                      "fileType": "PDF",
                      "syllabus": {
                        "id": 10,
                        "course": {
                          "id": 1,
                          "code": "CPE101",
                          "title": "Computer Engineering as a Discipline",
                          "departmentId": "CPE"
                        },
                        "instructor": {
                          "id": 10001,
                          "idNumber": 10001,
                          "fullName": "Engr. Alan Turing",
                          "email": "faculty@usjr.edu.ph"
                        }
                      }
                    }
                  ],
                  "stats": {
                    "pending": 1,
                    "approved": 4,
                    "rejected": 0,
                    "total": 5
                  }
                }
              }
            }
          },
          "403": {
            "description": "Unauthorized: Requires Department Head or Admin role."
          }
        }
      },
      "post": {
        "tags": [
          "7. Syllabus Review & Approval"
        ],
        "summary": "Approve or Reject Syllabus Version (Department Head)",
        "description": "Department Heads approve or reject submissions. Reviewer identity (`reviewedById`) is strictly recorded from the authenticated session. Department Heads can only review their department.",
        "operationId": "reviewSyllabus",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "versionId",
                  "action"
                ],
                "properties": {
                  "versionId": {
                    "type": "integer",
                    "example": 1,
                    "description": "ID of SyllabusVersion record"
                  },
                  "action": {
                    "type": "string",
                    "enum": [
                      "Approve",
                      "Reject",
                      "Under_Review"
                    ],
                    "example": "Approve"
                  },
                  "patch": {
                    "tags": [
                      "7. Syllabus Review & Approval"
                    ],
                    "summary": "Review Syllabus Version (PATCH Alias)",
                    "description": "PATCH alias for POST /api/syllabus-approvals allowing Department Head to approve, reject, or place under review.",
                    "operationId": "reviewSyllabusPatch",
                    "requestBody": {
                      "required": true,
                      "content": {
                        "application/json": {
                          "schema": {
                            "type": "object",
                            "required": [
                              "versionId",
                              "action"
                            ],
                            "properties": {
                              "versionId": {
                                "type": "integer",
                                "example": 25
                              },
                              "action": {
                                "type": "string",
                                "enum": [
                                  "Approve",
                                  "Reject",
                                  "Under_Review"
                                ],
                                "example": "Approve"
                              },
                              "remarks": {
                                "type": "string",
                                "example": "Approved for 1st Semester AY 2026-2027."
                              }
                            }
                          }
                        }
                      }
                    },
                    "responses": {
                      "200": {
                        "description": "Review action processed successfully."
                      },
                      "400": {
                        "description": "Missing versionId or invalid action."
                      },
                      "403": {
                        "description": "Unauthorized."
                      },
                      "404": {
                        "description": "Version not found."
                      }
                    }
                  },
                  "remarks": {
                    "type": "string",
                    "example": "Approved by Department Head"
                  }
                }
              },
              "example": {
                "versionId": 25,
                "action": "Approve",
                "remarks": "Approved for 1st Semester AY 2026-2027."
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Review action processed successfully.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "message": {
                      "type": "string",
                      "example": "Syllabus v1 approved successfully."
                    },
                    "status": {
                      "type": "string",
                      "example": "APPROVED"
                    }
                  }
                },
                "example": {
                  "success": true,
                  "message": "Syllabus v1 approved successfully.",
                  "status": "APPROVED"
                }
              }
            }
          },
          "400": {
            "description": "Missing versionId or invalid review action."
          },
          "403": {
            "description": "Unauthorized: Only Department Heads in assigned department may review."
          },
          "404": {
            "description": "Syllabus version not found."
          }
        }
      },
      "patch": {
        "tags": [
          "7. Syllabus Review & Approval"
        ],
        "summary": "Submit Review Action on Syllabus Version (PATCH Alias)",
        "description": "Performs review action (Approve, Reject, or Under_Review) on a submitted syllabus version. Reviewer identity derived from authenticated session.",
        "security": [
          {
            "bearerAuth": []
          },
          {
            "cookieAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "versionId",
                  "action"
                ],
                "properties": {
                  "versionId": {
                    "type": "integer",
                    "example": 1,
                    "description": "ID of SyllabusVersion record being reviewed"
                  },
                  "action": {
                    "type": "string",
                    "enum": [
                      "Approve",
                      "Reject",
                      "Under_Review"
                    ],
                    "example": "Approve"
                  },
                  "remarks": {
                    "type": "string",
                    "example": "Approved for implementation in 1st Semester AY 2024-2025."
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Review decision recorded successfully.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "message": {
                      "type": "string",
                      "example": "Syllabus v1 approved successfully."
                    },
                    "status": {
                      "type": "string",
                      "example": "APPROVED"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Invalid versionId or action."
          },
          "403": {
            "description": "Forbidden — cross-department review prohibited."
          },
          "404": {
            "description": "Syllabus version not found."
          },
          "500": {
            "description": "Internal server error."
          }
        }
      }
    },
    "/api/syllabus-approvals/{id}": {
      "get": {
        "tags": [
          "7. Syllabus Review & Approval"
        ],
        "summary": "Get Approval Request Details with Version Comparison",
        "description": "Retrieve detailed approval request including course metadata, submitted outcomes, and previous approved version for diff comparison.",
        "operationId": "getApprovalDetail",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 25
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Detailed approval data and prior approved version for comparison.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "approval": {
                      "$ref": "#/components/schemas/SyllabusVersion"
                    },
                    "/api/syllabus-approvals/{id}/approve": {
                      "post": {
                        "tags": [
                          "7. Syllabus Review & Approval"
                        ],
                        "summary": "Approve Syllabus Version by ID",
                        "description": "Department Head direct approval endpoint for a specific syllabus version ID.",
                        "operationId": "approveSyllabusById",
                        "parameters": [
                          {
                            "name": "id",
                            "in": "path",
                            "required": true,
                            "schema": {
                              "type": "integer",
                              "example": 25
                            },
                            "description": "SyllabusVersion ID or Syllabus ID"
                          }
                        ],
                        "requestBody": {
                          "required": false,
                          "content": {
                            "application/json": {
                              "schema": {
                                "type": "object",
                                "properties": {
                                  "comments": {
                                    "type": "string",
                                    "example": "Approved syllabus conforms to curriculum outcomes."
                                  }
                                }
                              }
                            }
                          }
                        },
                        "responses": {
                          "200": {
                            "description": "Syllabus version approved successfully."
                          },
                          "400": {
                            "description": "Version not in pending status."
                          },
                          "403": {
                            "description": "Forbidden outside assigned department."
                          },
                          "404": {
                            "description": "Syllabus version not found."
                          }
                        }
                      }
                    },
                    "/api/syllabus-approvals/{id}/reject": {
                      "post": {
                        "tags": [
                          "7. Syllabus Review & Approval"
                        ],
                        "summary": "Reject Syllabus Version by ID",
                        "description": "Department Head direct rejection endpoint with required rejection feedback reason.",
                        "operationId": "rejectSyllabusById",
                        "parameters": [
                          {
                            "name": "id",
                            "in": "path",
                            "required": true,
                            "schema": {
                              "type": "integer",
                              "example": 25
                            },
                            "description": "SyllabusVersion ID or Syllabus ID"
                          }
                        ],
                        "requestBody": {
                          "required": true,
                          "content": {
                            "application/json": {
                              "schema": {
                                "type": "object",
                                "required": [
                                  "rejectionReason"
                                ],
                                "properties": {
                                  "rejectionReason": {
                                    "type": "string",
                                    "example": "Please update laboratory experiments 4 and 5 to reflect new FPGA board hardware."
                                  }
                                }
                              }
                            }
                          }
                        },
                        "responses": {
                          "200": {
                            "description": "Syllabus version rejected with feedback."
                          },
                          "400": {
                            "description": "Missing rejection reason."
                          },
                          "403": {
                            "description": "Forbidden outside assigned department."
                          },
                          "404": {
                            "description": "Syllabus version not found."
                          }
                        }
                      }
                    },
                    "previousApprovedVersion": {
                      "type": "object"
                    },
                    "isSelfSubmission": {
                      "type": "boolean",
                      "example": false
                    }
                  }
                }
              }
            }
          },
          "403": {
            "description": "Forbidden outside assigned department."
          },
          "404": {
            "description": "Approval request not found."
          }
        }
      }
    },
    "/api/syllabi/{id}/review": {
      "post": {
        "tags": [
          "7. Syllabus Review & Approval"
        ],
        "summary": "Review & Approve or Reject Syllabus (Department Head / Admin)",
        "description": "Department Head decision on syllabus. Action must be `Approve` or `Reject`. Reviewer identity is securely verified from authenticated session cookie.",
        "operationId": "reviewSyllabusById",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer",
              "example": 10
            },
            "description": "Syllabus ID to review"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "action"
                ],
                "properties": {
                  "action": {
                    "type": "string",
                    "enum": [
                      "Approve",
                      "Reject"
                    ],
                    "example": "Approve",
                    "description": "Review decision"
                  },
                  "remarks": {
                    "type": "string",
                    "example": "Meets academic syllabus standards and learning outcomes.",
                    "description": "Feedback or remarks"
                  }
                }
              },
              "example": {
                "action": "Approve",
                "remarks": "Meets academic syllabus standards and learning outcomes."
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Syllabus review decision applied successfully.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "message": {
                      "type": "string"
                    },
                    "syllabus": {
                      "$ref": "#/components/schemas/Syllabus"
                    }
                  }
                },
                "example": {
                  "success": true,
                  "message": "Syllabus successfully approved.",
                  "syllabus": {
                    "id": 10,
                    "status": "Approved",
                    "reviewerRemarks": "Meets academic syllabus standards and learning outcomes.",
                    "reviewedAt": "2026-09-29T11:00:00.000Z",
                    "reviewedByUserId": 10001
                  }
                }
              }
            }
          },
          "400": {
            "description": "Invalid review action. Must be Approve or Reject."
          },
          "403": {
            "description": "Forbidden: Requires Department Head of assigned department or Admin."
          },
          "404": {
            "description": "Syllabus not found."
          }
        }
      }
    },
    "/api/audit-logs": {
      "get": {
        "tags": [
          "8. Audit Logs"
        ],
        "summary": "Inspect System Security & Activity Audit Trail (Admin Only)",
        "description": "System Administrators can inspect immutable event logs tracking authentication, registrations, course alterations, syllabus submissions, and approvals.",
        "operationId": "getAuditLogs",
        "parameters": [
          {
            "name": "limit",
            "in": "query",
            "schema": {
              "type": "integer",
              "example": 50
            },
            "description": "Number of logs to return (max 500)"
          },
          {
            "name": "actionType",
            "in": "query",
            "schema": {
              "type": "string",
              "example": "Login"
            }
          },
          {
            "name": "idNumber",
            "in": "query",
            "schema": {
              "type": "integer",
              "example": 2022012708
            },
            "description": "Filter by user ID number"
          },
          {
            "name": "search",
            "in": "query",
            "schema": {
              "type": "string"
            },
            "description": "Keyword search across descriptions and entity IDs"
          },
          {
            "name": "userId",
            "in": "query",
            "schema": {
              "type": "integer"
            },
            "description": "Filter logs by acting or target user numeric ID (alias of idNumber)"
          }
        ],
        "responses": {
          "200": {
            "description": "Chronological list of audit records.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "logs": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/AuditLog"
                      }
                    }
                  }
                },
                "example": {
                  "logs": [
                    {
                      "id": 1,
                      "userId": 2022012708,
                      "userDisplayName": "Gian Carlo",
                      "actionType": "Login",
                      "resultStatus": "Success",
                      "description": "User successfully logged in as [Student]",
                      "entityType": "User",
                      "entityId": "2022012708",
                      "ipAddress": "127.0.0.1",
                      "createdAt": "2026-09-29T10:00:00.000Z"
                    }
                  ]
                }
              }
            }
          },
          "403": {
            "description": "Unauthorized: Requires Administrator role."
          }
        }
      }
    },
    "/api/dashboard/stats": {
      "get": {
        "tags": [
          "9. Dashboard / System Health"
        ],
        "summary": "Get Role-Scoped Dashboard Analytics",
        "description": "Returns real-time analytics tailored to the authenticated user role: institutional metrics for Admin, departmental overview for Department Head, course & syllabus stats for Educator, enrolled courses for Student.",
        "operationId": "getDashboardStats",
        "responses": {
          "200": {
            "description": "Analytics object customized for user role.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "role": {
                      "type": "string",
                      "example": "DepartmentHead"
                    },
                    "stats": {
                      "type": "object"
                    }
                  }
                },
                "example": {
                  "role": "DepartmentHead",
                  "department": {
                    "id": "CPE",
                    "code": "CPE",
                    "name": "Computer Engineering Department"
                  },
                  "stats": {
                    "totalCourses": 13,
                    "totalSyllabi": 10,
                    "draftSyllabi": 2,
                    "submittedSyllabi": 1,
                    "approvedSyllabi": 7,
                    "rejectedSyllabi": 0,
                    "educatorsCount": 5,
                    "studentsCount": 22,
                    "pendingRegistrations": 1,
                    "pendingApprovals": 1,
                    "missingSyllabi": 6
                  }
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized."
          }
        }
      }
    },
    "/api/system/db-status": {
      "get": {
        "tags": [
          "9. Dashboard / System Health"
        ],
        "summary": "Live Database Health & Latency Diagnostics",
        "description": "Live PostgreSQL connection check, query latency test, and table row counts across all core entities.",
        "operationId": "getDbStatus",
        "responses": {
          "200": {
            "description": "Database connection health and table statistics.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "status": {
                      "type": "string",
                      "example": "healthy"
                    },
                    "database": {
                      "type": "string",
                      "example": "PostgreSQL (Supabase Pooler)"
                    },
                    "latencyMs": {
                      "type": "string",
                      "example": "32ms"
                    },
                    "timestamp": {
                      "type": "string",
                      "format": "date-time"
                    },
                    "tables": {
                      "type": "object"
                    }
                  }
                },
                "example": {
                  "status": "healthy",
                  "database": "PostgreSQL (Supabase Pooler)",
                  "latencyMs": "32ms",
                  "timestamp": "2026-09-29T10:00:00.000Z",
                  "tables": {
                    "departments": 6,
                    "users": 31,
                    "subjects": 14,
                    "enrollments": 18,
                    "syllabi": 14,
                    "syllabus_versions": 24,
                    "audit_logs": 25
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/announcements": {
      "get": {
        "tags": [
          "9. Notifications & Announcements"
        ],
        "summary": "Retrieve Department Announcements",
        "description": "Fetch announcements surfaced via the notifications channel for the authenticated user.",
        "security": [
          {
            "bearerAuth": []
          },
          {
            "cookieAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Announcements retrieved successfully.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "announcements": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "id": {
                            "type": "string"
                          },
                          "title": {
                            "type": "string"
                          },
                          "message": {
                            "type": "string"
                          },
                          "createdAt": {
                            "type": "string",
                            "format": "date-time"
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized — active session required."
          },
          "500": {
            "description": "Internal server error."
          }
        }
      },
      "post": {
        "tags": [
          "9. Notifications & Announcements"
        ],
        "summary": "Create and Broadcast Announcement (Admin / Department Head)",
        "description": "Broadcasts an announcement notification to all active educators and students in the specified department.",
        "security": [
          {
            "bearerAuth": []
          },
          {
            "cookieAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "title",
                  "message"
                ],
                "properties": {
                  "title": {
                    "type": "string",
                    "example": "Midterm Syllabus Submission Deadline"
                  },
                  "message": {
                    "type": "string",
                    "example": "All faculty members must submit course syllabus revisions by Friday."
                  },
                  "departmentId": {
                    "type": "string",
                    "enum": [
                      "CPE",
                      "EE",
                      "CE",
                      "ECE",
                      "IE",
                      "ME"
                    ],
                    "example": "CPE",
                    "description": "Target department ID (defaults to Department Head assigned department)."
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Announcement broadcast successfully.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "message": {
                      "type": "string",
                      "example": "Announcement broadcast to 18 department members."
                    },
                    "recipientsCount": {
                      "type": "integer",
                      "example": 18
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Validation error: title, message, or departmentId missing."
          },
          "403": {
            "description": "Forbidden — requires Admin or Department Head credentials."
          },
          "500": {
            "description": "Internal server error."
          }
        }
      }
    },
    "/api/notifications": {
      "get": {
        "tags": [
          "9. Notifications & Announcements"
        ],
        "summary": "Retrieve User Notifications",
        "description": "Fetch system alerts, syllabus submission/approval notifications, and department announcements for authenticated user.",
        "security": [
          {
            "bearerAuth": []
          },
          {
            "cookieAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Notifications retrieved successfully.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "notifications": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "id": {
                            "type": "string"
                          },
                          "title": {
                            "type": "string"
                          },
                          "message": {
                            "type": "string"
                          },
                          "link": {
                            "type": "string"
                          },
                          "read": {
                            "type": "boolean"
                          },
                          "createdAt": {
                            "type": "string",
                            "format": "date-time"
                          }
                        }
                      }
                    },
                    "unreadCount": {
                      "type": "integer",
                      "example": 0
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized."
          },
          "500": {
            "description": "Internal server error."
          }
        }
      },
      "patch": {
        "tags": [
          "9. Notifications & Announcements"
        ],
        "summary": "Mark Notifications as Read",
        "description": "Marks all unread notifications for the current authenticated user as read.",
        "security": [
          {
            "bearerAuth": []
          },
          {
            "cookieAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Notifications marked as read.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "message": {
                      "type": "string",
                      "example": "Notifications marked as read."
                    }
                  }
                }
              }
            }
          },
          "401": {
            "description": "Unauthorized."
          },
          "500": {
            "description": "Internal server error."
          }
        }
      }
    },
    "/api/openapi.json": {
      "get": {
        "tags": [
          "8. System & Utilities"
        ],
        "summary": "Retrieve OpenAPI 3.0.3 Specification Document",
        "description": "Returns the full machine-readable OpenAPI 3.0.3 JSON specification detailing all SRVS API routes, schemas, and parameters.",
        "responses": {
          "200": {
            "description": "OpenAPI specification document.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "openapi": {
                      "type": "string",
                      "example": "3.0.3"
                    },
                    "info": {
                      "type": "object"
                    },
                    "paths": {
                      "type": "object"
                    },
                    "components": {
                      "type": "object"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/subjects": {
      "get": {
        "tags": [
          "4. Academic Subjects (Curriculum)"
        ],
        "summary": "List Academic Subjects Curriculum Catalog",
        "description": "Retrieve academic subjects catalog (e.g. Programming, Networking, Mathematics). Non-admin users are strictly scoped to subjects within their assigned department (Department Isolation). Students also receive isEnrolled status flags for each subject.",
        "operationId": "getSubjects",
        "parameters": [
          {
            "name": "subjectId",
            "in": "query",
            "schema": {
              "type": "integer",
              "example": 1
            },
            "description": "Subject ID filter"
          },
          {
            "name": "code",
            "in": "query",
            "schema": {
              "type": "string",
              "example": "CPE101"
            },
            "description": "Subject code filter"
          },
          {
            "name": "search",
            "in": "query",
            "schema": {
              "type": "string",
              "example": "Programming"
            },
            "description": "Search query for subject code or title"
          },
          {
            "name": "departmentId",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "CPE",
                "EE",
                "CE",
                "ECE",
                "IE",
                "ME"
              ]
            },
            "description": "Department code filter"
          },
          {
            "name": "yearLevel",
            "in": "query",
            "schema": {
              "type": "string",
              "example": "1st Year"
            },
            "description": "Academic year level filter"
          },
          {
            "name": "semester",
            "in": "query",
            "schema": {
              "type": "string",
              "example": "1st Semester"
            },
            "description": "Semester filter"
          },
          {
            "name": "courseId",
            "in": "query",
            "schema": {
              "type": "integer"
            },
            "description": "Backwards-compatibility alias for subjectId"
          },
          {
            "name": "courseCode",
            "in": "query",
            "schema": {
              "type": "string"
            },
            "description": "Backwards-compatibility alias for code"
          }
        ],
        "responses": {
          "200": {
            "description": "List of curriculum academic subjects.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "subjects": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/Subject"
                      }
                    },
                    "courses": {
                      "type": "array",
                      "items": {
                        "$ref": "#/components/schemas/Subject"
                      }
                    },
                    "total": {
                      "type": "integer",
                      "example": 14
                    }
                  }
                }
              }
            }
          }
        }
      },
      "post": {
        "tags": [
          "4. Academic Subjects (Curriculum)"
        ],
        "summary": "Create Academic Subject",
        "description": "Create a new academic subject in the curriculum catalog. Department Heads may only create subjects within their assigned department; Administrators can create subjects for any department.",
        "operationId": "createSubject",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "code",
                  "title",
                  "departmentId"
                ],
                "properties": {
                  "code": {
                    "type": "string",
                    "example": "CPE201",
                    "description": "Unique subject code"
                  },
                  "title": {
                    "type": "string",
                    "example": "Data Structures and Algorithms",
                    "description": "Subject title"
                  },
                  "description": {
                    "type": "string",
                    "example": "Fundamental data structures and algorithmic complexity."
                  },
                  "units": {
                    "type": "integer",
                    "default": 3,
                    "example": 3
                  },
                  "lecHours": {
                    "type": "integer",
                    "default": 3,
                    "example": 3
                  },
                  "labHours": {
                    "type": "integer",
                    "default": 0,
                    "example": 0
                  },
                  "prerequisite": {
                    "type": "string",
                    "example": "CPE101"
                  },
                  "yearLevel": {
                    "type": "string",
                    "example": "2nd Year"
                  },
                  "semester": {
                    "type": "string",
                    "example": "1st Semester"
                  },
                  "departmentId": {
                    "type": "string",
                    "enum": [
                      "CPE",
                      "EE",
                      "CE",
                      "ECE",
                      "IE",
                      "ME"
                    ],
                    "example": "CPE"
                  },
                  "professorName": {
                    "type": "string",
                    "example": "Engr. Ada Lovelace"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Academic subject created successfully.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "message": {
                      "type": "string",
                      "example": "Subject created successfully."
                    },
                    "subject": {
                      "$ref": "#/components/schemas/Subject"
                    },
                    "course": {
                      "$ref": "#/components/schemas/Subject"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Missing required fields or invalid input."
          },
          "403": {
            "description": "Forbidden: Department Head restricted to their department."
          },
          "409": {
            "description": "Subject code already exists."
          }
        }
      }
    },
    "/api/syllabi/{id}/versions/{version}/submit": {
      "post": {
        "tags": [
          "6. Syllabus Management"
        ],
        "summary": "Submit Specific Syllabus Version for Department Review",
        "description": "Transitions a specific draft version of a syllabus into SUBMITTED status and notifies the Department Head.",
        "security": [
          {
            "bearerAuth": []
          },
          {
            "cookieAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer"
            },
            "description": "Syllabus primary key record ID"
          },
          {
            "name": "version",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer"
            },
            "description": "Version number to submit for review (e.g. 1)"
          }
        ],
        "requestBody": {
          "required": false,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "remarks": {
                    "type": "string",
                    "example": "Revised learning outcomes aligned with PACUCOA recommendations."
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Version submitted successfully.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "message": {
                      "type": "string",
                      "example": "Syllabus version submitted for department review."
                    },
                    "syllabus": {
                      "$ref": "#/components/schemas/Syllabus"
                    },
                    "version": {
                      "$ref": "#/components/schemas/SyllabusVersion"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Version already approved or pending review."
          },
          "403": {
            "description": "Forbidden — only the educator author or assigned department head may submit."
          },
          "404": {
            "description": "Syllabus or version not found."
          },
          "500": {
            "description": "Internal server error."
          }
        }
      }
    },
    "/api/syllabus-approvals/{id}/approve": {
      "post": {
        "tags": [
          "7. Syllabus Review & Approval"
        ],
        "summary": "Direct Approve Syllabus Version (Department Head / Admin)",
        "description": "Approves the specified syllabus version, archives prior active versions for this course, marks the syllabus as APPROVED, and notifies the educator.",
        "security": [
          {
            "bearerAuth": []
          },
          {
            "cookieAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer"
            },
            "description": "SyllabusVersion ID or Syllabus ID to approve"
          }
        ],
        "requestBody": {
          "required": false,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "comments": {
                    "type": "string",
                    "example": "Approved. Meets all department curriculum objectives."
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Syllabus version approved successfully.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "message": {
                      "type": "string"
                    },
                    "version": {
                      "$ref": "#/components/schemas/SyllabusVersion"
                    },
                    "syllabus": {
                      "$ref": "#/components/schemas/Syllabus"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Invalid version status or ID."
          },
          "403": {
            "description": "Forbidden — cross-department approval strictly disallowed."
          },
          "404": {
            "description": "Version or syllabus not found."
          },
          "500": {
            "description": "Internal server error."
          }
        }
      }
    },
    "/api/syllabus-approvals/{id}/reject": {
      "post": {
        "tags": [
          "7. Syllabus Review & Approval"
        ],
        "summary": "Direct Reject Syllabus Version with Actionable Feedback",
        "description": "Returns the specified syllabus version to the educator author with required revision remarks and feedback (Requirement 11).",
        "security": [
          {
            "bearerAuth": []
          },
          {
            "cookieAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "integer"
            },
            "description": "SyllabusVersion ID or Syllabus ID to reject"
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "rejectionReason"
                ],
                "properties": {
                  "rejectionReason": {
                    "type": "string",
                    "example": "Please update grading rubric for lab components and include textbook 2024 edition."
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Syllabus returned with revision feedback.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true
                    },
                    "message": {
                      "type": "string"
                    },
                    "version": {
                      "$ref": "#/components/schemas/SyllabusVersion"
                    },
                    "syllabus": {
                      "$ref": "#/components/schemas/Syllabus"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "Rejection reason is required."
          },
          "403": {
            "description": "Forbidden — cross-department rejection strictly disallowed."
          },
          "404": {
            "description": "Version not found."
          },
          "500": {
            "description": "Internal server error."
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "CookieAuth": {
        "type": "apiKey",
        "in": "cookie",
        "name": "srvs_token",
        "description": "Secure, HTTP-only JWT session cookie set on login."
      }
    },
    "schemas": {
      "ErrorResponse": {
        "type": "object",
        "properties": {
          "error": {
            "type": "string",
            "example": "Invalid ID number or password."
          }
        }
      },
      "AuthSuccessResponse": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean",
            "example": true
          },
          "user": {
            "$ref": "#/components/schemas/UserProfile"
          }
        }
      },
      "RegisterSuccessResponse": {
        "type": "object",
        "properties": {
          "message": {
            "type": "string",
            "example": "Account registered successfully!"
          },
          "user": {
            "$ref": "#/components/schemas/UserProfile"
          }
        }
      },
      "UserProfile": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "example": 2022012708,
            "description": "Institutional ID number"
          },
          "idNumber": {
            "type": "integer",
            "example": 2022012708,
            "description": "Institutional ID number"
          },
          "email": {
            "type": "string",
            "format": "email",
            "example": "gian@usjr.edu.ph"
          },
          "fullName": {
            "type": "string",
            "example": "Gian Carlo"
          },
          "role": {
            "type": "string",
            "enum": [
              "Admin",
              "DepartmentHead",
              "Educator",
              "Student"
            ],
            "example": "Student"
          },
          "departmentId": {
            "type": "string",
            "enum": [
              "CPE",
              "EE",
              "CE",
              "ECE",
              "IE",
              "ME"
            ],
            "example": "CPE"
          },
          "departmentName": {
            "type": "string",
            "example": "Computer Engineering Department"
          },
          "accountStatus": {
            "type": "string",
            "enum": [
              "Active",
              "PendingApproval",
              "Rejected",
              "Deactivated"
            ],
            "example": "Active"
          },
          "academicRank": {
            "type": "string",
            "nullable": true,
            "example": null
          },
          "yearLevel": {
            "type": "string",
            "nullable": true,
            "example": "1st Year"
          },
          "enrolledSubjects": {
            "type": "string",
            "example": "CPE101"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "UsersListResponse": {
        "type": "object",
        "properties": {
          "users": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/UserProfile"
            }
          },
          "total": {
            "type": "integer",
            "example": 1
          },
          "counts": {
            "type": "object",
            "properties": {
              "total": {
                "type": "integer"
              },
              "deptHeads": {
                "type": "integer"
              },
              "educators": {
                "type": "integer"
              },
              "students": {
                "type": "integer"
              },
              "admins": {
                "type": "integer"
              }
            }
          }
        }
      },
      "Department": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "example": "CPE"
          },
          "code": {
            "type": "string",
            "example": "CPE"
          },
          "name": {
            "type": "string",
            "example": "Computer Engineering Department"
          },
          "description": {
            "type": "string",
            "example": "College of Engineering"
          },
          "_count": {
            "type": "object",
            "properties": {
              "courses": {
                "type": "integer",
                "example": 13
              },
              "educators": {
                "type": "integer",
                "example": 2
              },
              "students": {
                "type": "integer",
                "example": 2
              },
              "syllabi": {
                "type": "integer",
                "example": 3
              }
            }
          }
        }
      },
      "Course": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "example": 1,
            "description": "Internal database course ID"
          },
          "code": {
            "type": "string",
            "example": "CPE101",
            "description": "Institutional course code"
          },
          "title": {
            "type": "string",
            "example": "Computer Engineering as a Discipline"
          },
          "description": {
            "type": "string",
            "nullable": true,
            "example": "Foundational concepts in computer engineering."
          },
          "units": {
            "type": "integer",
            "example": 3
          },
          "lecHours": {
            "type": "integer",
            "example": 3
          },
          "labHours": {
            "type": "integer",
            "example": 0
          },
          "prerequisite": {
            "type": "string",
            "example": "None"
          },
          "yearLevel": {
            "type": "string",
            "example": "1st Year"
          },
          "semester": {
            "type": "string",
            "example": "1st Semester"
          },
          "departmentId": {
            "type": "string",
            "enum": [
              "CPE",
              "EE",
              "CE",
              "ECE",
              "IE",
              "ME"
            ],
            "example": "CPE"
          },
          "professorName": {
            "type": "string",
            "nullable": true,
            "example": "Engr. Alan Turing",
            "description": "Professor responsible for syllabus"
          },
          "department": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "example": "CPE"
              },
              "code": {
                "type": "string",
                "example": "CPE"
              },
              "name": {
                "type": "string",
                "example": "Computer Engineering Department"
              }
            }
          },
          "isEnrolled": {
            "type": "boolean",
            "example": true
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "Enrollment": {
        "type": "object",
        "description": "A student_subjects row (UNIQUE studentId + subjectId) returned with the joined student and subject.",
        "properties": {
          "id": {
            "type": "integer",
            "example": 21,
            "description": "student_subjects.id"
          },
          "studentId": {
            "type": "integer",
            "example": 2022012708,
            "description": "FK → users.id (fk_student_subjects_student)"
          },
          "studentName": {
            "type": "string",
            "example": "Gian Carlo Tuquib",
            "description": "From users.fullName via join (not stored)"
          },
          "subjectId": {
            "type": "integer",
            "example": 3,
            "description": "FK → subjects.id (fk_student_subjects_subject)"
          },
          "courseId": {
            "type": "integer",
            "example": 3,
            "description": "Backwards-compatibility alias for subjectId"
          },
          "status": {
            "type": "string",
            "enum": [
              "ENROLLED",
              "COMPLETED",
              "DROPPED"
            ],
            "example": "ENROLLED",
            "description": "Enrollment status (CHECK constraint). Only ENROLLED gives the student access to the approved syllabus."
          },
          "academicYear": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{4}$",
            "example": "2026-2027",
            "description": "School year the student takes the subject (CHECK: YYYY-YYYY)."
          },
          "semester": {
            "type": "string",
            "enum": [
              "1st Semester",
              "2nd Semester",
              "Summer"
            ],
            "example": "1st Semester"
          },
          "enrolledById": {
            "type": "integer",
            "nullable": true,
            "example": 10001,
            "description": "FK → users.id (fk_student_subjects_enrolled_by): who created the enrollment"
          },
          "enrolledBy": {
            "type": "object",
            "nullable": true,
            "properties": {
              "id": {
                "type": "integer"
              },
              "fullName": {
                "type": "string"
              },
              "role": {
                "type": "string"
              }
            }
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "student": {
            "$ref": "#/components/schemas/UserProfile"
          },
          "subject": {
            "$ref": "#/components/schemas/Subject"
          },
          "course": {
            "allOf": [
              {
                "$ref": "#/components/schemas/Subject"
              }
            ],
            "description": "Backwards-compatibility alias for subject"
          }
        }
      },
      "Syllabus": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "example": 10
          },
          "courseId": {
            "type": "integer",
            "example": 1
          },
          "instructorId": {
            "type": "integer",
            "example": 10001,
            "description": "5-digit educator ID number"
          },
          "departmentId": {
            "type": "string",
            "enum": [
              "CPE",
              "EE",
              "CE",
              "ECE",
              "IE",
              "ME"
            ],
            "example": "CPE"
          },
          "academicYear": {
            "type": "string",
            "example": "2026-2027"
          },
          "semester": {
            "type": "string",
            "example": "1st Semester"
          },
          "section": {
            "type": "string",
            "example": "A"
          },
          "status": {
            "type": "string",
            "enum": [
              "DRAFT",
              "SUBMITTED",
              "UNDER_REVIEW",
              "APPROVED",
              "REJECTED",
              "ARCHIVED"
            ],
            "example": "APPROVED"
          },
          "currentVersionNumber": {
            "type": "integer",
            "example": 1
          },
          "reviewerRemarks": {
            "type": "string",
            "nullable": true,
            "example": "Approved for 1st Semester AY 2026-2027."
          },
          "course": {
            "$ref": "#/components/schemas/Course"
          },
          "instructor": {
            "$ref": "#/components/schemas/UserProfile"
          },
          "department": {
            "type": "object"
          },
          "latestVersion": {
            "$ref": "#/components/schemas/SyllabusVersion"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          },
          "subjectId": {
            "type": "integer",
            "example": 1,
            "description": "Subject foreign key referencing subjects.id"
          },
          "subject": {
            "$ref": "#/components/schemas/Subject"
          }
        }
      },
      "SyllabusVersion": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "example": 25
          },
          "syllabusId": {
            "type": "integer",
            "example": 10
          },
          "versionNumber": {
            "type": "integer",
            "example": 1
          },
          "changeSummary": {
            "type": "string",
            "example": "Initial syllabus drafting (Version 1)"
          },
          "approvalStatus": {
            "type": "string",
            "enum": [
              "DRAFT",
              "SUBMITTED",
              "UNDER_REVIEW",
              "APPROVED",
              "REJECTED",
              "ARCHIVED"
            ],
            "example": "APPROVED"
          },
          "statusAtSave": {
            "type": "string",
            "example": "Approved"
          },
          "fileName": {
            "type": "string",
            "nullable": true,
            "example": "cpe101_syllabus.pdf"
          },
          "fileUrl": {
            "type": "string",
            "nullable": true,
            "example": "/uploads/syllabi/cpe101.pdf"
          },
          "fileType": {
            "type": "string",
            "nullable": true,
            "example": "PDF",
            "enum": [
              "PDF"
            ]
          },
          "fileSize": {
            "type": "integer",
            "nullable": true,
            "example": 1048576
          },
          "submittedAt": {
            "type": "string",
            "format": "date-time",
            "nullable": true
          },
          "submittedById": {
            "type": "integer",
            "nullable": true,
            "example": 10001
          },
          "reviewedAt": {
            "type": "string",
            "format": "date-time",
            "nullable": true
          },
          "reviewedById": {
            "type": "integer",
            "nullable": true,
            "example": 10000
          },
          "rejectionReason": {
            "type": "string",
            "nullable": true
          },
          "content": {
            "type": "object"
          },
          "syllabus": {
            "type": "object"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "AuditLog": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "example": 1
          },
          "userId": {
            "type": "integer",
            "nullable": true,
            "example": 2022012708
          },
          "userDisplayName": {
            "type": "string",
            "nullable": true,
            "example": "Gian Carlo"
          },
          "actionType": {
            "type": "string",
            "example": "Login"
          },
          "resultStatus": {
            "type": "string",
            "enum": [
              "Success",
              "Failed",
              "Warning"
            ],
            "example": "Success"
          },
          "description": {
            "type": "string",
            "example": "User successfully logged in as [Student]"
          },
          "entityType": {
            "type": "string",
            "nullable": true,
            "example": "User"
          },
          "entityId": {
            "type": "string",
            "nullable": true,
            "example": "2022012708"
          },
          "ipAddress": {
            "type": "string",
            "nullable": true,
            "example": "127.0.0.1"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      },
      "Subject": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "example": 1,
            "description": "Internal database subject ID"
          },
          "code": {
            "type": "string",
            "example": "CPE101",
            "description": "Institutional subject code (e.g. CPE101, NET201)"
          },
          "title": {
            "type": "string",
            "example": "Computer Engineering as a Discipline",
            "description": "Descriptive subject title"
          },
          "description": {
            "type": "string",
            "nullable": true,
            "example": "Foundational concepts in computer engineering."
          },
          "units": {
            "type": "integer",
            "example": 3,
            "description": "Academic credit units"
          },
          "lecHours": {
            "type": "integer",
            "example": 3,
            "description": "Weekly lecture hours"
          },
          "labHours": {
            "type": "integer",
            "example": 0,
            "description": "Weekly laboratory hours"
          },
          "prerequisite": {
            "type": "string",
            "nullable": true,
            "example": "None"
          },
          "yearLevel": {
            "type": "string",
            "example": "1st Year"
          },
          "semester": {
            "type": "string",
            "example": "1st Semester"
          },
          "departmentId": {
            "type": "string",
            "enum": [
              "CPE",
              "EE",
              "CE",
              "ECE",
              "IE",
              "ME"
            ],
            "example": "CPE"
          },
          "professorName": {
            "type": "string",
            "nullable": true,
            "example": "Engr. Alan Turing"
          },
          "department": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "example": "CPE"
              },
              "code": {
                "type": "string",
                "example": "CPE"
              },
              "name": {
                "type": "string",
                "example": "Computer Engineering Department"
              }
            }
          },
          "isEnrolled": {
            "type": "boolean",
            "example": true
          },
          "enrolledStudentsCount": {
            "type": "integer",
            "example": 5
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      }
    }
  }
};
