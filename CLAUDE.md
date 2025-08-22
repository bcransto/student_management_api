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
python manage.py test                    # All tests
python manage.py test students.tests    # Specific app
python test_nickname_functionality.py   # Standalone test file
python test_seating_api.py             # Test seating APIs
python test_save.py                    # Test save functionality
python test_chart_naming.py            # Test chart auto-naming

# Linting and formatting
npm run lint:all          # Frontend + backend linting
npm run lint:python       # Backend only (flake8, pylint)
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
- **Database**: SQLite local, MySQL on PythonAnywhere
- **Auth**: JWT with email-based login (uses email field, not username)
- **Settings Module**: `student_project.settings`

### Critical Model Relationships

```python
# Seating hierarchy
Class → classroom_layout (FK to ClassroomLayout)
SeatingPeriod → layout (FK to ClassroomLayout, PROTECT on delete)
SeatingPeriod → class_assigned (FK to Class)
SeatingAssignment → seating_period (FK to SeatingPeriod)
SeatingAssignment → roster_entry (FK to ClassRoster, not Student!)

# Student fields
Student.nickname  # Defaults to first_name if empty/whitespace
Student.gender    # 'male', 'female', 'other' (lowercase in DB)

# Partnership tracking
PartnershipRating → class_assigned, student1, student2
# Auto-orders: student1 always has lower ID than student2

# Class fields (required)
Class.name        # CharField, required
Class.subject     # CharField, required
Class.teacher     # ForeignKey to User, required
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
   - StudentEditor includes nickname and gender fields
   - All name displays (pool, seats, viewer) use two-line format: nickname on line 1, last name truncated to 3 chars on line 2

4. **Layout System**
   - ClassroomLayout filtered by `created_by` user
   - Layouts can be templates (`is_template` flag)
   - Tables contain seats with relative positioning
   - Layout editor at `/layout-editor/` (standalone page)
   - Opens in same window when clicking layout cards
   - Soft delete for layouts (is_active field)

5. **Classes Components**
   - ClassView shows individual class with roster management
   - ClassEditor: Edit name, subject (required), grade_level, description
   - Soft delete for roster entries (is_active field) preserves history
   - ClassStudentManager handles bulk enrollment with search/filter
   - Re-enrollment capability for previously enrolled students
   - Permission-based UI - only class teacher sees management controls

### API Patterns

**ApiModule.request() - MUST use options object**:
```javascript
// CORRECT
await ApiModule.request('/api/endpoint/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

// WRONG - DO NOT use separate parameters
await ApiModule.request(url, method, body)  // ❌
```

**Critical Serializer Behaviors**:
- SeatingAssignment expects `roster_entry` ID, not `student` ID
- Student.nickname defaults to first_name when empty
- API responses may be paginated: check for `results` key
- ClassRoomLayout ViewSet filters by `created_by` user (except superusers)
- ClassSerializer.roster only returns active entries (is_active=True)
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
- Current period identified by `end_date=None` (no is_active field)
- Creating new period auto-ends previous (sets end_date to today)
- Only one period per class can have `end_date=None`
- Model's save() method enforces single current period
- **CRITICAL**: Period navigation (Previous/Next buttons) must NEVER modify end_dates
- Navigation is view-only - historical periods never become active again
- Only "New Period" button should modify database state
- Auto-naming: New periods are named "Chart N" where N increments

**Nickname Handling**:
- Model auto-sets to first_name if empty/whitespace
- Frontend `formatStudentName()` prefers nickname
- Search includes nickname in all filtering

**ClassRoster Soft Delete**:
- Unenroll sets is_active=False (soft delete)
- Preserves attendance_notes, enrollment history, seating assignments
- Re-enrollment reactivates existing roster entry
- current_enrollment property filters by is_active=True

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
```

## Deployment to PythonAnywhere

1. Push to GitHub main branch
2. SSH to PythonAnywhere console
3. Navigate to `/home/bcranston/student_management_api/`
4. Pull latest: `git pull origin main`
5. Run migrations if needed: `python manage.py migrate`
6. Reload web app from dashboard

Frontend auto-detects production environment via hostname.

## URL Structure

**Django URLs**:
- `/` - Main SPA
- `/api/` - REST endpoints
- `/admin/` - Django admin
- `/layout-editor/` - Standalone layout editor (opens in same window)
- `/test_optimizer.html` - Seating optimizer test suite
- `/frontend/<path>` - Static files served via Django

**Frontend Hash Routes**:
- `#dashboard` - Main view
- `#students` - Student list with search
- `#students/edit/{id}` - Edit student
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
11. `frontend/classes/ClassStudentManager.js` - Bulk enrollment with batch ID pasting mode
12. `frontend/classes/ClassEditor.js` - Edit class details with required field validation
13. `students/serializers.py` - Custom roster filtering and JWT claims

## Important Behavioral Notes

### Seating Editor Interactions
- **Single-click** seated student: Show partnership history modal (250ms delay)
- **Double-click** empty seat: Fill with student from pool based on mode
- **Double-click** seated student in Smart Pair mode: Find and place optimal partner
- **Shift+click** any seat: Toggle deactivation (red/blocked)
- **Drag & Drop**: Move students between seats or back to pool
- **Auto button**: Fill all empty seats based on selected mode (disabled in Smart Pair)
- **Highlight buttons**: Normal/Gender/Previous modes
- **Partnership Ratings button**: Opens grid for teacher preferences
- **Click Timer**: Uses React.useRef for single/double click differentiation

### Seating Viewer Features
- **View Modes**: Teacher View (default), Student View (180° mirror), Print View (placeholder)
- **View Selector**: Button dropdown with consistent 10px spacing
- **Text Rotation**: Counter-rotates in student view to keep readable
- **No Canvas Badge**: Removed view indicator for cleaner UI
- **Toolbar Buttons**: Fixed 100px width for consistency

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
- Toolbar height: 60px with two-line title display
- Student cards: 65x45px in pool, matching seat dimensions
- Toolbar button width: 100px with 10px spacing between buttons

## Seating Optimizer (Phase 1 Complete - Paused)

**Status**: Phase 1 implementation complete with performance optimizations. Ready for Phase 2 integration.

### Completed Work (Phase 1)

**Core Implementation**:
- Created three new files without modifying existing code:
  1. `SeatingOptimizer.js` - Full SimulatedAnnealingOptimizer implementation
  2. `SeatingUtils.js` - Utility functions for partnership management  
  3. `SeatingConstants.js` - Constants, presets, and configuration
- Integrated into index.html with proper script loading order
- Added test page at `/test_optimizer.html` with comprehensive test suite
- Added URL routing in `student_project/urls.py`

**Key Features Implemented**:
- Simulated Annealing algorithm with temperature-based acceptance (Metropolis criterion)
- Multi-strategy neighbor generation (50% swap, 30% relocation, 20% three-cycle)
- Hard constraint enforcement (locked seats, do-not-pair from -2 ratings)
- Soft preference optimization (ratings, partnership history)
- Data structure conversion between UI format and internal array format
- Wrapper class for backward compatibility

**Performance Optimizations Applied**:
- Default maxIterations: 500 (reduced from initial 10,000)
- Neighbor generation attempts: 5 (reduced from 100)
- Test-specific iterations: Test 1 (200), Test 2 (20), Test 3 (200), Test 4 (50), Test 5 (200)
- Logging frequency: Every 100 iterations
- All tests complete in under 2 seconds

### Next Steps (Phase 2 - Not Started)

**Phase 2: Integration with SeatingEditor**
1. Add "Optimize" button to SeatingEditor toolbar
2. Hook up optimizer to use current assignments, constraints, and history
3. Add progress indicator during optimization
4. Implement undo for optimization changes
5. Add constraint configuration UI (lock seats, set do-not-pair)

**Phase 3: Advanced Features** (Future)
- Real-time preview of changes
- Partial optimization (selected tables only)
- Custom weight configuration
- Save/load optimization presets
- Optimization history and comparison

### Testing
Access test suite at: http://127.0.0.1:8000/test_optimizer.html
- All tests validate core functionality
- Tests run quickly with minimal iterations
- Individual test buttons available for debugging