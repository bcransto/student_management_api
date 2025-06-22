# Student Management API

A Django REST API for managing students, classes, and classroom rosters with group and seating assignments.

## Features

- **User Management**: Teacher authentication with JWT tokens
- **Student Management**: CRUD operations for student records
- **Class Management**: Create and manage classes with full details
- **Roster Management**: Enroll students, assign groups and seats
- **Group Management**: Organize students into groups with roles
- **Seating Charts**: Visual representation of classroom seating
- **Search & Filtering**: Find students and classes quickly
- **Permissions**: Teachers can only access their own classes

## Technology Stack

- **Backend**: Django 4.x + Django REST Framework
- **Authentication**: JWT (JSON Web Tokens)
- **Database**: SQLite (development) / PostgreSQL (production ready)
- **API Documentation**: Django REST Framework browsable API

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
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
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

The API will be available at `http://127.0.0.1:8000/api/`

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
- `GET /api/classes/{id}/groups/` - Get class groups
- `GET /api/classes/{id}/seating_chart/` - Get seating chart
- `POST /api/classes/{id}/enroll/` - Enroll student
- `POST /api/classes/{id}/remove_student/` - Remove student

### Class Roster
- `GET /api/roster/` - List roster entries
- `GET /api/roster/{id}/` - Get roster details
- `PATCH /api/roster/{id}/` - Update roster entry
- `POST /api/roster/{id}/assign_group/` - Assign to group
- `POST /api/roster/{id}/assign_seat/` - Assign seat

## Sample Usage

### Get Access Token
```bash
curl -X POST http://127.0.0.1:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "teacher_username",
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
    "student_id": "1001"
  }'
```

## Data Models

### Student
- Student ID, Name, Email
- Enrollment date, Active status
- Notes field for additional information

### Class
- Name, Subject, Description
- Grade level, Teacher assignment
- Creation and modification timestamps

### ClassRoster
- Links students to classes
- Group assignments with roles
- Seat assignments
- Enrollment tracking

## Development

### Running Tests
```bash
python manage.py test
```

### Creating Sample Data
Use the Django shell to create sample data:
```bash
python manage.py shell
# Run the sample data creation scripts
```

### Admin Interface
Access the Django admin at `http://127.0.0.1:8000/admin/` with your superuser credentials.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

Your Name - your.email@example.com
Project Link: [https://github.com/YOUR_USERNAME/student-management-api](https://github.com/YOUR_USERNAME/student-management-api)