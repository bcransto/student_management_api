# Student Management System

A full-stack web application for managing students, classes, and classroom seating with an interactive drag-and-drop seating editor.

## Features

- **User Management**: Teacher authentication with JWT tokens (email-based)
- **Student Management**: Full CRUD operations with soft delete
- **Class Management**: Create and manage classes with rosters
- **Interactive Seating Editor**: 
  - Drag-and-drop student placement
  - Historical seating periods with timeline navigation
  - Seat deactivation for broken/unusable seats
  - Smart fill modes (Random, Match Gender, Balance Gender)
  - Auto-fill all empty seats with one click
  - Complete undo/redo system
- **Classroom Layouts**: Create reusable room layouts with tables and obstacles
- **Seating Periods**: Track seating arrangements over time
- **Visual Views**: Multiple display modes (Names, Gender, Groups)
- **Permissions**: Teachers can only access their own classes

## Technology Stack

- **Backend**: Django 5.2.3 + Django REST Framework
- **Frontend**: React 18 (CDN-based, no build process)
- **Authentication**: JWT with email-based login
- **Database**: SQLite (development) / MySQL (production on PythonAnywhere)
- **Routing**: Hash-based SPA routing

## Installation

### Prerequisites
- Python 3.8+
- pip

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/student-management-api.git
   cd student-management-api
   ```

2. **Create virtual environment**
   ```bash
   python -m venv myenv
   source myenv/bin/activate  # On Windows: myenv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   npm install  # For linting and formatting tools
   ```

4. **Run migrations**
   ```bash
   python manage.py migrate
   ```

5. **Create superuser**
   ```bash
   python manage.py createsuperuser
   ```

6. **Start development server**
   ```bash
   python manage.py runserver
   ```

The application will be available at `http://127.0.0.1:8000/`
Admin panel at `http://127.0.0.1:8000/admin/`

## API Endpoints

### Authentication
- `POST /api/token/` - Get access token
- `POST /api/token/refresh/` - Refresh access token

### Users
- `GET /api/users/me/` - Get current user profile
- `GET /api/users/` - List users (superuser only)
- `POST /api/users/` - Create new user

### Students
- `GET /api/students/` - List all students
- `POST /api/students/` - Create new student
- `GET /api/students/{id}/` - Get student details
- `PATCH /api/students/{id}/` - Update student
- `DELETE /api/students/{id}/` - Delete student

### Classes
- `GET /api/classes/` - List teacher's classes
- `POST /api/classes/` - Create new class
- `GET /api/classes/{id}/` - Get class details
- `PATCH /api/classes/{id}/` - Update class
- `DELETE /api/classes/{id}/` - Delete class
- `POST /api/classes/{id}/enroll/` - Enroll student
- `POST /api/classes/{id}/remove_student/` - Remove student

### Class Roster
- `GET /api/roster/` - List roster entries
- `GET /api/roster/{id}/` - Get roster details
- `PATCH /api/roster/{id}/` - Update roster entry

### Seating Management
- `GET /api/classroom-layouts/` - List available layouts
- `POST /api/classroom-layouts/` - Create new layout
- `GET /api/seating-periods/` - List seating periods
- `POST /api/seating-periods/` - Create new period
- `GET /api/seating-assignments/` - List seat assignments
- `POST /api/seating-assignments/` - Assign student to seat

## Sample Usage

### Get Access Token
```bash
curl -X POST http://127.0.0.1:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@example.com",
    "password": "teacher_password"
  }'
```

### List Classes
```bash
curl -X GET http://127.0.0.1:8000/api/classes/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Enroll Student
```bash
curl -X POST http://127.0.0.1:8000/api/classes/1/enroll/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": 1
  }'
```

## Data Models

### Core Models
- **User**: Custom user with email auth and `is_teacher` flag
- **Student**: First/last name, email, gender, soft delete support
- **Class**: Name, subject, grade, linked to teacher and layout
- **ClassRoster**: M2M relationship between students and classes

### Seating Models
- **ClassroomLayout**: Physical room layouts with tables/obstacles
- **SeatingPeriod**: Time-bounded seating arrangements
- **SeatingAssignment**: Maps students to specific seats

## Development

### Running the Application
```bash
# Backend (Django)
source myenv/bin/activate
python manage.py runserver

# Access the app
http://127.0.0.1:8000/
```

### Linting and Formatting
```bash
# Frontend
npm run lint          # ESLint and HTMLHint
npm run format        # Prettier

# Backend
npm run lint:python   # Flake8, Black check, isort check
npm run format:python # Black and isort formatting

# All
npm run lint:all      # Both frontend and backend
```

### Application Routes

**Frontend Routes** (hash-based):
- `#dashboard` - Main dashboard
- `#students` - Student management
- `#students/edit/{id}` - Edit student
- `#classes` - Class list
- `#seating` - Seating management with editor
- `#layouts` - Layout templates

### Admin Interface
Access the Django admin at `http://127.0.0.1:8000/admin/` with your superuser credentials.

## Key Features Details

### Seating Editor
The interactive seating editor provides:
- **Drag & Drop**: Move students between seats with visual feedback
- **Period Management**: Navigate through historical seating arrangements
- **Smart Fill**: Three intelligent modes for automatic placement
- **Seat Management**: Deactivate broken seats with Shift+click
- **Undo System**: Full history tracking with batch operation support

### Fill Modes
1. **Random**: Randomly assigns students to empty seats
2. **Match Gender**: Groups students of the same gender together
3. **Balance Gender**: Maintains even gender distribution

## Deployment

### PythonAnywhere
1. Push code to GitHub
2. SSH to PythonAnywhere console
3. Pull latest changes
4. Run migrations if needed
5. Reload web app from dashboard

The frontend automatically detects the production environment and switches API URLs.

## License

This project is licensed under the MIT License.