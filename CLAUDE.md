# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Student Management API - A Django REST API with vanilla JavaScript frontend for managing students, classes, and classroom seating arrangements.

## Essential Commands

### Backend (Django)
```bash
# Start development server
python manage.py runserver

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run tests
python manage.py test

# Django shell for debugging
python manage.py shell

# Create new migrations after model changes
python manage.py makemigrations
```

### Frontend Linting & Formatting
```bash
# Run all linters
npm run lint

# Lint JavaScript files
npm run lint:js

# Fix JavaScript lint issues
npm run lint:fix

# Format all frontend files
npm run format

# Check formatting without changes
npm run format:check

# Lint HTML files
npm run lint:html
```

## Architecture Overview

### Backend Architecture (Django REST Framework)

**Core Django App Structure:**
- `student_project/` - Main Django project settings and configuration
- `students/` - Primary Django app containing all models, views, and API logic

**Key Models & Relationships:**
1. **User** (Custom AbstractUser) - Teachers who manage classes
2. **Student** - Student records with enrollment tracking
3. **Class** - Courses taught by teachers, linked to classroom layouts
4. **ClassRoster** - Junction table managing student enrollments in classes
5. **ClassroomLayout** - Physical classroom configurations (room dimensions, template layouts)
6. **ClassroomTable** - Individual tables/desks within layouts (position, shape, rotation)
7. **TableSeat** - Specific seats at each table
8. **SeatingPeriod** - Time-bound seating arrangements for classes
9. **SeatingAssignment** - Maps students to specific seats during a period

**Critical Model Relationships:**
- **Class → Layout**: Currently direct link via `layout_id` (planned change: move to SeatingPeriod)
- **SeatingPeriod → Class**: Each period belongs to one class
- **SeatingAssignment → SeatingPeriod → Roster**: Tracks which student sits where

**API Structure:**
- JWT authentication via `/api/token/` and `/api/token/refresh/`
- RESTful endpoints using Django REST Framework ViewSets
- All API routes defined in `students/urls.py`
- Custom serializers handle complex nested relationships
- Permissions: Teachers can only access their own classes

### Frontend Architecture (Vanilla JavaScript + React Components)

**Core Module System:**
- `frontend/shared/core.js` - Central authentication and API module
  - `AuthModule` - Token management, login/logout, localStorage handling
  - `ApiModule` - HTTP methods, error handling, automatic token refresh on 401

**Component Structure:**
- Each page has its own directory with HTML, CSS, and JS files
- Shared components in `frontend/editors/shared/`:
  - `EditorCanvas.js` - Canvas rendering for layout/seating editors
  - `Table.js` - Table object management
  - `constants.js` - Shared configuration values

**Key Frontend Features:**
1. **Dashboard** (`frontend/dashboard/`) - Main navigation hub
2. **Student Management** (`frontend/students/`) - CRUD operations for students
3. **Class Management** (`frontend/classes/`) - Class creation and roster management
4. **Layout Editor** (`frontend/layouts/`) - Visual classroom layout designer
5. **Seating Editor** (`frontend/seating/`) - Drag-and-drop seating chart management
   - `SeatingEditor.js` - Main React component without JSX
   - Uses `formatStudentName()` for 8-character name truncation
   - Tracks unsaved changes with `hasUnsavedChanges` state
   - 2x scaling factor (80px) for canvas and table rendering

**Frontend Patterns:**
- React components written without JSX (using `React.createElement`)
- Event-driven architecture with custom event dispatching
- Canvas-based visual editors with grid positioning (40px → 80px scaling)
- Modular JavaScript with IIFE pattern for encapsulation
- API calls use async/await with centralized error handling
- Dynamic API URL switching based on environment

### Visual Editor System

**Seating Editor Specifics:**
- HTML5 Canvas with 2x scaling (80px multiplier for dimensions)
- Student cards: 65×45px rounded rectangles
- Student pool: 3-column grid, 250px wide
- Name truncation: "FirstName L." format (max 8 chars)
- Drag-and-drop between pool and seats, seat swapping
- Unsaved changes tracking with visual feedback (green Save button)
- Body class `seating-editor-page` for CSS overrides

**Layout Editor:**
- Grid-based positioning system
- Table objects with configurable seats
- Real-time visual feedback during interactions

## Current Work & Known Issues

### Planned Model Change: Layout-SeatingPeriod Relationship
**Problem:** Layouts are currently linked to Classes, not SeatingPeriods
**Solution:** Each SeatingPeriod should have its own layout reference
**Migration Strategy:**
1. Add `layout` field to SeatingPeriod model (nullable)
2. Backfill existing periods with their class's layout
3. Make field required
4. Update frontend to require layout selection
5. Eventually remove `layout_id` from Class model

### Recent UI Updates (Seating Editor)
- Toolbar height: 60px for both primary and secondary
- Save/Reset/Cancel buttons with consistent styling
- Previous/Next navigation buttons (not yet wired)
- Title format: "Class Name: Period Name (Start Date - End Date)"
- Hidden sidebar with full-width container for editor
- 800px fixed height for editor container

## Development Workflow

### Database Management
- SQLite for local development (`db.sqlite3`)
- Migrations track all schema changes
- Custom management commands in `students/management/commands/`

### Authentication Flow
1. Frontend sends credentials to `/api/token/`
2. JWT tokens stored in localStorage
3. Access token included in Authorization header
4. Automatic token refresh on 401 responses
5. Token expiry handling with refresh mechanism

### API Response Format
Standard Django REST Framework conventions:
- Paginated lists: `{count, next, previous, results}`
- Detail views: Direct object representation
- Errors: `{detail: "error message"}` or field-specific errors

## Important Considerations

- Frontend uses vanilla JavaScript with React for complex components (no JSX)
- Canvas rendering requires browser HTML5 Canvas API support
- Seating assignments enforce unique seat constraints per period
- Frontend dynamically switches API URL based on environment
- Git: `node_modules/` excluded from tracking
- CSS uses floating card design with purple gradient background
- Global styles in `frontend/shared/styles.css` can be overridden per component