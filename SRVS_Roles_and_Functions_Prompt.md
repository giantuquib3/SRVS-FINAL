# SRVS — AI Prompt: User Key Roles & General Functions
## Syllabus Repository, Revision and Versioning System
### Tech Stack: ReactJS + Node.js + Express.js

---

> **Instructions for AI:**
> Read this entire prompt carefully before writing any code.
> This document defines WHO uses the system and WHAT each role can do.
> Every feature described here must be implemented with role-awareness —
> meaning the UI and API must always check the logged-in user's role before
> rendering or allowing any action.

---

## PART 1 — USER KEY ROLES

The system has exactly **4 roles**. Each role has its own set of permissions,
its own dashboard, and a specific position in the syllabus approval workflow.
Roles are assigned by the System Administrator. A user can only hold one role
at a time.

---

### ROLE 1 — System Administrator

**Who they are:**
The superuser of the entire platform. Typically 1–2 IT or academic affairs staff
members at the institution. They have unrestricted access to every part of the system.

**What they can do (complete list):**

#### User Account Management
- Create new user accounts for any role (Admin, Dept. Head, Educator, Viewer)
- View the User Approval Queue — a list of educators who registered but are pending
- Approve or reject pending educator registrations
  - If approved → educator account becomes active and can create syllabi
  - If rejected → educator is notified with optional reason; they cannot log in
- Assign, change, or revoke a user's role at any time
- Activate or deactivate user accounts (deactivated accounts cannot log in, but
  all their data and audit history is preserved)
- Search any user by name or email
- View a user's full login history, role history, and activity record
- Permanently delete a user account (deletion is logged in the audit trail)

#### Syllabus Review and Approval
- View ALL syllabi in the system regardless of status:
  `Draft`, `Submitted`, `Approved`, `Rejected`
- Access the Pending Reviews Queue — a dedicated list showing all syllabi
  currently awaiting admin decision, sorted by submission date
- Read the full content of any submitted syllabus using the online viewer
- APPROVE a submitted syllabus:
  - Status changes to `Approved`
  - Syllabus is immediately published and visible to all Viewers/Students
  - Submitting educator receives an approval notification
- REJECT a submitted syllabus:
  - Status changes to `Rejected`
  - Admin may optionally write rejection feedback
  - Feedback is sent directly to the submitting educator as a notification
  - Syllabus returns to a draft-editable state for the educator to revise
- Delete any syllabus from the system (deletion is permanently logged)
- Override and manage any syllabus escalated or flagged by a Department Head

#### System Monitoring and Audit
- Access the complete, unfiltered audit trail of every action across the platform
- Search and filter audit logs by:
  - Action type (e.g., Login, ApproveSyllabus, DeleteUser)
  - User name or email
  - Result status: `Success`, `Warning`, or `Error`
  - Date range
- Generate statistical activity reports and compliance summaries
  (used for accreditation reviews, institutional audits, or board reports)
- View real-time system statistics on the admin dashboard:
  - Total syllabi count
  - Total versions stored
  - Registered user count
  - Pending reviews count
  - Recent activity feed
- Receive in-app notifications for:
  - All newly submitted syllabi
  - New user registrations
  - Any system-level events requiring attention

**Admin Dashboard Contents:**
- System statistics panel (4 stat cards: syllabi, versions, users, pending)
- Pending Reviews list with inline Approve/Reject buttons
- User Approval Queue for pending educator registrations
- Recent Activity feed (last 10 system-wide events)
- Quick links: View All Syllabi, Manage Users, Audit Logs, Settings

---

### ROLE 2 — Department Head / Academic Coordinator

**Who they are:**
The academic quality-control layer. Each Department Head is assigned to one or more
departments. They ensure syllabi meet curriculum standards and institutional policies.
They do NOT have full admin powers — they observe, review, recommend, and report.
They cannot create, edit, approve, reject, or delete any syllabus.

**What they can do (complete list):**

#### Syllabus Review and Curriculum Oversight
- View ALL syllabi within their assigned department(s), including Drafts
  (they CANNOT see syllabi from other departments)
