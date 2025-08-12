# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Backend (Django)
```bash
# Activate virtual environment (always do this first)
source myenv/bin/activate  # Note: NOT 'venv', but 'myenv'

# Run development server
python manage.py runserver

# Kill existing server if port in use
lsof -ti:8000 | xargs kill -9 2>/dev/null

# Database migrations
python manage.py makemigrations
python manage.py migrate

# Django shell for debugging
python manage.py shell

# Create superuser for admin access
python manage.py createsuperuser

# Run backend linting and formatting
npm run lint:python         # Run all backend linters
npm run format:python       # Format Python code with Black/isort
```

### Frontend
The frontend is pure React without build tools. Files are served directly through Django.
```bash
# No build process needed - just edit files and refresh browser
# Access the app at http://127.0.0.1:8000/
# Admin panel at http://127.0.0.1:8000/admin/

# Frontend linting and formatting
npm run lint               # Run ESLint and HTMLHint
npm run lint:fix          # Auto-fix linting issues
npm run format            # Format with Prettier
npm run format:check      # Check formatting without changes
```

### Full Project Linting
```bash
npm run lint:all          # Run both frontend and backend linters
```

## Architecture Overview

### Tech Stack
- **Backend**: Django 5.2.3 with Django REST Framework
- **Frontend**: React 18 (CDN, no JSX, uses React.createElement)
- **Database**: SQLite (local), MySQL (production on PythonAnywhere)
- **Auth**: JWT with email-based login (not username)
- **Routing**: Hash-based SPA routing (#dashboard, #students, etc.)

### Backend Structure

**Core Models** (`students/models.py`):
- `User`: Custom user with email auth and `is_teacher` flag
- `Class`: Classes taught by teachers with `classroom_layout` FK
- `Student`: Student records with soft delete (`is_active`)
- `ClassRoster`: M2M relationship between students and classes
- `ClassroomLayout`: Physical room layouts (can be templates)
- `SeatingPeriod`: Time-bounded seating with its own layout FK
- `SeatingAssignment`: Maps roster entries to specific seats

**Critical Model Relationships**:
```python
Class → classroom_layout (FK to ClassroomLayout)
SeatingPeriod → layout (FK to ClassroomLayout, PROTECT on delete)
SeatingPeriod → class_assigned (FK to Class)
SeatingAssignment → seating_period (FK to SeatingPeriod)
SeatingAssignment → roster_entry (FK to ClassRoster)
```

**SeatingPeriod Behavior**:
- Only one active period per class (enforced in `save()` method)
- Deactivating other periods does NOT modify their `end_date`
- New periods should copy layout from previous period or class

### Frontend Architecture

**Single Page Application Structure**:
- `index.html`: Main entry point with all script/style imports
- `frontend/app.js`: Main app controller with hash routing
- `frontend/shared/core.js`: AuthModule and ApiModule for API communication
- `frontend/shared/utils.js`: Shared utilities (formatStudentName, formatDate)
- Components use pure React.createElement (no JSX, no build process)
- All React components loaded via CDN

**Key Components**:

1. **SeatingEditor.js** (Complex drag-and-drop editor):
   - State: `assignments = {tableId: {seatNumber: studentId}}`
   - Seat IDs format: "tableNumber-seatNumber" (e.g., "1-2")
   - Name truncation: "FirstName L." (max 8 chars + initial)
   - Special handling for same-table swaps vs cross-table
   - Period navigation with Previous/Next buttons
   - New Period button creates fresh period with empty seats

2. **SeatingViewer.js** (Read-only viewer):
   - Uses standard app CSS (not custom editor styles)
   - Toggle between view/edit modes
   - Shares canvas rendering with editor
   - No drag-drop or pool functionality

3. **StudentEditor.js** (Full student CRUD):
   - Route: `#students/edit/{studentId}`
   - Form validation for required fields
   - Soft delete sets `is_active = false`
   - Shows enrolled classes with details

4. **Layout Editor** (`frontend/layouts/editor/`):
   - Modular React-based layout designer
   - Drag-and-drop table/obstacle placement
   - Real-time seat management
   - Served at `/frontend/layouts/editor/`

### API Patterns

**ApiModule.request() Usage**:
```javascript
// Correct format - options object as second parameter
await ApiModule.request('/endpoint/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

// NOT separate parameters like: request(url, method, body)
```

**Query Parameter Filtering**:
- SeatingPeriodViewSet: `?class_assigned={classId}`
- SeatingAssignmentViewSet: `?seating_period={periodId}`
- Both viewsets filter by teacher ownership automatically

**Serializer Fields**:
- SeatingPeriod includes: `class_assigned` (was missing, now added)
- ClassRoster includes: `class_assigned_details` with nested info
- SeatingAssignment expects: `roster_entry` ID, not student ID
- SeatingAssignmentSerializer has custom `create()` method for proper validation

### Data Type Consistency Issues

**Always Handle as Strings**:
- Seat numbers (even if API returns numbers)
- Table IDs when used as object keys
- Student IDs in assignment maps

**Format Examples**:
```javascript
// Correct assignment structure
assignments = {
  "106": {  // tableId as string key
    "1": 5,   // seatNumber as string key, studentId as number
    "2": 8
  }
}

// Seat ID format
seat_id = "1-2"  // "tableNumber-seatNumber"
```

### Common Pitfalls and Solutions

1. **Save Function Deleting Wrong Periods**:
   - Issue: SeatingAssignmentViewSet wasn't filtering by period
   - Fix: Added `filterset_fields` and query param filtering

2. **Period Navigation Clearing Assignments**:
   - Issue: Setting `is_active` triggers model save() side effects
   - Solution: Only update `is_active`, never touch `end_date`

3. **Layout Not Loading**:
   - Always check `period.layout_details` first
   - Fallback to `class.classroom_layout`
   - Never assume layout exists

4. **Drag & Drop Same Table**:
   - Don't delete/recreate table object for same-table swaps
   - Swap values directly in the assignments object

5. **Virtual Environment**:
   - MUST use `myenv/` not `venv/`
   - Activate before any Python commands

6. **CORS in Development**:
   - Check `CORS_ALLOWED_ORIGINS` includes localhost
   - Frontend auto-handles token refresh on 401

7. **Token Storage**:
   - Main app stores as `token` in localStorage
   - Layout editor looks for both `token` and `access_token`
   - JWT auth uses `email` field, not `username`

8. **SeatingAssignment Creation**:
   - Model's `clean()` method handles both object and ID references
   - Serializer has custom `create()` to ensure validation
   - Always include Content-Type header in POST requests

### Deployment to PythonAnywhere

1. Push code to GitHub
2. SSH to PythonAnywhere console
3. Pull latest changes in `/home/bcranston/student_management_api/`
4. Run migrations if model changes
5. Reload web app from PythonAnywhere dashboard
6. Frontend URLs auto-switch based on hostname detection

### Testing Approach

No automated tests currently. Manual testing via:
- Django admin panel for data verification
- Browser console for frontend debugging
- Django shell for backend queries
- Test scripts: `test_seating_api.py`, `test_periods.py`, `test_save.py`

### URL Routing

**Django URL Patterns**:
- `/` - Main SPA (index.html)
- `/api/` - REST API endpoints
- `/admin/` - Django admin panel
- `/frontend/<path>` - Static frontend files
- `/frontend/layouts/editor/` - Layout editor app

**Frontend Hash Routes**:
- `#dashboard` - Main dashboard
- `#students` - Student list
- `#students/edit/{id}` - Edit student
- `#classes` - Class list
- `#seating` - Seating management
- `#layouts` - Layout management

### File Serving Strategy

Frontend files are served through Django's `serve_frontend_file` function in `urls.py`, which:
- Reads files from `frontend/` directory
- Sets appropriate content-type headers
- Handles production URL replacements
- No webpack/build process needed