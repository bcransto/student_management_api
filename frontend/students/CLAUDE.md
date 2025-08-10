# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Directory Overview
This directory contains the Students component for the Student Management System frontend. It's a pure React component (without JSX) that displays student information in a tabular format.

## Essential Commands

### Development
```bash
# From the project root, run the development server
cd ../..
source myenv/bin/activate
python manage.py runserver

# Linting this directory
cd ../..
npm run lint:js -- frontend/students/students.js
npm run format -- frontend/students/
```

## Architecture

### Component Structure

**Students Component** (`students.js`):
- Receives `data`, `navigateTo`, and `apiModule` props from parent
- Displays student information in a responsive table format
- Handles row clicks to open the editor modal
- Manages selected student state and refresh logic
- Uses React.createElement() exclusively (no JSX)
- Exports itself as `window.StudentsComponent` for global access

**StudentEditor Component** (`StudentEditor.js`):
- Modal-based editor for individual student records
- Fetches complete student data including enrolled classes
- Handles form validation and error display
- Supports soft delete with confirmation dialog
- Manages local form state before saving
- Exports itself as `window.StudentEditor` for global access

### Data Flow
```javascript
// Expected data structure
data = {
  students: [
    {
      id: number,
      student_id: string,
      first_name: string,
      last_name: string,
      email: string,
      is_active: boolean,
      enrollment_date: string,
      active_classes: array
    }
  ]
}
```

### Styling
- `students.css`: Contains component-specific styles
- Uses CSS classes following BEM-like naming conventions
- Responsive design with media queries for mobile views
- Badge system for status indicators

## Key Features

### Current Implementation
1. **Student Table Display**: Shows ID, name, email, status, enrollment date, and class count
2. **Status Badges**: Visual indicators for active/inactive students
3. **Loading State**: Spinner display while data is fetching
4. **Responsive Design**: Mobile-friendly table layout
5. **Student Editor Modal**: Click any row to edit student details
6. **Soft Delete**: Mark students as inactive with confirmation dialog
7. **Form Validation**: Email format and required field validation
8. **Enrolled Classes Display**: Shows classes the student is enrolled in

### Integration Points
- Component is loaded by the parent application (likely from `frontend.html` or main app)
- Relies on global React object (loaded from CDN or bundled)
- Uses shared table and badge styles from parent CSS

## Data Type Considerations
1. **Student IDs**: Displayed as strings but may be numbers from API
2. **Dates**: Enrollment dates come as ISO strings, formatted for display
3. **Optional Fields**: Email may be null/undefined (displays "N/A")
4. **Active Classes**: Array that may be undefined (defaults to 0)

## Common Tasks

### Adding New Table Columns
1. Add new `th` element in the table header
2. Add corresponding `td` element in the map function
3. Update CSS if special styling needed

### Modifying Status Display
1. Update badge logic in the status `td` element
2. Adjust badge classes in CSS for different states

### Adding Interactivity
1. Add click handlers using onClick attributes
2. Use the `navigateTo` prop for navigation
3. Maintain pure functional component pattern

## Development Guidelines
- Maintain React.createElement() pattern (no JSX)
- Keep component pure and functional
- Use descriptive CSS class names
- Ensure responsive design works on mobile
- Handle null/undefined data gracefully

## Testing Approach
- Manual testing through browser
- Check console for React errors
- Verify table renders with various data states
- Test responsive layout at different screen sizes

## Future Enhancements Considerations
- Student detail view navigation
- Inline editing capabilities
- Sorting and filtering options
- Pagination for large student lists
- Export functionality