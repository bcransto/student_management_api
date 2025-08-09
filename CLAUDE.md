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

**API Structure:**
- JWT authentication via `/api/token/` endpoints
- RESTful endpoints using Django REST Framework ViewSets
- All API routes defined in `students/urls.py`
- Custom serializers handle complex nested relationships

### Frontend Architecture (Vanilla JavaScript)

**Core Module System:**
- `frontend/shared/core.js` - Central authentication and API module
  - `AuthModule` - Token management, login/logout
  - `ApiModule` - HTTP methods, error handling, token refresh

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

**Frontend Patterns:**
- Event-driven architecture with custom event dispatching
- Canvas-based visual editors for layouts and seating
- Modular JavaScript with IIFE pattern for encapsulation
- API calls use async/await with centralized error handling

## Development Workflow

### Database Management
- SQLite for local development (`db.sqlite3`)
- MySQL/PostgreSQL ready for production
- Migrations track all schema changes
- Custom management commands in `students/management/commands/`

### Authentication Flow
1. Frontend sends credentials to `/api/token/`
2. JWT tokens stored in localStorage
3. Access token included in Authorization header
4. Automatic token refresh on 401 responses

### Visual Editor System
- Both Layout and Seating editors use HTML5 Canvas
- Grid-based positioning system
- Drag-and-drop implemented with mouse event tracking
- State management through JavaScript objects
- Real-time visual feedback during interactions

## Important Considerations

- Frontend uses vanilla JavaScript (no framework dependencies)
- API responses follow Django REST Framework conventions
- Frontend dynamically switches API URL based on environment (localhost vs production)
- Canvas rendering requires browser compatibility with HTML5 Canvas API
- JWT tokens expire and require refresh mechanism
- Seating assignments enforce unique seat constraints per period