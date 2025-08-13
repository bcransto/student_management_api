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
   - Gender highlighting requires DOM manipulation with setProperty('important')
   - Left sidebar (125px) contains controls
   - Autofill preserves existing seat assignments
   - Search includes nickname field
   - **Fill System**: Three modes (Random, Match Gender, Balance Gender)
     - Click-to-fill: Click empty seats to auto-assign students
     - Auto button: Fill all empty seats at once
     - Batch operations create single undo entry
   - **Undo System**: Full history tracking with 50-level limit
   - **Seat Deactivation**: Shift+click to block seats (red, stored in Set)
   - **Period Navigation**: View-only - does NOT modify database end_dates

2. **Students Components**
   - `formatStudentNameTwoLine()` returns { line1: nickname, line2: "Smi." } for consistent two-line display
   - `formatStudentName()` deprecated - use formatStudentNameTwoLine for new features
   - Search filters by nickname, first_name, last_name, student_id, email
   - StudentEditor includes nickname and gender fields
   - All name displays (pool, seats, viewer) use two-line format: nickname on line 1, last name truncated to 3 chars on line 2

3. **Layout System**
   - ClassroomLayout filtered by `created_by` user
   - Layouts can be templates (`is_template` flag)
   - Tables contain seats with relative positioning

4. **Classes Components**
   - ClassView shows individual class with roster management
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

### History & Undo System

**Implementation Pattern**:
```javascript
// All assignment changes must use addToHistory()
const addToHistory = (newAssignments, description) => {
  const entry = {
    assignments: JSON.parse(JSON.stringify(assignments)), // Deep copy before
    newAssignments: JSON.parse(JSON.stringify(newAssignments)), // Deep copy after
    description: description,  // e.g., "Place John Doe", "Auto-fill 12 seats (random)"
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

**Gender Highlighting CSS Specificity**:
```javascript
// Inline styles won't work due to !important rules
// Must use DOM manipulation:
element.style.setProperty('background-color', '#10b981', 'important');
```

**SeatingPeriod Current State**:
- Current period identified by `end_date=None` (no is_active field)
- Creating new period auto-ends previous (sets end_date to today)
- Only one period per class can have `end_date=None`
- Model's save() method enforces single current period
- **CRITICAL**: Period navigation (Previous/Next buttons) must NEVER modify end_dates
- Navigation is view-only - historical periods never become active again
- Only "New Period" button should modify database state

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

# Frontend testing
open test_nickname_frontend.html      # Interactive browser tests
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

See `ROUTING.md` for comprehensive routing documentation.

**Key Routes**:
- Frontend uses hash-based routing (e.g., `#dashboard`, `#classes/view/123`)
- Backend API at `/api/` with REST endpoints
- Router utility at `frontend/shared/router.js` provides consistent URL generation
- NavigationService at `frontend/shared/navigation.js` offers unified navigation API
- Both hyphenated and snake_case API routes supported for seating endpoints

## Critical Files to Understand

1. `students/models.py` - Model relationships and save() overrides
2. `frontend/shared/core.js` - ApiModule request pattern and JWT auth
3. `frontend/seating/SeatingEditor.js` - Complex state management
4. `students/views.py` - ViewSet filtering and permissions
5. `frontend/shared/utils.js` - formatStudentNameTwoLine() for unified name display
6. `frontend/shared/layoutStyles.js` - formatSeatName() for canvas rendering
7. `frontend/classes/ClassStudentManager.js` - Bulk enrollment interface
8. `students/serializers.py` - Custom roster filtering and JWT claims