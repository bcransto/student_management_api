# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development Environment
```bash
# CRITICAL: Always activate virtual environment first
source myenv/bin/activate  # NOT 'venv' - must use 'myenv'

# Start development server
python manage.py runserver
# Kill if port in use: lsof -ti:8000 | xargs kill -9 2>/dev/null

# Database operations
python manage.py makemigrations
python manage.py migrate
python manage.py shell  # Django shell for debugging
python manage.py createsuperuser  # Create admin user

# Run tests
python manage.py test                    # All Django app tests
python manage.py test students.tests    # Students app tests
python manage.py test attendance.tests  # Attendance app tests

# Standalone test files (run from project root)
python test_nickname_functionality.py   # Nickname handling tests
python test_seating_api.py             # Seating API tests
python test_chart_naming.py            # Chart auto-naming tests
python test_partnership_endpoint.py    # Partnership rating tests
python test_recent_attendance.py       # Recent attendance history

# Linting and formatting
npm run lint:all          # Frontend + backend linting
npm run lint:python       # Backend only (flake8, black check, isort check)
npm run format:python     # Format with Black/isort
npm run lint              # Frontend only (ESLint, HTMLHint)
npm run format            # Format frontend with Prettier
```

### No Build Process
Frontend is pure React served directly through Django - no webpack/babel:
- Edit files directly in `frontend/`
- Refresh browser to see changes
- Access app at http://127.0.0.1:8000/
- Admin at http://127.0.0.1:8000/admin/

## Architecture Overview

### Tech Stack
- **Backend**: Django 5.2.3 + Django REST Framework
- **Frontend**: React 18 via CDN (no JSX, uses React.createElement)
- **Database**: SQLite (local and production on pinto)
- **Auth**: JWT with email-based login (uses email field, not username)
- **Settings Module**: `student_project.settings`
- **Google Integration**: OAuth 2.0 for Classroom API access
- **Token Storage**: Encrypted fields using django-encrypted-model-fields

### Critical Model Relationships

```python
# Seating hierarchy
Class → classroom_layout (FK to ClassroomLayout)
SeatingPeriod → layout (FK to ClassroomLayout, PROTECT on delete)
SeatingPeriod → class_assigned (FK to Class)
SeatingAssignment → seating_period (FK to SeatingPeriod)
SeatingAssignment → roster_entry (FK to ClassRoster, not Student!)

# Student fields (global, Workspace-sync-owned - see GH issue #14 phase 1)
Student.cohort    # Two-digit email-prefix grad year (e.g. "28"), indexed
Student.synced_at # When the directory sync last touched the row
# nickname/gender/preferential_seating moved OFF Student to the per-teacher
# TeacherStudent layer (below). date_of_birth stays global + teacher-writable.

# Per-teacher annotations (nickname/gender/preferential seating)
TeacherStudent → teacher (FK User), student (FK Student)
# unique_together [teacher, student]; nickname (blank→first_name fallback),
# gender (nullable, same choices), preferential_seating (bool), is_active.
# Strictly private per teacher, start blank, never seeded/shared. Serializers
# resolve the flattened student_nickname/student_gender/
# student_preferential_seating fields through the CLASS TEACHER's row
# (ClassRoster/Attendance) or the REQUESTING user's row (StudentSerializer),
# so the frontend API contract is unchanged.

# Partnership tracking
PartnershipRating → class_assigned, student1, student2
# Auto-orders: student1 always has lower ID than student2

# Attendance tracking
AttendanceRecord → roster_entry (FK to ClassRoster)
AttendanceRecord → date, status, notes
# Status choices: 'present', 'absent', 'tardy', 'early_dismissal'

# Class fields (required)
Class.name        # CharField, required
Class.subject     # CharField, required
Class.teacher     # ForeignKey to User, required

# Google Classroom OAuth storage
GoogleClassroomCredentials → user (OneToOne)
GoogleClassroomCredentials.access_token  # Encrypted
GoogleClassroomCredentials.refresh_token # Encrypted
GoogleClassroomCredentials.token_expiry
GoogleClassroomCredentials.scopes
```

### Frontend Component Architecture

**React without JSX Pattern**:
```javascript
// All components use React.createElement
React.createElement("div", { className: "example" }, children)
// Never use JSX syntax
```

**Key Components & Their Quirks**:

1. **SeatingEditor.js** (Complex state management)
   - Assignments state: `{tableId: {seatNumber: studentId}}` with string keys
   - Seat ID format: "tableNumber-seatNumber" (e.g., "1-2")
   - Left sidebar (250px) and right sidebar (250px) with controls
   - Search includes nickname field
   - **Fill System**: Six modes
     - Random: Random student selection
     - First Name (A-Z): Alphabetical by first name/nickname
     - Last Name (A-Z): Alphabetical by last name
     - Match Gender: Groups similar genders
     - Balance Gender: Alternates genders
     - Smart Pair: Double-click seated student to find optimal partner
   - **Fill Interactions**:
     - Double-click empty seat: Auto-assigns student based on mode
     - Auto button: Fills all empty seats (disabled in Smart Pair mode)
     - Batch operations create single undo entry
   - **Undo System**: Full history tracking with 50-level limit
   - **Seat Deactivation**: Shift+click to block seats (red, stored in Set)
   - **Period Navigation**: View-only - does NOT modify database end_dates
   - **Dynamic Grid Scaling**: Automatically scales to fit viewport with fixed sidebars
   - **Highlight Modes** (ALL use DOM manipulation with setProperty('important')):
     - Normal: Blue borders on all seats, light blue background for empty
     - Gender: Green for female, blue for male/other
     - Previous: Amber highlighting for students sitting with former tablemates
   - **Partnership Features**:
     - Single-click any student shows partnership history modal (250ms delay to handle double-click)
     - Partnership Ratings button opens grid for teacher preferences (-2 to +2)
     - Tracks historical seating partnerships across completed periods
     - Smart Pair algorithm uses weighted lottery based on history and ratings

2. **SeatingViewer.js** (Read-only viewer)
   - View modes: Teacher View, Student View, Print View (placeholder)
   - Student View: Mirrors layout 180° for student perspective
   - Text counter-rotation keeps names/numbers readable in all views
   - View transformations handled by `viewTransformations.js`
   - Button-style dropdown for view selection
   - Toolbar buttons fixed at 100px width with 10px spacing