- Review syllabus revisions to ensure alignment with:
  - Institutional curriculum standards
  - Accreditation requirements
  - Departmental academic policies
- Use the Version Comparison Tool to view exactly what changed between
  any two versions of a departmental syllabus:
  - Additions highlighted in green
  - Deletions highlighted in red
- Recommend or flag modifications on any syllabus in their department:
  - Can leave written notes for the educator or administrator to act upon
- Escalate concerns about syllabus content or compliance to the System Admin
- Monitor which courses in the department have:
  - A current published syllabus
  - A syllabus pending review
  - An outdated syllabus
  - No syllabus at all for the current academic period

#### Version History and Change Monitoring
- Access full version history and complete change log for any syllabus in
  their department
- View per-version metadata: timestamp, editor name, change summary, change type
- Compare any two historical versions of a departmental syllabus
- Monitor recent version activity across all courses in the department
  via the department head dashboard activity feed

#### Reporting and Compliance
- View department-level statistics:
  - Total syllabi
  - Syllabi by status (Draft, Submitted, Approved, Rejected)
  - Syllabi updated this semester
  - Syllabi flagged for review
- Generate a department-level syllabus status report for submission to
  academic affairs, accreditation bodies, or curriculum committees
- Receive in-app notifications when any syllabus in their department is:
  submitted, approved, rejected, or updated
- View audit log entries scoped to actions taken on syllabi within their department

**What they CANNOT do (explicit restrictions):**
- Cannot create, edit, submit, approve, reject, or delete any syllabus
- Cannot manage user accounts or change roles
- Cannot access syllabi or audit data outside their assigned department(s)
- Cannot access the full system-wide audit trail

**Dept. Head Dashboard Contents:**
- Department Overview: all courses with current syllabus status per course
  (includes a "Missing" indicator for courses with no active syllabus this term)
- Recent Version Activity feed for all departmental syllabi
- Flagged Syllabi section (syllabi this dept. head has marked for review)
- Department stats panel: syllabi by status, updated this term, missing this term
- Quick links: View Department Syllabi, Reports, Version Comparison Tool

---

### ROLE 3 — Educator (Instructor / Faculty Member)

**Who they are:**
The primary content creators. They build, revise, and maintain syllabi for courses
they teach or co-instruct. All content they create must pass through the review
workflow and receive admin approval before students can see it.

**What they can do (complete list):**

#### Syllabus Creation
- Create a new syllabus for any course they are assigned to, using a structured
  input form with the following standardized fields:

  REQUIRED fields:
  - Course Code (e.g., CS-101, MATH-201)
  - Course Title
  - Department
  - Academic Year (e.g., 2025–2026)
  - Semester / Term (First Semester / Second Semester / Summer Term)
  - Instructor Name
  - Course Description
  - Learning Objectives
  - Learning Outcomes
  - Assessment Methods
  - Grading Criteria
  - Course Content / Weekly Schedule
  - Required Textbooks / Materials

  OPTIONAL fields:
  - Additional / Supplementary Materials

  ON EDIT (mandatory):
  - Change Summary — the educator MUST describe what changed in this version

- Save a syllabus as a Draft at any time without submitting it for review
- Multiple drafts across different courses may exist simultaneously
- Edit a saved draft any number of times before submission
  Every save — including draft saves — automatically creates a new version entry
  with the editor's name, timestamp, and change summary
- Preview the syllabus before submitting — renders it exactly as
  viewers/students will see it after approval

#### Collaborative Editing
- Collaborate with other faculty on syllabi for co-taught courses
- All collaborators can edit the same syllabus; each person's saves are
  individually attributed in the version history by name and timestamp
- Change summaries create a transparent record of each collaborator's contribution
- Sequential edit logging prevents one collaborator's save from silently
  overwriting another's

#### Version Control and History
- View the complete version history of any syllabus they own or co-author:
  - Version number, timestamp, editor name, change summary, change type, status
- Select any two versions and view a side-by-side diff:
  - Green = additions in the newer version
  - Red = deletions from the older version
