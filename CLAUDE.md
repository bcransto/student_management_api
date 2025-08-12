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

# Run tests
python manage.py test                    # All tests
python manage.py test students.tests    # Specific app
python test_nickname_functionality.py   # Standalone test file

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

1. **SeatingEditor.js**
   - Assignments state: `{tableId: {seatNumber: studentId}}` with string keys
   - Seat ID format: "tableNumber-seatNumber" (e.g., "1-2")
   - Gender highlighting requires DOM manipulation with setProperty('important')
   - Left sidebar (125px) contains controls
   - Autofill preserves existing seat assignments
   - Search includes nickname field

2. **Students Components**
   - `formatStudentName()` utility prefers nickname over first_name
   - Search filters by nickname, first_name, last_name, student_id, email
   - StudentEditor includes nickname and gender fields

3. **Layout System**
   - ClassroomLayout filtered by `created_by` user
   - Layouts can be templates (`is_template` flag)
   - Tables contain seats with relative positioning

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

**SeatingPeriod Active State**:
- Setting `is_active=True` deactivates others automatically
- Never modify `end_date` when deactivating
- Only one active period per class

**Nickname Handling**:
- Model auto-sets to first_name if empty/whitespace
- Frontend `formatStudentName()` prefers nickname
- Search includes nickname in all filtering

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

**Django URLs**:
- `/` - Main SPA
- `/api/` - REST endpoints
- `/admin/` - Django admin
- `/frontend/<path>` - Static files served via Django

**Frontend Hash Routes**:
- `#dashboard` - Main view
- `#students` - Student list with search
- `#students/edit/{id}` - Edit student
- `#seating` - Seating editor
- `#layouts` - Layout management (user's layouts only)

## Critical Files to Understand

1. `students/models.py` - Model relationships and save() overrides
2. `frontend/shared/core.js` - ApiModule request pattern
3. `frontend/seating/SeatingEditor.js` - Complex state management
4. `students/views.py` - ViewSet filtering and permissions
5. `frontend/shared/utils.js` - formatStudentName nickname logic