3. **Students Components**
   - `formatStudentNameTwoLine()` returns { line1: nickname, line2: "Smi." } for consistent two-line display
   - `formatStudentName()` deprecated - use formatStudentNameTwoLine for new features
   - Search filters by nickname, first_name, last_name, student_id, email
   - **`#students` is scoped to "my students"** (the requesting teacher's active
     `TeacherStudent` rows) - the list `/api/students/` endpoint filters
     automatically, so ClassStudentManager's enrollment picker and every other
     consumer see the same scoped list (#14 phase 2)
   - **No manual student creation** (#14): global Student rows only enter via
     the Workspace sync (phase 3) or a Google import. The "Add Student" button
     opens `StudentPicker.js` (adds EXISTING students from the app's school
     list to my list - it does not create rows); the "Add Cohort" button opens
     `AddCohortModal.js`. Neither talks to Google - the old teacher-facing
     "Import from Workspace" modal (`WorkspaceImportModal.js`) was removed once
     the sync owned the school list (the /api/google/directory-* endpoints
     remain for the sync + any admin use)
   - `StudentPicker.js` - "Add Student" modal picker over the school-wide list
     (`/api/students/school-list/`): filter by cohort dropdown, per-row Add /
     Remove, "Add all in cohort". Excludes archived students. Registered in
     `index.html` like the other student modals
   - `AddCohortModal.js` - one modal, two toolbar buttons via `mode` prop
     ("add" | "remove"): "Add Cohort" / "Remove Cohort". Cohort dropdown with
     counts; calls add-to-my-list/remove-from-my-list `{cohort}` - app's list
     only, no Google. Remove confirms first and only hides students from my
     list (rosters/seating/attendance untouched)
   - `StudentEditor.js` - edit-only (no create mode). Sync-owned fields
     (student ID, first/last name, email, Google ID) are read-only display;
     editable fields are nickname/gender/preferential seating (per-teacher) plus
     date of birth (global). "Remove from My List" replaces the old delete;
     shows an "Archived" badge when `is_active=False`
   - All name displays (pool, seats, viewer) use two-line format: nickname on line 1, last name truncated to 3 chars on line 2

4. **Layout System**
   - ClassroomLayout filtered by `created_by` user
   - Layouts can be templates (`is_template` flag)
   - Tables contain seats with relative positioning
   - Layout editor at `/layout-editor/` (standalone page)
   - Opens in same window when clicking layout cards
   - Soft delete for layouts (is_active field)

5. **Classes Components**
   - **ClassView**: Simple table-based roster view (redesigned)
     - Clean page-header with class name as title
     - Subtitle shows: Subject • Grade Level • X students
     - Toolbar with small inline-styled buttons (Back, Edit, Add Students)
     - Table format matching students list (Name, Student ID, Email, Status, Actions)
     - Clickable rows navigate to student edit
     - Unenroll button in Actions column (teacher only)
   - ClassEditor: Edit name, subject (required), grade_level, description
   - Soft delete for roster entries (is_active field) preserves history
   - ClassStudentManager handles bulk enrollment with search/filter
   - Batch mode supports pasting student IDs or email addresses
   - Re-enrollment capability for previously enrolled students
   - Permission-based UI - only class teacher sees management controls

6. **Attendance Components**
   - **AttendanceEditor.js**: List-based attendance taking interface
     - Status options: present, absent, tardy, early_dismissal
     - Date navigation with Previous/Next buttons (view-only)
     - Unsaved changes warning before navigation
     - Bulk save for all students at once
     - Student list sorted alphabetically by last name, then first name
   - **AttendanceVisual.js**: Visual attendance using seating chart
     - Click seats to toggle attendance status
     - Color-coded status indicators on seats
     - Save button activation on changes
     - Class dropdown selector in toolbar
     - Navigating with dropdown loads today's date (not preserved date)
   - **AttendanceReport.js**: Analytics and reporting dashboard
     - Summary cards: Total Days, Attendance Rate, Students, Absences, Tardies
     - Perfect attendance recognition section
     - Students needing attention (>10% absence rate) 
     - Detailed table with color-coded absence rates
     - CSV export functionality
   - **attendance.js**: Class card list with three action buttons per class
     - List Mode button (blue) - traditional attendance list
     - Visual Mode button (green) - seating chart attendance
     - Report button (orange) - analytics dashboard

7. **Special Points Components** (proxies to external Cranston Commons API)
   - **Access restricted** to `bcranston@carlisle.k12.ma.us` only:
     - Sidebar nav item hidden for other users (`sidebar.js` checks JWT email)
     - Frontend routes redirect unauthorized users to `#dashboard` (`app.js`)
     - Backend enforces `IsSpecialPointsUser` permission (`students/permissions.py`)
   - **special-points.js**: Class card list with two buttons: List Mode, Visual Mode (no Report)
   - **SpecialPointsEditor.js**: List-based point awarding
     - Table columns: Student | Total Points (from Cranston Commons) | Award (number input)
     - Loading spinner while fetching point totals
     - Handles students without email: shows "No email", disables input
     - Shows "Not registered" for emails not found in Cranston Commons
     - Error banner shows specific message (bad API key vs connection failure)
     - No date navigation (points are not date-based)
   - **SpecialPointsVisual.js**: Visual points using seating chart
     - Two badges per seat: total points (purple, top-left), pending award (green/red, top-right)
     - Single tap = +1, long press (~500ms) = -1
     - Floating announcements on each action (e.g., "Izzy +1")
     - Save sends batch to Cranston Commons, updates totals from response
   - **Backend**: `SpecialPointsProxyViewSet` in `students/views.py`
     - `POST /api/special-points/fetch/` — batch get point totals by email
     - `POST /api/special-points/award/batch/` — award/deduct points for multiple students
     - Proxies to Cranston Commons with `X-API-Key` header (key stored in Django settings)
     - Upstream 401/403 converted to 502 (prevents frontend JWT refresh loop)
     - Returns 502 with descriptive error message if Cranston Commons is unreachable or rejects key

### API Patterns

**ApiModule.request() - MUST use options object**:
```javascript
// CORRECT - ApiModule automatically prepends /api/
await ApiModule.request('/endpoint/', {  // Note: no /api/ prefix needed
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

// WRONG - Common mistakes
await ApiModule.request(url, method, body)  // ❌ Separate parameters
await ApiModule.request('/api/endpoint/')   // ❌ Double /api/ prefix
```

**Critical Serializer Behaviors**:
- SeatingAssignment expects `roster_entry` ID, not `student` ID
- student_nickname falls back to the student's first_name when the resolving
  teacher's TeacherStudent.nickname is blank (resolution is per-teacher now)
- API responses may be paginated: check for `results` key
- ClassRoomLayout ViewSet filters by `created_by` user (except superusers)
- ClassSerializer.roster only returns active entries (is_active=True)
- ClassRosterSerializer returns flattened student fields (student_first_name, not student.first_name)
- JWT token includes user_id for permission checks

**Partnership API Endpoints**:
```python
# GET /api/classes/{class_id}/partnership-history/
# Returns historical seating partnerships for all students
# Only includes completed periods (end_date != null)
# Groups students by table to find partnerships

# GET /api/classes/{class_id}/partnership-ratings/
# Returns grid of current partnership ratings
# Response structure: {
#   class_id: 1,
#   students: [{id, name, nickname}...],
#   grid: {
#     "1": {student_name: "John", ratings: {"2": -2, "3": 1}},
#     "2": {student_name: "Jane", ratings: {"1": -2}}
#   }
# }

# POST /api/classes/{class_id}/partnership-ratings/
# Set single partnership rating
# Body: {student1_id, student2_id, rating: -2 to 2}
# Ratings: -2 (Never Together), -1 (Avoid), 0 (Neutral), 1 (Good), 2 (Best)

# POST /api/classes/{class_id}/bulk-update-ratings/
# Update multiple ratings at once
# Body: {ratings: [{student1_id, student2_id, rating}]}
```

**Attendance API Endpoints**:
```python
# GET /api/attendance/by-class/{class_id}/{date}/
# Returns attendance records for specific class and date
# Response: {attendance_records: [{student, status, notes}...]}

# GET /api/attendance/dates/{class_id}/
# Returns list of dates with attendance for a class
# Response: {dates: ["2024-01-15", "2024-01-16"...]}

# GET /api/attendance/totals/{class_id}/
# Returns attendance totals for all students in a class
# Response: {totals: [{student_id, student_name, absent, tardy, early_dismissal}...]}

# POST /api/attendance/bulk-save/
# Save or update attendance for multiple students
# Body: {
#   date: "2024-01-15",
#   attendance_records: [
#     {class_roster_id: 1, status: "present", notes: ""},
#     {class_roster_id: 2, status: "absent", notes: "Sick"}
#   ]
# }
# CRITICAL: Use class_roster_id, not roster_entry or student_id
```

**Special Points API Endpoints** (proxy to Cranston Commons):
```python
# POST /api/special-points/fetch/
# Get current point totals for students by email
# Body: {"emails": ["s1@school.edu", "s2@school.edu"]}
# Response: {"students": {"s1@school.edu": {"points": 50}}, "not_found": []}

# POST /api/special-points/award/batch/
# Award/deduct points for multiple students
# Body: {"awards": [{"email": "s1@school.edu", "points": 5, "reason": ""}]}
# Response: {"results": [{"email": "...", "points_awarded": 5, "new_total": 55}]}
```

**Google Sign-In & Classroom Endpoints**:
```python
# GET /api/auth/google/signin/
# Returns {"client_id": ...} so the login page can render the GIS button
# POST /api/auth/google/signin/
# Body: {"credential": "<Google ID token>"}
# Verifies the token, matches an EXISTING user by email (no auto-creation),
# returns {"access", "refresh"} JWTs with the same custom claims as /api/token/
# NOTE: app origins must be listed under "Authorized JavaScript origins"
# in the Google Cloud Console OAuth client for the button to work

# GET /api/google/oauth-url/?next=<hash route>
# JWT-authenticated. Returns {"auth_url": ...} for connecting Google Classroom.
# The user id + return route travel in a SIGNED state param (10 min expiry);
# the callback stores credentials for that user and redirects to /#<next>

# GET /api/auth/google/callback/
# Handles OAuth callback; verifies signed state, stores encrypted tokens
# in GoogleClassroomCredentials for the user from the state

# GET /api/google/courses/
# JWT-authenticated. {"connected": bool, "courses": [{id, name, section}]}
# connected=false means show a "Connect Google Classroom" button

# GET /api/google/courses/{course_id}/students/
# JWT-authenticated. {"students": [{google_user_id, first_name, last_name,
#                                   full_name, email}]}

# POST /api/google/import-students/
# Body: {"course_id": "...", "class_id": 1}
# Class must belong to request.user. Matches Students by google_user_id,
# then email (iexact); creates missing Students (student_id from email
# local part, suffixed on collision); enrolls/reactivates roster entries.
# Returns {total, created, enrolled, reenrolled, already_enrolled, skipped}

# POST /api/google/disconnect/
# JWT-authenticated. Removes stored Google Classroom credentials for
# request.user (state-changing, so POST rather than GET)

# GET /api/google/status/
# JWT-authenticated. Cheap connection check - only reads the local
# GoogleClassroomCredentials row, no Google API call. Never returns tokens.
# {"connected": false} or
# {"connected": true, "token_expiry": ..., "scopes": [...], "updated_at": ...}

# --- Workspace directory import (Admin SDK, whole-cohort) ---
# Needs admin.directory.user.readonly scope; readable by a normal teacher
# account via viewType=domain_public. Shared helpers in
# google_classroom_service.py: _get_directory_service (connection/scope/
# refresh gate -> needs_reconnect + auth_url), _fetch_domain_users (paginated).

# GET /api/google/directory-cohorts/
# Groups domain users by two-digit email prefix (e.g. "28" = class of 2028);
# staff (no digit prefix) excluded. {connected, cohorts: [{cohort, count}]}

# GET /api/google/directory-students/?cohort=28
# {cohort, students: [{student_id (from externalIds), first_name, last_name,
#   email, google_user_id, exists}]}. exists computed server-side.

# POST /api/google/import-directory-students/  Body: {"cohort": "28"}
# Creates only missing students with REAL district IDs; matches by
# google id -> student_id -> email, backfilling google id/email WITHOUT
# overwriting student_id. No enrollment. {total, created, existing, skipped}

# --- Workspace directory SYNC (issue #14 phase 3) ---
# Core: students/directory_sync.py :: sync_directory(user, dry_run=False) and
# apply_directory_sync(raw_users, dry_run) (the latter is fixture-testable, no
# Google calls). Credential/refresh core shared with the endpoints via
# google_classroom_service._build_directory_service_for_user(user) (request-free;
# raises DirectoryAuthError, which _get_directory_service wraps into the
# needs_reconnect Response). The two-digit cohort helper is the single canonical
# _cohort_prefix (migration 0021 keeps its own frozen copy).
#
# Behavior: upsert every student-cohort directory user (match google_user_id ->
# student_id -> email iexact; backfill google id/email if blank; NEVER overwrite
# student_id; create missing with real district IDs), setting cohort, synced_at,
# is_active=True on each. Then ARCHIVE (is_active=False) any Student with a
# non-empty google_user_id NOT seen in the fetch (reappearing students
# reactivate); students with no google_user_id are left alone. NEVER touches
# TeacherStudent rows or date_of_birth. Safety valve: if the fetch yields fewer
# than MIN_DIRECTORY_STUDENTS (=1, i.e. zero) student users, archiving is skipped
# so a flaky response can't archive the school. dry_run runs the whole thing in a
# rolled-back transaction (exact counts, no writes).
# Returns {created, updated, reactivated, archived, unchanged, skipped,
#   total_directory, dry_run, safety_valve_triggered, details:{...names...}}.

# Management command (daily timer on pinto; see deploy/):
#   python manage.py sync_workspace_directory [--user <email>] [--dry-run]
# Sync user: --user, else settings.DIRECTORY_SYNC_USER_EMAIL, else CommandError.
# Non-zero exit on failure so cron/systemd flags it.

# POST /api/google/sync-directory/  (JWT, SUPERUSER-ONLY — 403 otherwise; the
# frontend hides the "Sync db" button for non-admins via the JWT is_superuser
# claim) — "Sync now"; runs sync_directory with request.user's creds;
# needs_reconnect shape on missing creds/scope; 502 on fetch failure.
# Response is the summary dict + last_synced.
# GET /api/students/last-synced/  (JWT) — {"last_synced": <ISO ts>|null}
```

**Bulk Student Update (CSV/TSV)**:
```python
# POST /api/students/bulk-update-info/  (StudentViewSet action)
# Body: {"text": "<pasted rows w/ header>", "apply": bool}
# Header (case-insensitive) needs student_id|id or email, plus nickname
# and/or gender. Delimiter auto-sniffed (tab if present else comma), BOM
# stripped. Rows match by student_id then email (iexact). Only non-empty
# cells change anything; gender m/f/o normalized, "-" clears to null,
# other values -> invalid. apply=false is a dry run.
# WRITES TO the requesting teacher's TeacherStudent row (update_or_create),
# NOT the global Student (per GH issue #14). "current" values it diffs
# against are that teacher's annotation (nickname falls back to first_name).
# {applied, updated:[{id,name,changes}], not_found, invalid, unchanged, conflicts}
```

**My-students scoping & list management (#14 phase 2)**:
```python
# StudentViewSet is scoped to the requesting teacher's list.
# - GET /api/students/  -> only the teacher's ACTIVE TeacherStudent students
#   (archived global students still on the list are included so the UI badges
#   them). Detail/update work for any student the teacher has a TeacherStudent
#   row for OR one enrolled in one of their classes (so roster-click edit works
#   even after a soft removal); an unrelated student 404s.
# - POST /api/students/  -> 405 DISABLED. No manual creation: student IDs/emails
#   are IT-generated. Global rows come only from the Workspace sync (phase 3)
#   or the Google import endpoints.
# - Sync-owned fields (student_id, first_name, last_name, email, google_user_id,
#   cohort, is_active) are READ-ONLY via the serializer. date_of_birth is the
#   one teacher-writable global field. nickname/gender/preferential_seating are
#   per-teacher annotations (TeacherStudent), handled separately.

# GET /api/students/school-list/?cohort=28
# Read-only picker feed of the school-wide list. Excludes archived students
# (is_active=False). {students:[{id,name,first_name,last_name,student_id,email,
#   cohort,on_my_list}], cohorts:[{cohort,count}]}. on_my_list = already on the
# requesting teacher's active list. cohort filters students; cohorts is always
# the full set (stable dropdown).

# POST /api/students/add-to-my-list/    Body: {"student_ids":[...], "cohort":"28"}
# Creates/reactivates TeacherStudent rows for the teacher (either or both keys).
# Annotations left BLANK - never copied from another teacher. Idempotent.
# {added, reactivated, already_on_list}. Only active global students eligible.

# POST /api/students/remove-from-my-list/  Body: {"student_ids":[...], "cohort":"28"}
# Soft-deactivates the teacher's TeacherStudent rows (is_active=False). ONLY
# hides from my-students - NEVER touches ClassRoster/seating/attendance, and
# roster serializers keep resolving annotations through the inactive row.
# Idempotent. {removed}
```

**Google imports add to the importer's list**: both `google_import_students`
(Classroom roster) and `google_import_directory_students` (cohort) call the
`_ensure_teacher_student` helper for every student they create OR match -
importing IS adding to your list. Blank annotations, reactivates a soft-removed
row, never overwrites an existing nickname/gender.

**Blank gender**: gender is a per-teacher `TeacherStudent.gender` (nullable,
"Not set" in StudentEditor); a teacher who hasn't set it sees null for every
student. Seating editor Gender highlight renders null/unset gender as neutral
GRAY (#9ca3af) - distinct from male/other blue and female green. Fill modes
already tolerate null (Match excludes them, Balance places them last).

**Smart Pair Algorithm**:
```javascript
// Weighted lottery system for partner selection
// 1. Filter out -2 (Never Together) pairs
// 2. Calculate weights based on partnership history:
//    - Never paired: 10 lottery balls
//    - Paired 1 time: 10 balls
//    - Paired 2 times: 5 balls  
//    - Paired 3 times: 2 balls
//    - Paired 4+ times: 1 ball
// 3. Random selection weighted by lottery balls
// 4. Partner placed in lowest numbered empty seat at table
```

**Alphabetical Fill Modes**:
```javascript
// sortStudentsByFirstName(): Primary by first_name/nickname, secondary by last_name
// sortStudentsByLastName(): Primary by last_name, secondary by first_name
// Double-click: Always picks first student from sorted list
// Auto-fill: Places students sequentially in empty seats
```

### History & Undo System

**Implementation Pattern**:
```javascript
// All assignment changes must use addToHistory()
const addToHistory = (newAssignments, description) => {
  const entry = {
    assignments: JSON.parse(JSON.stringify(assignments)), // Deep copy before
    newAssignments: JSON.parse(JSON.stringify(newAssignments)), // Deep copy after
    description: description,  // e.g., "Place John Doe", "Auto-fill 12 seats (alphabeticalLast)"
    timestamp: Date.now()
  };
  // Truncate future history, add new entry, limit to 50 entries
}

// Batch operations create single undo entry
handleAutoFill() // Creates one entry for all seats filled
```

### Common Pitfalls & Solutions

**Data Type Consistency**:
```javascript
// Table IDs and seat numbers MUST be strings in assignments
assignments = {
  "106": {         // ✓ String table ID
    "1": studentId // ✓ String seat number
  }
}
```

**API Request Format Issues**:
```javascript
// PROBLEM: Double /api/ prefix
await ApiModule.request('/api/classes/')  // ❌ Results in /api/api/classes/
await ApiModule.request('/classes/')      // ✓ Correctly becomes /api/classes/

// PROBLEM: Wrong data structure for bulk operations
// Attendance bulk save expects specific format:
await ApiModule.request('/attendance/bulk-save/', {
  body: JSON.stringify({
    date: "2024-01-15",
    attendance_records: [  // Must use this exact field name
      {class_roster_id: 1, status: "present", notes: ""}  // Use class_roster_id
    ]
  })
});
```

**React Key Prop Warnings**:
```javascript
// Lists must have unique keys
students.map(student => 
  React.createElement("option", { 
    key: student.id,  // ✓ Always include key for list items
    value: student.id 
  }, student.name)
)
```

**Accessing Flattened Serializer Fields**:
```javascript
// ClassRosterSerializer returns flattened fields
// WRONG - API doesn't return nested student object
const name = roster.student.first_name;  // ❌ undefined

// CORRECT - Use flattened field names
const name = roster.student_first_name;  // ✓
const nickname = roster.student_nickname || roster.student_first_name;
```

**CSS Specificity Battles & DOM Manipulation**:
```javascript
// Inline styles won't work due to !important rules elsewhere
// ALL highlight modes (Normal, Gender, Previous) use this approach:
setTimeout(() => {
  element.style.setProperty('background-color', '#10b981', 'important');
  element.style.setProperty('border', '2px solid #059669', 'important');
}, 100);

// Cleanup when switching modes:
element.style.removeProperty('background-color');
element.style.removeProperty('border');
element.style.removeProperty('color');
```

**SeatingPeriod Current State**:
- Current period identified by `end_date=None` AND `is_tracked=True`
- Creating new tracked period auto-ends previous (sets end_date to today)
- Only one TRACKED period per class can have `end_date=None`
- Model's save() method enforces single current tracked period
- **CRITICAL**: Period navigation (Previous/Next buttons) must NEVER modify end_dates
- Navigation is view-only - historical periods never become active again
- Auto-naming: New periods are named "Chart N" where N increments (tracked only)

**New Chart is a draft until Save (GH issue #15)**:
- In `SeatingEditor.js`, clicking **New Period** makes ZERO database writes.
  It only resolves a layout (current layout, else the user's most recent) and
  flips client-side `isDraftMode` on: assignments/undo history reset, and an
  untouched draft counts as no unsaved changes (silently discardable via
  Back/navigation, matching the existing `hasUnsavedChanges` guards)
- While `isDraftMode` is true, `classInfo.current_seating_period` still
  refers to the OLD (still-active) chart - it has NOT been touched. The bolt
  one-off toggle, Make Active, and the PATCH-based layout-change path are all
  guarded/disabled in draft mode since there is no real period id yet; the
  title shows "New Chart (unsaved)" with an amber "Draft" pill
- Only **Save** commits a draft: it computes the "Chart N" name (tracked
  periods only, counted at save-time, not at New-Period-time) and calls
  `POST /api/seating-periods/create-with-assignments/`, which atomically
  creates the period, auto-ends the previous current tracked period (via the
  model's existing `save()` behavior), and bulk-creates the assignments - all
  in one `transaction.atomic()` block, so a bad assignment rolls back the
  whole thing and the old chart is never left ended with nothing to replace
  it. On success the editor exits draft mode and reloads
- The pre-existing "class has no seating period at all yet" Save path (first
  chart ever) also routes through `create-with-assignments` now, for the same
  atomicity; it keeps its own naming/date convention (`Seating Chart - <date>`,
  start date today) rather than "Chart N" / tomorrow
- ALL New-Chart entry points route into this one draft flow now (no
  immediate-commit copies remain): `SeatingViewer.js`'s New Period button and
  the seating list's "New" card button (`seating.js` `handleNewChart`) just
  confirm and open the editor with a pending-draft handoff. The flag lives in
  module scope in `seating.js` (`seatingDraftHandoff`) because the Seating
  component REMOUNTS during hash navigation (component state would be lost);
  SeatingEditor consumes it once via its `startInDraft`/`onDraftConsumed`
  props after the initial data load (`enterDraftMode()`, the same helper its
  own New Period button uses)

**Untracked One-Off Charts** (`is_tracked=False`):
- Bolt TOGGLE in SeatingEditor marks/unmarks the VIEWED chart in place
  (no navigation): orange = one-off, gray = tracked; amber "One-Off" pill
  shows in the title. Restoring an OPEN one-off routes through make_current
  (re-tracks it and ends any other tracked current period)
- Marking the current chart one-off leaves the class with NO tracked current
  until one is promoted/created. SeatingEditor/SeatingViewer then fall back to
  the most-recently-updated OPEN one-off (not an empty state). Visual
  attendance/special-points still fall back to most-recent chart - a chart
  selector for those is deferred (see GH issue)
- Do NOT end the current period and are never auto-ended by new periods
- Excluded from partnership history, previous_period, current_seating_period,
  attendance/points visual current-chart lookup, and Chart N numbering
- Frontend guard idiom: `p.end_date === null && p.is_tracked !== false`
- "Make Active" on a one-off PROMOTES it: sets is_tracked=True, ends the
  old current period (make_current endpoint handles this)
- Editor/viewer title shows an amber "One-Off" badge when viewing one

**Nickname Handling**:
- Model auto-sets to first_name if empty/whitespace
- Frontend `formatStudentName()` prefers nickname
- Search includes nickname in all filtering

**ClassRoster Soft Delete**:
- Unenroll sets is_active=False (soft delete)
- Preserves attendance_notes, enrollment history, seating assignments
- Re-enrollment reactivates existing roster entry
- current_enrollment property filters by is_active=True

**Attendance Record Management**:
- Always defaults to 'present' for new records
- Bulk save creates/updates all records in single transaction
- Records linked to ClassRoster (not Student directly)
- Date navigation is view-only - doesn't create new records until saved

## Testing Strategy

```bash
# Run specific test files
python test_nickname_functionality.py  # Comprehensive nickname tests
python test_seating_api.py            # Seating API tests
python test_save.py                   # Save functionality tests
python test_chart_naming.py           # Chart auto-naming tests

# Frontend testing
open test_nickname_frontend.html      # Interactive browser tests
open test_optimizer.html              # Seating optimizer tests

# Django app tests
python manage.py test attendance.tests # Attendance app tests
python manage.py test students.tests   # Students app tests
```

## Environment Variables

Required in `.env` for development:
```bash
DEBUG=True
SECRET_KEY=your-secret-key
DJANGO_ENV=development

# Google Classroom OAuth (optional)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
FIELD_ENCRYPTION_KEY=your-encryption-key  # Generate with Fernet

# Cranston Commons (Special Points) — local dev setup:
# Student Management runs on port 8000, Cranston Commons on port 8002
CRANSTON_COMMONS_BASE_URL=http://localhost:8002
CRANSTON_COMMONS_API_KEY=your-api-key-here

# Workspace directory sync (issue #14 phase 3): email of the Google-connected
# account whose stored OAuth credentials `sync_workspace_directory` uses when
# no --user flag is passed. The account must have connected Google with the
# Directory scope (admin.directory.user.readonly).
DIRECTORY_SYNC_USER_EMAIL=bcranston@carlisle.k12.ma.us
```

## Deployment to pinto (Production)

Production runs on **pinto** (10.0.0.200), a local server accessible externally via Tailscale and publicly via a Cloudflare tunnel.

**Public access (Cloudflare tunnel, set up 2026-07-08):**
- Public URL: https://student-management.938752.xyz
- Token-managed `cloudflared` service runs on pinto; public-hostname config
  lives in the Cloudflare Zero Trust dashboard (not a local config file)
- Origin service MUST be HTTP `localhost:1081` — an HTTPS origin causes 502s
- **Google OAuth only works from this HTTPS origin** (Classroom/Workspace
  connect and the Sign-In button) — Google rejects http/raw-IP redirect URIs,
  so the Tailscale IP (100.75.94.59:1081) cannot do the OAuth connect
- `settings.py` (commit 0b25f64) adds the tunnel domain to ALLOWED_HOSTS plus
  SECURE_PROXY_SSL_HEADER and CSRF_TRUSTED_ORIGINS

**Server setup:**
- Gunicorn bound to `0.0.0.0:1081` with 2 workers
- Managed by systemd: `student-management.service`
- Env file: `/home/bcransto/student_management_api/.env` (`DJANGO_ENV=pi`)
- Google OAuth needs `~/student_management_api/credentials.json` (not in git —
  copy from local repo root if missing)
- Static files served via `staticfiles/` (run `collectstatic` when static files change)

**Deploy steps:**
1. Push to GitHub main branch
2. SSH to pinto: `ssh bcransto@pinto`
3. Pull latest:
   ```bash
   cd ~/student_management_api
   git pull origin main
   source myenv/bin/activate
   pip install -r requirements.txt  # if dependencies changed
   python manage.py migrate          # if migrations changed
   python manage.py collectstatic --noinput  # if static files changed
   ```
4. Restart: `sudo systemctl restart student-management`

Frontend auto-detects environment via hostname (pinto.local uses current origin for API).

**Daily Workspace directory sync (issue #14 phase 3):**
- A systemd service+timer pair (`deploy/sync-workspace-directory.{service,timer}`)
  runs `python manage.py sync_workspace_directory` daily at 05:30, mirroring the
  Google Workspace directory into the global `Student` list (upsert / reactivate
  / archive). Install steps + troubleshooting are in `deploy/README.md`
  (cp units to `/etc/systemd/system/`, `daemon-reload`,
  `systemctl enable --now sync-workspace-directory.timer`; check
  `systemctl list-timers`, `systemctl status`, and
  `journalctl -u sync-workspace-directory.service`).
- Requires the `DIRECTORY_SYNC_USER_EMAIL` env var (see the `.env` section) — the
  named account must have connected Google with the Directory scope
  (`admin.directory.user.readonly`). Run `python manage.py sync_workspace_directory
  --dry-run` first to confirm credentials/scope before enabling the timer.
- The sync NEVER touches `TeacherStudent` rows or `date_of_birth`, and a safety
  valve aborts archiving if the directory fetch returns implausibly few students.

## URL Structure

**Django URLs**:
- `/` - Main SPA
- `/api/` - REST endpoints
- `/admin/` - Django admin
- `/layout-editor/` - Standalone layout editor (opens in same window)
- `/test_optimizer.html` - Seating optimizer test suite
- `/frontend/<path>` - Static files served via Django
- `/api/auth/google/signin/` - Google Sign-In (GET client_id, POST credential → JWTs)
- `/api/auth/google/start/` - Start Google Classroom OAuth flow (session auth; SPA uses oauth-url)
- `/api/auth/google/callback/` - OAuth callback handler (signed state → per-user credentials)
- `/api/google/oauth-url/` - Get Classroom connect URL for current JWT user
- `/api/google/courses/` - List current user's Classroom courses
- `/api/google/courses/{id}/students/` - List a course's roster
- `/api/google/import-students/` - Import a Classroom roster into a class
- `/api/google/directory-cohorts/` - Workspace cohorts (by email prefix)
- `/api/google/directory-students/` - Workspace cohort roster preview
- `/api/google/import-directory-students/` - Bulk-create a cohort's students
- `/api/google/sync-directory/` - "Sync now": run the Workspace directory sync with the requesting user's credentials (POST, JWT, superuser-only)
- `/api/students/bulk-update-info/` - Paste CSV/TSV to set nickname/gender
- `/api/students/school-list/` - School-wide picker feed (cohort filter, on_my_list, last_synced)
- `/api/students/last-synced/` - Cheap GET of max(Student.synced_at)
- `/api/students/add-to-my-list/` - Add students (by ids and/or cohort) to my list
- `/api/students/remove-from-my-list/` - Remove students (by ids and/or cohort) from my list
- `/api/google/test/` - Test Google Classroom connection
- `/api/google/disconnect/` - Remove Google credentials (POST, JWT-authenticated)
- `/api/google/status/` - Cheap Google Classroom connection status (JWT-authenticated)
- `/api/special-points/fetch/` - Proxy: get point totals from Cranston Commons
- `/api/special-points/award/batch/` - Proxy: award/deduct points via Cranston Commons

**Frontend Hash Routes**:
- `#dashboard` - Main view
- `#students` - "My students" list with search + "Add Student" picker + "Add Cohort" modal
- `#students/edit/{id}` - Edit student (edit-only; sync fields read-only)
  (the legacy `#students/new` route is removed and redirects here-to `#students`)
- `#classes` - Class list
- `#classes/view/{id}` - View class details
- `#classes/edit/{id}` - Edit class details (name, subject, grade, description)
- `#classes/{id}/add-students` - Bulk enrollment (with batch mode for ID pasting)
- `#seating` - Seating list
- `#seating/view/{classId}` - View current period (dynamic)
- `#seating/view/{classId}/period/{periodId}` - View specific period
- `#seating/edit/{classId}` - Edit current period
- `#seating/edit/{classId}/period/{periodId}` - Edit specific period
- `#layouts` - Layout management (user's layouts only)
- `#users` - User management (superusers only)
- `#users/edit/{id}` - Edit specific user
- `#profile` - Edit current user's profile
- `#attendance` - Attendance class list with three modes per class
- `#attendance/{classId}` - Take/edit attendance for today (list mode)
- `#attendance/{classId}/{date}` - Take/edit attendance for specific date
- `#attendance/visual/{classId}` - Visual attendance using seating chart
- `#attendance/visual/{classId}/{date}` - Visual attendance for specific date
- `#attendance/report/{classId}` - Attendance analytics and reporting
- `#special-points` - Special points class list with two modes per class
- `#special-points/{classId}` - Award points (list mode)
- `#special-points/visual/{classId}` - Award points (visual seating chart mode)

**Navigation & Routing**:
- Router utility at `frontend/shared/router.js` provides consistent URL generation
- NavigationService at `frontend/shared/navigation.js` offers unified navigation API
- Both hyphenated and snake_case API routes supported for backward compatibility

## Critical Files to Understand

1. `students/models.py` - Model relationships and save() overrides
2. `frontend/shared/core.js` - ApiModule request pattern and JWT auth
3. `frontend/seating/SeatingEditor.js` - Complex state management & highlighting
4. `frontend/seating/SeatingViewer.js` - Read-only viewer with view modes
5. `frontend/seating/viewTransformations.js` - Layout transformations for student view
6. `students/views.py` - ViewSet filtering, permissions, and custom actions
7. `frontend/shared/utils.js` - formatStudentNameTwoLine() for unified name display
8. `frontend/shared/layoutStyles.js` - formatSeatName() for canvas rendering
9. `frontend/seating/PartnershipHistoryModal.js` - Partnership visualization with rating badges
10. `frontend/seating/PartnershipRatingGrid.js` - Teacher rating preferences grid (-2 to +2)
11. `frontend/classes/ClassStudentManager.js` - Bulk enrollment with batch mode (supports student IDs and emails)
12. `frontend/classes/ClassEditor.js` - Edit class details with required field validation
13. `students/serializers.py` - Custom roster filtering and JWT claims
14. `frontend/attendance/AttendanceEditor.js` - List-based attendance taking
15. `frontend/attendance/AttendanceVisual.js` - Visual seating chart attendance
16. `frontend/attendance/AttendanceReport.js` - Attendance analytics dashboard
17. `students/views.py` - AttendanceViewSet with totals and dates endpoints
18. `students/google_classroom_service.py` - OAuth flow and Google Classroom API integration
19. `frontend/special-points/SpecialPointsEditor.js` - List-based point awarding
20. `frontend/special-points/SpecialPointsVisual.js` - Visual seating chart point awarding

## Important Behavioral Notes

### Seating Editor Interactions
- **Single-click** seated student: Show partnership history modal (250ms delay)
- **Double-click** empty seat: Fill with student from pool based on mode
- **Double-click** seated student in Smart Pair mode: Find and place optimal partner
- **Shift+click** any seat: Toggle deactivation (red/blocked)
- **Drag & Drop**: Move students between seats or back to pool
- **Auto button**: Fill all empty seats based on selected mode (disabled in Smart Pair)
- **Optimize button**: Fill all empty seats minimizing repeat partnerships (seated students stay; -2 ratings enforced)
- **Highlight buttons**: Normal/Gender/Previous modes
- **Partnership Ratings button**: Opens grid for teacher preferences
- **Click Timer**: Uses React.useRef for single/double click differentiation
- **Empty roster state**: If the class has zero enrolled students (`students`
  array empty, not just "all seated"), the Student Pool shows an explanatory
  empty state with an "Add Students" button linking to
  `#classes/{classId}/add-students` instead of a silent blank pool

### Seating Viewer Features
- **View Modes**: Teacher View (default), Student View (180° mirror), Print View (placeholder)
- **View Selector**: Button dropdown with consistent 10px spacing
- **Text Rotation**: Counter-rotates in student view to keep readable
- **No Canvas Badge**: Removed view indicator for cleaner UI
- **Toolbar Buttons**: Fixed 100px width for consistency
- **Make Active**: Inactive periods can be reactivated via "Make Active" button

### Ownership & Permissions
- All users (including superusers) only see their own:
  - Classes (filtered by teacher field)
  - Layouts (filtered by created_by field)
  - Seating periods (filtered through class ownership)
- Superusers can manage users but still see only their own teaching data

### UI/UX Standards
- Two-line text format for students: nickname/first name on top, truncated last name below
- Fixed sidebar widths: 250px each in seating editor
- Dynamic grid scaling to fit viewport while maintaining aspect ratio
- Toolbar height: 60px with icon-only buttons (36x36px) in seating views
- Student cards: 65x45px in pool, matching seat dimensions
- Navigation arrows grouped together with vertical divider separating sections
- Attendance class cards display three action buttons: List, Visual, Report
- **Small toolbar buttons**: Use inline styles to avoid CSS conflicts:
  - padding: 6px 12px, fontSize: 14px, fontWeight: 500, borderRadius: 6px
  - Colors: gray (#6b7280), purple (#667eea), green (#10b981), red for danger
  - display: inline-flex with alignItems: center and gap: 6px for icon+text

## Seating Optimizer (issue #7 - implemented)

`frontend/seating/SeatingOptimizer.js` fills the empty active seats of a chart
with pool students so the number of **repeat pairings** (pairs at the same
table who already sat together in a completed tracked period) is minimized.
Wired into SeatingEditor via the **Optimize** button below Auto (one undo
entry via addToHistory; alert shows the repeat count and any conflicts).

**Algorithm**: multi-restart randomized greedy construction + steepest-descent
local search (cross-table swaps/relocations) over table groups; seats are
materialized at the end. Replaced the old simulated-annealing implementation.

**Objective** (lexicographic - earlier tiers strictly dominate):
1. H: count of co-seated repeat pairs (the primary goal)
2. M: prior co-seatings beyond the first (prefer least-repeated when forced)
3. S: soft ratings (-1 discouraged +40, +1 rewarded -25, +2 rewarded -60)
4. B: table-size balance
- `allowBestPairRepeats` config (default false): +2 ratings can never buy a
  repeat pairing; pre-seating the pair is the teacher's override
- H === 0 in the result is a proof of optimality (`stats.provablyOptimal`)

**Hard constraints** (by construction, never penalties):
- Every student in `assignments` when optimize runs is LOCKED (exact seat kept)
- -2 (Never Together) pairs never share a table
- Deactivated seats are never filled
- Infeasibility returns `{ok: false, error, conflicts?/unplaced?}` with names -
  a violating chart or silent student drop is never produced

**API**: `new SeatingOptimizer(config).optimize(assignments, students, layout,
{partnershipHistory, partnershipRatings, deactivatedSeats})` -> editor-shape
assignments + stats. Config: `seed` (reproducible output), `timeBudgetMs`
(default 400), `allowBestPairRepeats`. Runs 10-100ms for typical classes.

### Testing
- `node frontend/seating/SeatingOptimizer.js` - asserting suite (12 tests:
  locked seats, -2 enforcement, deactivated seats, zero-repeat certificate,
  brute-force optimality match, infeasibility reporting, seeded reproducibility)
- Browser: http://127.0.0.1:8000/test_optimizer.html (same suite)
- `SeatingUtils.js` / `SeatingConstants.js` predate the rewrite and are not
  used by the optimizer

## Troubleshooting Guide

### Common Errors & Solutions

**404 Not Found on API calls**:
- Check for double /api/ prefix (ApiModule adds it automatically)
- Verify endpoint path matches Django URL patterns
- Ensure trailing slash is included where needed

**400 Bad Request on POST/PATCH**:
- Check request body format matches serializer expectations
- Verify required fields are included
- Check field names (e.g., class_roster_id vs roster_entry)
- Ensure Content-Type header is set to 'application/json'

**Students showing as "undefined"**:
- Check if using flattened serializer fields (student_first_name not student.first_name)
- Verify roster is loaded and has data
- Check console for data structure

**React warnings about keys**:
- Add unique key prop to all list items
- Keys should be stable (use IDs, not array indices)
- Keys must be unique among siblings

**Unsaved changes lost**:
- Implement beforeunload event listener
- Add confirmation dialogs before navigation
- Track dirty state with hasUnsavedChanges flag

**CSS styles not applying**:
- Check for !important declarations overriding styles
- Use DOM manipulation with setProperty('important') for critical styles
- Clear conflicting styles with removeProperty() when switching modes

**Port 8000 already in use**:
```bash
lsof -ti:8000 | xargs kill -9 2>/dev/null
python manage.py runserver
```

**Virtual environment not found**:
```bash
# Must use 'myenv' not 'venv'
source myenv/bin/activate
# If missing, recreate:
python -m venv myenv
source myenv/bin/activate
pip install -r requirements.txt
```

**Server hanging or multiple instances**:
```bash
# Kill all Django server processes
pkill -f "manage.py runserver"
# Start fresh
source myenv/bin/activate
python manage.py runserver
```

## Google Integration

**Current Status**:
- Google Sign-In on the login page (GIS button; existing users only, matched by email)
- Per-user Classroom OAuth: user id travels in a signed `state` param, credentials
  stored encrypted per user (no more "first user" POC wiring)
- Roster import: "Import from Google Classroom" button in ClassStudentManager
  (connect → pick course → preview roster → import); creates/matches Students
  and enrolls them (see /api/google/import-students/)
- Token refresh handled in `get_google_service()`
- Tests: `python manage.py test students.tests` (mocked Google responses)

**Google Cloud Console requirements**:
- App origins (127.0.0.1:8000, localhost:8000, pinto origin) must be in
  "Authorized JavaScript origins" for the sign-in button
- The callback URL (`<origin>/api/auth/google/callback/`) must be in
  "Authorized redirect URIs" for the Classroom connect flow

**Next Steps**:
1. Implement grade posting functions
2. Frontend UI for disconnecting / viewing connection status (e.g. on #profile)