- Restore any previous version:
  - Creates a new version entry with the historical version's content
  - The restored version enters Draft status and goes through approval again
  - No prior versions are ever deleted

#### Submission and Workflow
- Submit a completed draft for admin review with a single Submit action
  Status changes from `Draft` → `Submitted`
- While a syllabus is under review (status = Submitted), the educator
  CANNOT edit it until the admin makes a decision
- Receive notification when admin approves or rejects the submission
- If rejected: receive admin's written feedback, edit the syllabus to address it,
  then resubmit
- View the status of all their syllabi at a glance from the educator dashboard

**Educator Dashboard Contents:**
- My Syllabi list with status breakdown tiles:
  Draft count | Submitted count | Approved count | Rejected count
  (each tile is clickable and drills down to filtered list)
- Notification Center showing unread alerts with action links
- Recent Activity feed for own syllabi
- Quick-action buttons: Create New Syllabus, View My Syllabi,
  View Notifications, View Version History

---

### ROLE 4 — Viewer (Student / Guest User)

**Who they are:**
End consumers of the syllabus management process. They interact exclusively
in read-only mode. They can ONLY see syllabi with status = `Approved`.
They never see drafts, submitted versions, or rejected entries.

**What they can do (complete list):**

#### Browsing and Searching
- Access the Viewer dashboard showing approved syllabi and a browse-by-department
  interface upon login
- Browse all approved syllabi organized by academic department
  (e.g., Computer Science, Civil Engineering, Mathematics)
- Search for any approved syllabus using:
  - Course name (partial match supported)
  - Course code
  - Department
  - Academic year and semester
- View summary info per search result:
  Course Code | Course Title | Department | Semester / Year

#### Viewing and Downloading
- Open and read the full content of any approved syllabus in the online viewer
- All syllabus fields are readable:
  Course description, learning objectives, outcomes, assessment methods,
  grading criteria, weekly schedule, required materials, instructor information
- Download or print any approved syllabus for offline reference
- Guests (unauthenticated users) may browse approved syllabi if the
  system is configured to allow public access

**What they CANNOT do (explicit restrictions):**
- Cannot create, edit, submit, approve, reject, or delete any syllabus
- Cannot see syllabi in Draft, Submitted, or Rejected status — ever
- Cannot access version history, diff tool, or restoration feature
- Cannot access audit logs, reports, user management, or any admin screen
- Cannot download syllabi in editable formats — only view/print of published version

**Viewer Dashboard Contents:**
- Approved syllabi browser with course cards
- Browse by Department navigation sidebar
- Search bar for course lookup
- Download / Print button alongside each accessible syllabus

---

## PART 2 — GENERAL FUNCTIONS

These are the core system-wide features. Each function must be implemented
with role-awareness. The behavior changes depending on who is logged in.

---

### FUNCTION 1 — Role-Based Login and Authentication

**Purpose:** Secure entry point for all users. Every user must authenticate
before accessing any feature. The backend identifies their role and enforces
their permission set on every subsequent request.

**Login Process:**
1. User navigates to the SRVS login page (`/login`)
2. User enters registered email + password
3. Backend validates credentials:
   - If valid → issue JWT in an HTTP-only cookie, redirect to role-specific dashboard
   - If invalid → return error message, log the failed attempt in the audit trail
4. The login event (timestamp, user identity, IP address, result) is permanently
   recorded in the audit log regardless of success or failure

**Role Assignment on Login:**

| Role | Redirected To | Access Unlocked |
|---|---|---|
| System Administrator | `/admin/dashboard` | Full system: all syllabi, all users, audit logs, settings, pending approvals |
| Department Head | `/dept/dashboard` | Departmental: syllabi in assigned dept, version history, comparison, reports |
| Educator | `/educator/dashboard` | Own syllabi at all stages, version history, comparison, restoration, submission workflow |
| Viewer | `/viewer/dashboard` | Approved syllabi only: browse, search, view, download/print |

**Educator Registration Flow:**
- New educators register at `/register`
- Account enters `Pending Approval` state — they CANNOT access any features
- Admin sees the pending registration in their User Approval Queue
- Admin approves → account becomes active, educator receives notification
- Admin rejects → educator is notified, account is not created

