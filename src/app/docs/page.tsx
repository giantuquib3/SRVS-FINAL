'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Database,
  ExternalLink,
  Shield,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Layers,
  Key,
  Network,
  Users,
  GraduationCap,
  FileText,
  Clock,
  ChevronRight,
  Info
} from 'lucide-react';

export default function SwaggerDocsPage() {
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [loadingDb, setLoadingDb] = useState(true);
  const [activeTab, setActiveTab] = useState<'api' | 'schema'>('api');
  const [selectedTable, setSelectedTable] = useState<string>('departments');

  const fetchDbStatus = async () => {
    setLoadingDb(true);
    try {
      const res = await fetch('/api/system/db-status');
      const data = await res.json();
      setDbStatus(data);
    } catch (e) {
      setDbStatus({ status: 'unreachable' });
    } finally {
      setLoadingDb(false);
    }
  };

  useEffect(() => {
    fetchDbStatus();

    // Dynamically inject Swagger UI CSS and Bundle JS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js';
    script.async = true;
    script.onload = () => {
      if ((window as any).SwaggerUIBundle) {
        (window as any).SwaggerUIBundle({
          url: '/api/openapi.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            (window as any).SwaggerUIBundle.presets.apis,
            (window as any).SwaggerUIBundle.SwaggerUIStandalonePreset,
          ],
          layout: 'BaseLayout',
          docExpansion: 'list',
          defaultModelsExpandDepth: 1,
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      document.head.removeChild(link);
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const tablesMeta: Record<string, {
    name: string;
    description: string;
    badge: string;
    pk: string;
    fks: { col: string; target: string; rule: string }[];
    columns: { name: string; type: string; nullable: boolean; desc: string }[];
  }> = {
    departments: {
      name: 'departments',
      description: 'Institutional academic engineering departments (CPE, EE, CE, ECE, IE, ME). Serves as the primary reference for all department-scoped entities.',
      badge: 'Core Reference',
      pk: 'id (VARCHAR(10)) — e.g. "CPE"',
      fks: [],
      columns: [
        { name: 'id', type: 'VARCHAR(10)', nullable: false, desc: 'Primary Key (String code: CPE, EE, CE, ECE, IE, ME)' },
        { name: 'code', type: 'VARCHAR(10)', nullable: false, desc: 'Unique Department Identifier' },
        { name: 'name', type: 'TEXT', nullable: false, desc: 'Full Department Name (e.g. Computer Engineering Department)' },
        { name: 'description', type: 'TEXT', nullable: true, desc: 'College / Faculty description' },
        { name: 'createdAt', type: 'TIMESTAMP', nullable: false, desc: 'Registration timestamp' },
        { name: 'updatedAt', type: 'TIMESTAMP', nullable: false, desc: 'Last modification timestamp' },
      ],
    },
    users: {
      name: 'users',
      description: 'Master authentication and user directory consolidating System Administrators, Department Heads, Educators (Faculty), and Students.',
      badge: 'Master Directory',
      pk: 'id (INTEGER) — University ID Number (0: Admin, 5 digits: Faculty/DeptHead, 10 digits: Student)',
      fks: [
        { col: 'departmentId', target: 'departments.id', rule: 'ON DELETE SET NULL ON UPDATE CASCADE' },
      ],
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, desc: 'Primary Key (Numeric University ID)' },
        { name: 'email', type: 'TEXT', nullable: false, desc: 'Institutional USJ-R email (Unique)' },
        { name: 'passwordHash', type: 'TEXT', nullable: false, desc: 'Bcrypt hashed password' },
        { name: 'fullName', type: 'TEXT', nullable: false, desc: 'Full institutional name' },
        { name: 'role', type: 'TEXT', nullable: false, desc: 'Enum: Admin | DepartmentHead | Educator | Student' },
        { name: 'departmentId', type: 'VARCHAR(10)', nullable: true, desc: 'FK -> departments.id' },
        { name: 'academicRank', type: 'TEXT', nullable: true, desc: 'Chairperson, Professor, Instructor, etc.' },
        { name: 'yearLevel', type: 'TEXT', nullable: true, desc: '1st Year, 2nd Year, 3rd Year, 4th Year (Students)' },
        { name: 'accountStatus', type: 'TEXT', nullable: false, desc: 'Active | PendingApproval | Rejected | Deactivated' },
        { name: 'createdAt', type: 'TIMESTAMP', nullable: false, desc: 'Account creation date' },
        { name: 'updatedAt', type: 'TIMESTAMP', nullable: false, desc: 'Account update date' },
      ],
    },
    courses: {
      name: 'courses',
      description: 'Academic curriculum courses catalog managed by Department Heads and System Administrators.',
      badge: 'Academic Curriculum',
      pk: 'id (INTEGER SERIAL)',
      fks: [
        { col: 'departmentId', target: 'departments.id', rule: 'ON DELETE RESTRICT ON UPDATE CASCADE' },
        { col: 'facultyId', target: 'users.id', rule: 'ON DELETE SET NULL ON UPDATE CASCADE' },
      ],
      columns: [
        { name: 'id', type: 'INTEGER (SERIAL)', nullable: false, desc: 'Primary Key' },
        { name: 'code', type: 'TEXT', nullable: false, desc: 'Course Code (e.g. CPE101) [Unique]' },
        { name: 'title', type: 'TEXT', nullable: false, desc: 'Descriptive Course Title' },
        { name: 'description', type: 'TEXT', nullable: true, desc: 'Overview of topics and objectives' },
        { name: 'units', type: 'INTEGER', nullable: false, desc: 'Credit units (Default: 3)' },
        { name: 'lecHours', type: 'INTEGER', nullable: false, desc: 'Lecture hours per week' },
        { name: 'labHours', type: 'INTEGER', nullable: false, desc: 'Laboratory hours per week' },
        { name: 'prerequisite', type: 'TEXT', nullable: true, desc: 'Required prerequisite courses' },
        { name: 'yearLevel', type: 'TEXT', nullable: true, desc: 'Target academic year level' },
        { name: 'semester', type: 'TEXT', nullable: true, desc: '1st Semester | 2nd Semester | Summer' },
        { name: 'departmentId', type: 'VARCHAR(10)', nullable: false, desc: 'FK -> departments.id' },
        { name: 'facultyName', type: 'TEXT', nullable: true, desc: 'Name of syllabus author' },
        { name: 'facultyId', type: 'INTEGER', nullable: true, desc: 'FK -> users.id (Educator/DeptHead)' },
        { name: 'createdAt', type: 'TIMESTAMP', nullable: false, desc: 'Course creation date' },
        { name: 'updatedAt', type: 'TIMESTAMP', nullable: false, desc: 'Course modification date' },
      ],
    },
    enrollments: {
      name: 'enrollments',
      description: 'Student course enrollments with composite primary key (studentId, courseId). Direct connection to student user record and course.',
      badge: 'Student Records',
      pk: '(studentId INT, courseId INT) — Composite Primary Key',
      fks: [
        { col: 'studentId', target: 'users.id', rule: 'ON DELETE CASCADE ON UPDATE CASCADE' },
        { col: 'courseId', target: 'courses.id', rule: 'ON DELETE CASCADE ON UPDATE CASCADE' },
      ],
      columns: [
        { name: 'studentId', type: 'INTEGER', nullable: false, desc: 'FK -> users.id (Student University ID)' },
        { name: 'courseId', type: 'INTEGER', nullable: false, desc: 'FK -> courses.id' },
        { name: 'studentName', type: 'TEXT', nullable: false, desc: 'Cached student full name' },
        { name: 'semester', type: 'TEXT', nullable: false, desc: 'Semester of enrollment' },
        { name: 'academicYear', type: 'TEXT', nullable: false, desc: 'e.g. 2026-2027' },
        { name: 'section', type: 'TEXT', nullable: false, desc: 'Class section (e.g. A, B)' },
        { name: 'status', type: 'TEXT', nullable: false, desc: 'ENROLLED | COMPLETED | DROPPED' },
        { name: 'createdAt', type: 'TIMESTAMP', nullable: false, desc: 'Enrollment timestamp' },
        { name: 'updatedAt', type: 'TIMESTAMP', nullable: false, desc: 'Status update timestamp' },
      ],
    },
    syllabi: {
      name: 'syllabi',
      description: 'Master syllabus records governing course offerings, revision cycles, and Department Head reviews.',
      badge: 'Syllabus Lifecycle',
      pk: 'id (INTEGER SERIAL)',
      fks: [
        { col: 'courseId', target: 'courses.id', rule: 'ON DELETE CASCADE ON UPDATE CASCADE' },
        { col: 'instructorId', target: 'users.id', rule: 'ON DELETE CASCADE ON UPDATE CASCADE' },
        { col: 'departmentId', target: 'departments.id', rule: 'ON DELETE RESTRICT ON UPDATE CASCADE' },
        { col: 'reviewedByUserId', target: 'users.id', rule: 'ON DELETE SET NULL ON UPDATE CASCADE' },
      ],
      columns: [
        { name: 'id', type: 'INTEGER (SERIAL)', nullable: false, desc: 'Primary Key' },
        { name: 'courseId', type: 'INTEGER', nullable: false, desc: 'FK -> courses.id' },
        { name: 'instructorId', type: 'INTEGER', nullable: false, desc: 'FK -> users.id (Educator/DeptHead)' },
        { name: 'departmentId', type: 'VARCHAR(10)', nullable: false, desc: 'FK -> departments.id' },
        { name: 'academicYear', type: 'TEXT', nullable: false, desc: 'Target academic year' },
        { name: 'semester', type: 'TEXT', nullable: false, desc: 'Target semester' },
        { name: 'section', type: 'TEXT', nullable: false, desc: 'Course section' },
        { name: 'status', type: 'TEXT', nullable: false, desc: 'Draft | Submitted | Approved | Rejected' },
        { name: 'currentVersionNumber', type: 'INTEGER', nullable: false, desc: 'Active approved version number' },
        { name: 'reviewerRemarks', type: 'TEXT', nullable: true, desc: 'Feedback comments from Department Head' },
        { name: 'submittedAt', type: 'TIMESTAMP', nullable: true, desc: 'Submission for review timestamp' },
        { name: 'reviewedAt', type: 'TIMESTAMP', nullable: true, desc: 'Approval/rejection timestamp' },
        { name: 'reviewedByUserId', type: 'INTEGER', nullable: true, desc: 'FK -> users.id (Department Head)' },
        { name: 'createdAt', type: 'TIMESTAMP', nullable: false, desc: 'Initial creation timestamp' },
        { name: 'updatedAt', type: 'TIMESTAMP', nullable: false, desc: 'Latest modification timestamp' },
      ],
    },
    syllabus_versions: {
      name: 'syllabus_versions',
      description: 'Immutable historical snapshots of syllabus revisions with document attachments, author attribution, and review state.',
      badge: 'Revision History',
      pk: 'id (INTEGER SERIAL)',
      fks: [
        { col: 'syllabusId', target: 'syllabi.id', rule: 'ON DELETE CASCADE ON UPDATE CASCADE' },
        { col: 'editorId', target: 'users.id', rule: 'ON DELETE RESTRICT ON UPDATE CASCADE' },
        { col: 'submittedById', target: 'users.id', rule: 'ON DELETE SET NULL ON UPDATE CASCADE' },
        { col: 'reviewedById', target: 'users.id', rule: 'ON DELETE SET NULL ON UPDATE CASCADE' },
      ],
      columns: [
        { name: 'id', type: 'INTEGER (SERIAL)', nullable: false, desc: 'Primary Key' },
        { name: 'syllabusId', type: 'INTEGER', nullable: false, desc: 'FK -> syllabi.id' },
        { name: 'versionNumber', type: 'INTEGER', nullable: false, desc: 'Sequential version number (1, 2, 3...)' },
        { name: 'editorId', type: 'INTEGER', nullable: false, desc: 'FK -> users.id (Editor/Author)' },
        { name: 'changeSummary', type: 'TEXT', nullable: false, desc: 'User explanation of modifications' },
        { name: 'changeType', type: 'TEXT', nullable: false, desc: 'Create | Edit | Submit | Approve | Reject | Restore' },
        { name: 'statusAtSave', type: 'TEXT', nullable: false, desc: 'Status at snapshot creation' },
        { name: 'approvalStatus', type: 'TEXT', nullable: false, desc: 'Approval state at snapshot' },
        { name: 'content', type: 'JSONB', nullable: false, desc: 'Complete immutable content payload' },
        { name: 'fileName', type: 'TEXT', nullable: true, desc: 'Uploaded file original name' },
        { name: 'fileUrl', type: 'TEXT', nullable: true, desc: 'Hosted file storage path' },
        { name: 'fileType', type: 'TEXT', nullable: true, desc: 'PDF | DOC | DOCX' },
        { name: 'fileSize', type: 'INTEGER', nullable: true, desc: 'File size in bytes' },
        { name: 'submittedById', type: 'INTEGER', nullable: true, desc: 'FK -> users.id' },
        { name: 'submittedAt', type: 'TIMESTAMP', nullable: true, desc: 'Submission timestamp' },
        { name: 'reviewedById', type: 'INTEGER', nullable: true, desc: 'FK -> users.id' },
        { name: 'reviewedAt', type: 'TIMESTAMP', nullable: true, desc: 'Review timestamp' },
        { name: 'rejectionReason', type: 'TEXT', nullable: true, desc: 'Feedback if rejected' },
        { name: 'createdAt', type: 'TIMESTAMP', nullable: false, desc: 'Snapshot timestamp' },
        { name: 'updatedAt', type: 'TIMESTAMP', nullable: false, desc: 'Snapshot update timestamp' },
      ],
    },
    audit_logs: {
      name: 'audit_logs',
      description: 'Comprehensive security and institutional activity audit trail logging authentication events, syllabus approvals, course creations, and enrollment changes.',
      badge: 'Security Audit',
      pk: 'id (INTEGER SERIAL)',
      fks: [
        { col: 'userId', target: 'users.id', rule: 'ON DELETE SET NULL ON UPDATE CASCADE' },
      ],
      columns: [
        { name: 'id', type: 'INTEGER (SERIAL)', nullable: false, desc: 'Primary Key' },
        { name: 'userId', type: 'INTEGER', nullable: true, desc: 'FK -> users.id (Actor ID)' },
        { name: 'userDisplayName', type: 'TEXT', nullable: true, desc: 'Cached display name of actor' },
        { name: 'actionType', type: 'TEXT', nullable: false, desc: 'Login | CreateCourse | ApproveSyllabus | etc.' },
        { name: 'resultStatus', type: 'TEXT', nullable: false, desc: 'Success | Failed | Warning' },
        { name: 'description', type: 'TEXT', nullable: false, desc: 'Human-readable action description' },
        { name: 'entityType', type: 'TEXT', nullable: true, desc: 'User | Course | Syllabus | Enrollment' },
        { name: 'entityId', type: 'TEXT', nullable: true, desc: 'Target record identifier' },
        { name: 'ipAddress', type: 'TEXT', nullable: true, desc: 'Client IP address' },
        { name: 'createdAt', type: 'TIMESTAMP', nullable: false, desc: 'Event timestamp' },
      ],
    },
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-900 flex flex-col font-sans">
      {/* Top USJ-R Navigation Header */}
      <div className="bg-[#005A36] border-b-2 border-[#C99700] text-white px-4 lg:px-8 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-[#FEF08A]/40 flex items-center justify-center shadow-inner">
              <BookOpen className="w-5 h-5 text-[#FEF08A]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-sm tracking-wider uppercase text-white">USJ-R SRVS</span>
                <span className="text-[10px] bg-[#FEF08A] text-[#854D0E] font-extrabold px-2 py-0.5 rounded-full">
                  OFFICIAL API & SCHEMA PORTAL
                </span>
              </div>
              <p className="text-[11px] text-emerald-100 font-medium">
                University of San Jose - Recoletos • Syllabus Repository, Revision and Versioning System
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <a
              href="/api/openapi.json"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center space-x-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#FEF08A]" />
              <span>openapi.json</span>
            </a>
            <Link
              href="/"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-[#005A36] hover:bg-emerald-50 flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Portal</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Database Status & Health Bar */}
      <div className="bg-white border-b border-slate-200 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <Database className="w-4 h-4 text-[#005A36]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900">PostgreSQL Relational Database</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  dbStatus?.status === 'healthy'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {loadingDb ? 'CONNECTING...' : dbStatus?.status?.toUpperCase()}
                </span>
                {dbStatus?.latencyMs && (
                  <span className="text-[10px] font-mono text-slate-500">({dbStatus.latencyMs})</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Supabase Pooled PostgreSQL • 7 Organized Connected Tables Online
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {dbStatus?.tables && (
              <div className="hidden lg:flex items-center space-x-2 text-[11px] font-mono text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <span>Depts: <strong className="text-[#005A36]">{dbStatus.tables.departments ?? 6}</strong></span>
                <span>•</span>
                <span>Users: <strong className="text-[#005A36]">{dbStatus.tables.users ?? 22}</strong></span>
                <span className="text-slate-400">({dbStatus.tables.admins ?? 1} Adm, {dbStatus.tables.department_heads ?? 4} DH, {dbStatus.tables.educators ?? 5} Edu, {dbStatus.tables.students ?? 12} Stu)</span>
                <span>•</span>
                <span>Courses: <strong className="text-[#005A36]">{dbStatus.tables.courses ?? 13}</strong></span>
                <span>•</span>
                <span>Enrollments: <strong className="text-[#005A36]">{dbStatus.tables.enrollments ?? 9}</strong></span>
                <span>•</span>
                <span>Syllabi: <strong className="text-[#005A36]">{dbStatus.tables.syllabi ?? 0}</strong></span>
                <span>•</span>
                <span>Audit Logs: <strong className="text-[#005A36]">{dbStatus.tables.audit_logs ?? 41}</strong></span>
              </div>
            )}
            <button
              onClick={fetchDbStatus}
              disabled={loadingDb}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Refresh database status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDb ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-[#FAFBFB] border-b border-slate-200 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto flex space-x-2">
          <button
            onClick={() => setActiveTab('api')}
            className={`py-3 px-4 font-bold text-xs flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === 'api'
                ? 'border-[#005A36] text-[#005A36] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Interactive OpenAPI 3.0 Explorer</span>
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-100 text-emerald-800 font-extrabold">
              28 Endpoints
            </span>
          </button>

          <button
            onClick={() => setActiveTab('schema')}
            className={`py-3 px-4 font-bold text-xs flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === 'schema'
                ? 'border-[#005A36] text-[#005A36] bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
            }`}
          >
            <Network className="w-4 h-4" />
            <span>Database Schema & Architecture</span>
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-100 text-amber-900 font-extrabold">
              7 Connected Tables
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8">
        {/* TAB 1: Swagger OpenAPI UI */}
        <div className={activeTab === 'api' ? 'block' : 'hidden'}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:p-6">
            <div className="mb-4 pb-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <span>Interactive Endpoint Testing Portal</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">OpenAPI 3.0.3</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Execute live HTTP requests with cookie session authentication, inspect request bodies, query parameters, and JSON payloads.
                </p>
              </div>
              <div className="flex items-center space-x-2 text-xs font-medium text-slate-600">
                <Shield className="w-4 h-4 text-[#005A36]" />
                <span>Session Cookie: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono">srvs_token</code></span>
              </div>
            </div>

            <div id="swagger-ui" className="swagger-container" />
          </div>
        </div>

        {/* TAB 2: Database Schema & Entity Relationship Architecture */}
        <div className={activeTab === 'schema' ? 'block' : 'hidden'}>
          <div className="space-y-6">
            {/* Architecture Highlights Banner */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                  <Layers className="w-6 h-6 text-[#005A36]" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    USJ-R SRVS Unified Database Architecture
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    The database has been designed and organized to eliminate table redundancy while strictly preserving relational foreign key integrity.
                    All Primary Keys and Foreign Keys are <strong className="text-emerald-800">INTEGERS</strong>, except for <strong className="text-amber-800">departmentId (String: CPE, EE, CE, ECE, IE, ME)</strong>.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                      <div className="flex items-center space-x-2 text-xs font-bold text-emerald-900">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Unified User Directory</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 mt-1">
                        Consolidated in <code className="bg-emerald-100 px-1 rounded">users</code> (with backward-compatible <code className="bg-emerald-100 px-1 rounded">admin</code> SQL view). Direct foreign keys from courses, enrollments, syllabi, versions, and audits.
                      </p>
                    </div>

                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                      <div className="flex items-center space-x-2 text-xs font-bold text-amber-900">
                        <Key className="w-4 h-4 text-amber-700" />
                        <span>Dedicated Departments</span>
                      </div>
                      <p className="text-[11px] text-amber-800 mt-1">
                        Table <code className="bg-amber-100 px-1 rounded">departments</code> with String PK <code className="bg-amber-100 px-1 rounded">id</code>. Enforces foreign key constraints on <code className="bg-amber-100 px-1 rounded">users.departmentId</code>, <code className="bg-amber-100 px-1 rounded">courses.departmentId</code>, and <code className="bg-amber-100 px-1 rounded">syllabi.departmentId</code>.
                      </p>
                    </div>

                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                      <div className="flex items-center space-x-2 text-xs font-bold text-blue-900">
                        <Shield className="w-4 h-4 text-blue-600" />
                        <span>Dual Database Parity</span>
                      </div>
                      <p className="text-[11px] text-blue-800 mt-1">
                        Primary Supabase (<code className="bg-blue-100 px-1 rounded">qoxpqhvecjxlsbsshxsm</code>) and Secondary (<code className="bg-blue-100 px-1 rounded">goxvhkbwfpffjnqphzpq</code>) are synchronized to 100% exact parity with all 14 foreign keys.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual ER Diagram Box */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-2 flex items-center space-x-2">
                <Network className="w-4 h-4 text-[#005A36]" />
                <span>Entity-Relationship Architecture Overview</span>
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Visual relationship flow depicting how each entity connects through integer IDs and string department identifiers:
              </p>

              <div className="p-4 bg-slate-900 text-emerald-400 rounded-xl font-mono text-xs overflow-x-auto shadow-inner border border-slate-800 leading-relaxed">
{`┌────────────────────────────────┐         1:N         ┌────────────────────────────────┐
│          departments           │ ──────────────────> │             users              │
│  PK: id VARCHAR(10) ('CPE'...) │                     │  PK: id INTEGER (University ID)│
│  code, name, description       │                     │  role, deptId, email, status   │
└────────────────────────────────┘                     └────────────────────────────────┘
        │ 1:N                         1:N                       │ 1:N
        │                                                       │
        ▼                                                       ▼
┌────────────────────────────────┐       1:N Student   ┌────────────────────────────────┐
│            courses             │ <────────────────── │          enrollments           │
│  PK: id INTEGER (SERIAL)       │                     │  PK: (studentId, courseId) INT │
│  code (UNIQUE), title, units   │                     │  studentName, semester, status │
│  FK: departmentId -> dept.id   │                     └────────────────────────────────┘
│  FK: facultyId -> users.id     │                              ▲
└────────────────────────────────┘                              │
        │ 1:N                                                   │
        ▼                                                       │
┌────────────────────────────────┐                              │
│            syllabi             │ ─── FK: instructorId ────────┤
│  PK: id INTEGER (SERIAL)       │ ─── FK: reviewedByUserId ────┤
│  FK: courseId -> courses.id    │                              │
│  FK: departmentId -> dept.id   │                              │
└────────────────────────────────┘                              │
        │ 1:N                                                   │
        ▼                                                       │
┌────────────────────────────────┐                              │
│       syllabus_versions        │ ─── FK: editorId ────────────┤
│  PK: id INTEGER (SERIAL)       │ ─── FK: submittedById ───────┤
│  FK: syllabusId -> syllabi.id  │ ─── FK: reviewedById ────────┤
│  versionNumber, content(JSONB) │                              │
└────────────────────────────────┘                              │
                                                                │
┌────────────────────────────────┐                              │
│           audit_logs           │ ─── FK: userId ──────────────┘
│  PK: id INTEGER (SERIAL)       │
│  actionType, resultStatus, desc│
└────────────────────────────────┘`}
              </div>
            </div>

            {/* Interactive Table Directory */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Table List Sidebar */}
              <div className="lg:col-span-1 space-y-2">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                  Database Tables ({Object.keys(tablesMeta).length})
                </h4>
                {Object.entries(tablesMeta).map(([key, meta]) => {
                  const isSelected = selectedTable === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedTable(key)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-[#005A36] text-white border-[#005A36] shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Database className={`w-3.5 h-3.5 ${isSelected ? 'text-[#FEF08A]' : 'text-slate-400'}`} />
                        <span className="font-mono">{key}</span>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-300'}`} />
                    </button>
                  );
                })}
              </div>

              {/* Selected Table Details Panel */}
              <div className="lg:col-span-3">
                {tablesMeta[selectedTable] && (() => {
                  const table = tablesMeta[selectedTable];
                  return (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <div>
                          <div className="flex items-center space-x-3">
                            <h3 className="text-lg font-black text-slate-900 font-mono">
                              table: {table.name}
                            </h3>
                            <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {table.badge}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {table.description}
                          </p>
                        </div>
                      </div>

                      {/* Primary Key and Foreign Keys Badges */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                          <span className="font-bold text-amber-900 flex items-center space-x-1.5">
                            <Key className="w-3.5 h-3.5 text-amber-700" />
                            <span>Primary Key</span>
                          </span>
                          <p className="text-[11px] font-mono text-amber-800 mt-1">
                            {table.pk}
                          </p>
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                          <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                            <Network className="w-3.5 h-3.5 text-slate-600" />
                            <span>Foreign Keys ({table.fks.length})</span>
                          </span>
                          {table.fks.length === 0 ? (
                            <p className="text-[11px] text-slate-500 mt-1">None (Base root entity)</p>
                          ) : (
                            <ul className="text-[11px] font-mono text-slate-700 mt-1 space-y-1">
                              {table.fks.map((fk, idx) => (
                                <li key={idx} className="flex items-center space-x-1.5">
                                  <span className="text-emerald-700">{fk.col}</span>
                                  <span className="text-slate-400">&rarr;</span>
                                  <span className="font-bold text-slate-900">{fk.target}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      {/* Columns Table */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                          Table Columns ({table.columns.length})
                        </h4>
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                              <tr>
                                <th className="px-3 py-2.5">Column Name</th>
                                <th className="px-3 py-2.5">Data Type</th>
                                <th className="px-3 py-2.5">Nullable</th>
                                <th className="px-3 py-2.5">Description & Constraints</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-[11px]">
                              {table.columns.map((col, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80">
                                  <td className="px-3 py-2 font-mono font-bold text-slate-900">
                                    {col.name}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-emerald-700">
                                    {col.type}
                                  </td>
                                  <td className="px-3 py-2 text-slate-500">
                                    {col.nullable ? 'YES' : 'NO (Required)'}
                                  </td>
                                  <td className="px-3 py-2 text-slate-600">
                                    {col.desc}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Swagger Style Customization */}
      <style jsx global>{`
        .swagger-ui .topbar {
          display: none !important;
        }
        .swagger-ui .info {
          margin: 15px 0 25px 0 !important;
        }
        .swagger-ui .info .title {
          font-family: inherit !important;
          color: #005a36 !important;
          font-size: 24px !important;
          font-weight: 800 !important;
        }
        .swagger-ui .scheme-container {
          background: #f8faf9 !important;
          box-shadow: none !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 12px !important;
          padding: 15px 20px !important;
          margin-bottom: 20px !important;
        }
        .swagger-ui .opblock {
          border-radius: 12px !important;
          box-shadow: none !important;
          margin-bottom: 12px !important;
          border: 1px solid #e2e8f0 !important;
        }
        .swagger-ui .opblock .opblock-summary {
          padding: 10px 15px !important;
        }
        .swagger-ui .btn.execute {
          background-color: #005a36 !important;
          border-color: #005a36 !important;
          color: #ffffff !important;
          border-radius: 8px !important;
        }
        .swagger-ui .btn.authorize {
          background-color: #c99700 !important;
          border-color: #c99700 !important;
          color: #ffffff !important;
          border-radius: 8px !important;
        }
      `}</style>
    </div>
  );
}
