# URL Routing Documentation

## Overview
This document describes the URL routing patterns used in the Student Management System application.

## Frontend Routes (Hash-based)

### Core Routes
- `#dashboard` - Main dashboard view
- `#students` - Student list view
- `#students/edit/{id}` - Edit specific student
- `#classes` - Classes list view
- `#classes/view/{id}` - View specific class details
- `#classes/{id}/add-students` - Add students to a class
- `#seating` - Seating chart management
- `#layouts` - Classroom layouts management

### Route Utilities

#### Router (`frontend/shared/router.js`)
Central utility for route generation and parsing:
```javascript
// Generate routes
Router.generate('classView', {id: 123}) // => "classes/view/123"
Router.generate('studentEdit', {id: 456}) // => "students/edit/456"

// Parse current route
Router.getCurrentRoute() // => {route: 'dashboard', params: {}}

// Build hash URLs
Router.buildHash('classView', {id: 10}) // => "#classes/view/10"
```

#### NavigationService (`frontend/shared/navigation.js`)
Wrapper for consistent navigation:
```javascript
// Direct navigation methods
NavigationService.toClasses()
NavigationService.toStudentEdit(5)
NavigationService.toClassView(10)

// Generic navigation
NavigationService.navigate('classView', {id: 123})
```

## Backend API Routes

### Authentication
- `POST /api/token/` - Obtain JWT token
- `POST /api/token/refresh/` - Refresh JWT token

### Resources (REST endpoints)
All resources support standard REST operations (GET, POST, PUT, PATCH, DELETE):

- `/api/users/`
- `/api/students/`
- `/api/classes/`
- `/api/roster/`
- `/api/layouts/`
- `/api/tables/`
- `/api/seats/`
- `/api/obstacles/`

### Seating Resources (both formats supported)
- `/api/seating-periods/` (hyphenated - legacy)
- `/api/seating_periods/` (snake_case - preferred)
- `/api/seating-assignments/` (hyphenated - legacy)
- `/api/seating_assignments/` (snake_case - preferred)

### Special Routes
- `/layout-editor/` - Classroom layout editor interface
- `/admin/` - Django admin interface

## Migration Strategy

### Current Implementation
The routing system has been refactored to provide:
1. **Centralized route definitions** - Single source of truth in Router utility
2. **Consistent navigation API** - NavigationService provides unified interface
3. **Backward compatibility** - All existing routes continue to work
4. **Gradual migration** - Modules updated incrementally

### Module Status
- ✅ **Dashboard** - Uses NavigationService with fallback
- ✅ **Students** - Uses NavigationService with fallback
- ✅ **Classes** - Uses NavigationService with fallback
- ✅ **Seating** - NavigationService ready
- ✅ **Layouts** - NavigationService ready

### Usage in Components

#### New Pattern (Recommended)
```javascript
const MyComponent = ({ data, navigateTo }) => {
  // Use NavigationService if available
  const nav = window.NavigationService || null;
  
  const handleNavigation = () => {
    // Use NavigationService preferentially
    if (nav?.toClassView) {
      nav.toClassView(classId);
    } else {
      // Fallback to prop function
      navigateTo(`classes/view/${classId}`);
    }
  };
};
```

#### Legacy Pattern (Still Supported)
```javascript
// Direct hash manipulation
window.location.hash = `#classes/view/${classId}`;

// Using navigateTo prop
navigateTo("classes", { action: "view", classId: id });
```

## Best Practices

1. **Use Router for URL generation** - Ensures consistent URL format
2. **Use NavigationService for navigation** - Provides logging and validation
3. **Always provide fallbacks** - Maintain backward compatibility
4. **Test navigation thoroughly** - Check browser back/forward behavior
5. **Update incrementally** - Don't break existing functionality

## Future Improvements

Potential enhancements to consider:
- Add route guards for authentication
- Implement breadcrumb navigation
- Add route transition animations
- Support for query parameters
- Route-based code splitting
- Analytics integration

## Testing Routes

### Browser Console Tests
```javascript
// Test Router
Router.getAllRoutes()
Router.generate('classView', {id: 1})
Router.getCurrentRoute()

// Test NavigationService
NavigationService.toStudents()
NavigationService.getCurrentRoute()
NavigationService.isCurrentRoute('dashboard')
```

### Manual Testing Checklist
- [ ] Navigate to all main sections via sidebar
- [ ] Click on items to view details
- [ ] Use browser back/forward buttons
- [ ] Refresh page on different routes
- [ ] Test deep links (direct URL access)
- [ ] Verify fallback navigation works