**Session Security Rules:**
- Sessions expire after **2 hours of inactivity** (server-side enforced)
- On first request after timeout → user is redirected to `/login` with
  a "session expired" message
- All auth events (login, logout, failed attempts, timeout) are logged
  in the audit trail
- JWT stored in **HTTP-only cookies only** (never localStorage or sessionStorage)
- CSRF protection tokens required on all state-changing requests

---

### FUNCTION 2 — Role-Specific Dashboards

**Purpose:** Each role gets a personalized landing page after login that
surfaces only role-relevant data and provides quick access to common tasks.

**Implementation Notes:**
- Dashboard data is fetched from the backend on page load
- Each dashboard only requests and displays data the role is permitted to see
- Dashboards include a notification bell icon showing unread notification count
- All dashboard sections are lazy-loaded where appropriate for performance

Dashboard layouts are described per role in Part 1 above.

---

### FUNCTION 3 — Syllabus Creation and Management

**Who can create:** Educator, System Administrator
**Who can edit:** Educator (own syllabi only), System Administrator (any syllabus)
**Who can delete:** System Administrator only

**Behavior:**

CREATE:
- User opens the structured syllabus form (all required fields described in Role 3)
- User fills in all required fields
- User clicks Save Draft → system creates the syllabus with status = `Draft`
  and creates Version 1 in the SyllabusVersions table
- The form must validate all required fields before allowing save
- Invalid or empty required fields show inline error messages

EDIT:
- User opens an existing Draft syllabus
- Makes changes
- The Change Summary field is now REQUIRED (cannot save without it)
- Clicks Save → system creates a new version entry (v2, v3, etc.) with:
  - Editor name (the logged-in user)
  - Timestamp
  - Change summary
  - Full content snapshot
  - Status at save
- The syllabus record's `updatedAt` timestamp is also updated

PREVIEW:
- Available before submission
- Opens a read-only rendered view of the syllabus exactly as viewers will see it
- Does not create a new version

DELETE (Admin only):
- Permanently removes the syllabus and all its versions
- Action is logged in the audit trail

---

### FUNCTION 4 — Collaborative Editing

**Who can use:** Educator (as co-author), System Administrator

**How it works:**
- The primary educator (syllabus creator) can designate other faculty members
  as co-authors on a syllabus
- All co-authors can open and edit the syllabus
- When any co-author saves, a new version is created under THEIR identity
  (not the original creator's name)
- The version history clearly shows each person's individual contributions
- Change summaries act as a communication channel between collaborators

**Conflict Prevention:**
- The system uses sequential edit logging
- When a collaborator opens an already-modified syllabus, they see the latest
  version, not a stale copy
- If two collaborators save at nearly the same time, the second save will be
  stored as a new version on top of the first — no silent overwrite
- Collaborators are notified via the notification system when a co-author
  saves changes

---

### FUNCTION 5 — Version Control System

**Who can view version history:**
- Admin: any syllabus
- Dept. Head: syllabi in their department
- Educator: own syllabi and co-authored syllabi
- Viewer: NO access

**Core Concept:**
Every syllabus maintains a complete, immutable, chronological history.
Each version is a **full content snapshot** — not a diff — so any version
can be rendered independently without reconstructing from a chain of changes.

**When a new version is created (automatically):**
- Any save operation (including draft saves)
- When educator submits for review (status change recorded as version event)
- When admin approves or rejects (decision + feedback recorded as version event)
- When a version restoration is performed

**Version Metadata stored per version:**

| Field | Description |
|---|---|
| Version Number | Sequential integer starting at 1 (v1, v2, v3…) |
| Editor Name | The specific user who triggered this version |
| Timestamp | Exact UTC datetime of creation |
| Change Summary | What changed (mandatory on edit; auto-populated for Submit / Approve / Reject / Restore) |
| Change Type | One of: `Create`, `Edit`, `Submit`, `Approve`, `Reject`, `Restore` |
| Full Content | Complete snapshot of ALL syllabus field values at this point in time |
| Status at Save | `Draft`, `Submitted`, `Approved`, or `Rejected` |

**Version History Panel (UI):**
- Opens as a panel/drawer alongside the syllabus view
- Lists all versions in reverse-chronological order (newest first)
- Each row shows: version number, editor, timestamp, change summary,
  change type badge, status badge
- Action buttons per row:
  - **View** → renders the full syllabus at that version in a read-only viewer
  - **Compare** → selects this version for diff comparison
  - **Restore** → (Educator and Admin only) opens confirmation dialog

---

### FUNCTION 6 — Version Comparison (Diff Viewer)

**Who can use:**
- Admin: any two versions of any syllabus
- Dept. Head: any two versions of syllabi in their department
- Educator: any two versions of syllabi they own or co-author
- Viewer: NO access — not visible in UI

**How it works:**
1. User selects Version A (older / base version)
2. User selects Version B (newer version)
3. System computes a field-by-field comparison and returns a diff result
4. UI renders both versions in a **split-panel side-by-side view**

**Diff Display Rules:**
- Text present in Version A but removed in Version B →
  highlighted in **RED** with strikethrough formatting
- Text present in Version B but not in Version A →
  highlighted in **GREEN**
- Unchanged text → neutral gray color (dimmed)
- Fields with zero changes → collapsed by default, expandable on click
- Statistics banner at the top of the diff view:
  "X additions, Y deletions across Z fields"
- Navigation controls: Previous Change / Next Change buttons for
  jumping between changed sections efficiently

---

### FUNCTION 7 — Version Restoration

**Who can use:** Educator (own syllabi), System Administrator (any syllabus)

**Critical Rule:** Restoration NEVER deletes or overwrites existing versions.
It always creates a brand-new version entry. All history remains permanently
intact.

**Step-by-step process:**
1. User opens the Version History panel
2. Locates the desired historical version in the list
3. Clicks the **Restore** button on that version entry
4. A confirmation dialog appears:
   "Restore this syllabus to Version X (saved on [date] by [editor])?"
   Buttons: Confirm Restore / Cancel
5. On confirm:
   - System creates a NEW version entry
   - Content of the new version = exact copy of the selected historical version
   - New version's Change Type = `Restore`
   - New version's metadata records which historical version number was the source
     (e.g., "Restored from v4")
   - New version enters `Draft` status
   - The restored syllabus MUST go through the standard submission and
     approval workflow before it becomes visible to students

---

### FUNCTION 8 — Submission and Review Workflow

**Purpose:** Enforces a clear chain of accountability. No syllabus becomes
visible to students without passing through this workflow.

**The 5 Stages:**

**Stage 1 — DRAFT**
- Status: `Draft`
- Who acts: Educator
- What happens: Educator creates or edits the syllabus and saves it
- Visibility: Educator, co-authors, assigned Dept. Head, Admin only
- Students/Viewers: CANNOT see this

**Stage 2 — SUBMITTED**
- Status: `Submitted`
- Who acts: Educator (clicks "Submit for Review")
- What happens:
  - Status changes from `Draft` → `Submitted`
  - Admin receives a notification
  - Assigned Dept. Head receives a notification
  - Syllabus appears in Admin's Pending Reviews Queue
  - Educator CANNOT edit the syllabus while it is in this status
- A new version entry is created with Change Type = `Submit`

**Stage 3 — DEPARTMENT HEAD REVIEW**
- Status: still `Submitted` (no separate status label)
- Who acts: Department Head
- What happens:
  - Dept. Head reviews the syllabus content
  - Uses the comparison tool to assess what changed
  - May flag the syllabus and add written notes for the admin
  - Can escalate compliance concerns to the admin
  - Does NOT approve or reject — that belongs to the Admin

**Stage 4 — ADMIN DECISION**
- Status: `Approved` or `Rejected`
- Who acts: System Administrator
- What happens: Admin reviews the submission (informed by any Dept. Head notes)
  and makes the final decision

**Stage 5a — APPROVED**
- Status: `Approved`
- What happens:
  - Syllabus is IMMEDIATELY published
  - Visible to all Viewers and Students
  - Educator receives an approval notification
  - A new version entry is created with Change Type = `Approve`

**Stage 5b — REJECTED**
- Status: `Rejected`
- What happens:
  - Admin's written feedback (optional) is sent to the educator as a notification
  - The syllabus returns to a draft-editable state
  - Educator can revise and resubmit
  - A new version entry is created with Change Type = `Reject`
  - The rejection feedback is stored in the version metadata

**Important Rule:** Every stage transition is recorded BOTH as:
1. A version event in SyllabusVersions table
2. An entry in the AuditLog table
Both writes must happen in the SAME database transaction.

---

### FUNCTION 9 — Advanced Search and Filtering

**Who can use:** All authenticated roles
**Role-scoping rules:**
- Viewer: sees only `Approved` syllabi
- Educator: sees own syllabi at all statuses + all `Approved` syllabi from others
- Dept. Head: sees all syllabi in their assigned department
- Admin: sees all syllabi at every status

**Search Parameters:**

| Parameter | Input Type | Behavior |
|---|---|---|
| Course Name | Text field | Case-insensitive substring match across the full course title |
| Course Code | Text field | Partial or exact match (e.g., "CS-1" matches CS-101, CS-102) |
| Department | Dropdown | Filter to one academic department |
| Academic Year / Semester | Dropdown | Filter to specific year or term |
| Status | Dropdown (staff/admin only) | `Draft`, `Submitted`, `Approved`, `Rejected` |
| Author / Educator | Text field | Find syllabi by faculty member name |
| Combined Filters | Multiple active simultaneously | All active filters use AND logic |

**Results Display:**
- Sortable table with columns:
  Course Code | Course Title | Department | Semester / Year | Status | Last Modified
- Paginated at 20 items per page with page navigation controls
- Per-row action buttons (shown based on user's role):
  View | Edit | Compare | Version History
- Results must return in under 2 seconds

---

### FUNCTION 10 — Activity Logging and Audit Trail

**Who can access:**
- Admin: full audit trail, all users, all actions
- Dept. Head: audit entries scoped to actions on syllabi in their department
- Educator: NO access
- Viewer: NO access

**Core Rule:** The audit trail is immutable and append-only.
No user — including the System Administrator — can modify or delete audit entries.

**Events that MUST be logged:**

Authentication:
- User login: email, IP address, timestamp, result (Success / Failure)
- User logout
- Failed login attempts
- Session timeout events

Syllabus Operations:
- Create new syllabus
- Save draft (with resulting version number)
- Submit for review
- Approve submission
- Reject submission (feedback summary included in description)
- Delete syllabus
- Restore version

User Management:
- Admin creates a user account
- Admin approves an educator registration
- Admin rejects an educator registration
- Role change (old role → new role)
- Account deactivation
- Account deletion

Administrative Actions:
- System settings changes
- Any override or bulk operation by an admin

Dept. Head Actions:
- Syllabus flagged for review
- Notes added to a departmental syllabus
- Department report generated

**Audit Entry Fields:**

| Field | Description |
|---|---|
| Log ID | Unique sequential ID — never reused |
| Action Type | Categorized label: `Login`, `CreateSyllabus`, `EditSyllabus`, `SubmitSyllabus`, `ApproveSyllabus`, `RejectSyllabus`, `DeleteSyllabus`, `RestoreVersion`, `CreateUser`, `ApproveUser`, `DeleteUser`, `ChangeRole`, etc. |
| Performed By | Full name and email of the user who performed the action |
| Target Entity | The affected record, e.g., "Syllabus: CS-101 Introduction to Programming, v3" or "User: juan.reyes@institution.edu" |
| Description | Human-readable summary of what occurred, e.g., "Approved syllabus CS-101 v3 submitted by Juan Reyes" |
| Timestamp | Exact UTC datetime |
| Result Status | `Success`, `Warning`, or `Error` |

**Audit Search and Filter (Admin):**
- Filter by: action type, user name/email, result status, date range
- Statistical summaries: total actions per day, most active users, action type distribution
- All audit log views and searches are themselves logged

---

### FUNCTION 11 — Notification System

**Purpose:** Keeps all stakeholders informed of workflow events in real time.
Every notification includes a direct action link to the relevant page.

**In-App Notification Center:**
- Persistent notification bell icon in the navbar for all roles
- Shows unread count badge
- Clicking opens a notification panel/drawer
- Each notification shows: message, timestamp, read/unread status, action link
- Users can mark individual notifications as read or mark all as read

**Notification Triggers and Recipients:**

| Event | Who Gets Notified | What the Notification Says |
|---|---|---|
| Educator submits syllabus for review | System Admin + assigned Dept. Head | "[Course Code] [Title] submitted by [Educator Name] on [date]. Review now →" |
| Admin approves submission | Submitting Educator | "[Course Code] [Title] has been approved by [Admin Name] on [date]. View published syllabus →" |
| Admin rejects submission | Submitting Educator | "[Course Code] [Title] was rejected. Feedback: [admin's feedback text]. Edit and resubmit →" |
| New approved syllabus published | All Viewers/Students | "[Course Code] [Title] is now available. View syllabus →" |
| Dept. Head flags a syllabus | System Admin + Submitting Educator | "[Course Code] [Title] flagged by [Dept. Head Name]: [flag notes]. View →" |
| Admin creates new user account | The new user | "Welcome to SRVS. Your account has been created with the role of [Role]. Login →" |
| Admin approves educator registration | The educator | "Your SRVS educator account is now active. You can now create and submit syllabi. Login →" |
| Admin rejects educator registration | The pending educator | "Your educator registration was not approved. [Reason if provided]." |
| Co-author saves changes | Syllabus owner + all other co-authors | "[Co-Author Name] saved changes to [Course Code] [Title] — Version [N] created. View →" |

**Optional Email Notifications:**
- Users can configure per-event email delivery in their account settings
- Email notifications mirror the in-app notification content

---

## PART 3 — IMPLEMENTATION RULES FOR AI

These are non-negotiable rules. Apply them throughout the entire codebase.

### Rule 1 — Every permission is enforced server-side
The frontend may hide buttons based on role, but the backend MUST independently
verify the user's role and permissions on every API request.
Never trust client-side role claims.
Example: Even if the Educator UI doesn't show an "Approve" button,
a `POST /api/syllabi/:id/approve` request from an Educator must return 403 Forbidden.

### Rule 2 — Audit logging is transactional
Every write operation that modifies syllabus data or user data MUST write to the
audit log in the SAME database transaction.
If the audit log write fails → the primary operation must also roll back.
Partial writes (syllabus saved but not logged) are not acceptable.

### Rule 3 — Version snapshots are full content copies
Store the complete syllabus content in every SyllabusVersion record.
Do NOT store diffs or deltas. Each version must be independently renderable
without referencing any other version.

### Rule 4 — Scoped queries everywhere
When fetching syllabi, always filter by the requesting user's role and department:
- Viewer → only `status = Approved`
- Educator → own syllabi (any status) + all `Approved` syllabi
- Dept. Head → all syllabi where `departmentId = user.departmentId`
- Admin → no filter (all records)
Apply this scoping at the database query level, not in application memory.

### Rule 5 — Status transitions are strictly enforced
Valid transitions only:
  `Draft → Submitted` (Educator submits)
  `Submitted → Approved` (Admin approves)
  `Submitted → Rejected` (Admin rejects)
  `Rejected → Draft` (automatically, so educator can edit again)
  `Draft → Draft` (every save stays in Draft until submitted)
  `Approved → [new Draft via Restore]` (only via the Restore function)
Any other transition must return an error.

### Rule 6 — Restoration never deletes
Restoring a version always creates a NEW SyllabusVersion entry.
Never update or overwrite an existing version record.

### Rule 7 — Notifications are async and non-blocking
Fire notifications after the primary operation succeeds.
A notification failure must NOT roll back or block the main operation.
Log notification failures separately for debugging.

---

*SRVS — Syllabus Repository, Revision and Versioning System*
*Authors: Tuquib, Lima, Miraveles*
*Stack: ReactJS + Node.js + Express.js*
