// Navigation Service
// Wrapper around navigation functionality for consistent behavior

const NavigationService = {
  // Store reference to the app's navigation function
  _navigateToFn: null,
  _debug: true,  // Enable logging for testing

  // Initialize with the app's navigateTo function
  init(navigateToFn) {
    this._navigateToFn = navigateToFn;
    if (this._debug) {
      console.log('NavigationService initialized');
    }
  },

  // Main navigation method - uses Router utility
  navigate(routeName, params = {}, options = {}) {
    // Validate route exists
    if (!window.Router || !window.Router.exists(routeName)) {
      console.error(`Invalid route: ${routeName}`);
      return false;
    }

    // Validate parameters
    if (!window.Router.validateParams(routeName, params)) {
      console.error(`Invalid parameters for route ${routeName}:`, params);
      return false;
    }

    // Generate the route
    const route = window.Router.generate(routeName, params);
    
    if (this._debug) {
      console.log(`Navigating to: ${routeName}`, { route, params, options });
    }

    // Use the app's navigation function if available
    if (this._navigateToFn) {
      // Handle special cases for backward compatibility
      if (routeName === 'studentEdit' && params.id) {
        this._navigateToFn('student-edit', { studentId: params.id });
      } else if (routeName === 'classView' && params.id) {
        this._navigateToFn(`classes/view/${params.id}`);
      } else if (routeName === 'classAddStudents' && params.id) {
        this._navigateToFn(`classes/${params.id}/add-students`);
      } else {
        // Standard navigation
        this._navigateToFn(route, params);
      }
    } else {
      // Fallback to direct hash manipulation
      window.location.hash = route;
    }

    // Handle additional options
    if (options.reload) {
      window.location.reload();
    }

    return true;
  },

  // Convenience methods for common navigations
  toDashboard() {
    return this.navigate('dashboard');
  },

  toStudents() {
    return this.navigate('students');
  },

  toStudentEdit(studentId) {
    return this.navigate('studentEdit', { id: studentId });
  },

  toStudentView(studentId) {
    return this.navigate('studentView', { id: studentId });
  },

  toClasses() {
    return this.navigate('classes');
  },

  toClassView(classId) {
    return this.navigate('classView', { id: classId });
  },

  toClassEdit(classId) {
    return this.navigate('classEdit', { id: classId });
  },

  toClassAddStudents(classId) {
    return this.navigate('classAddStudents', { id: classId });
  },

  toSeating() {
    return this.navigate('seating');
  },

  toSeatingView(classId) {
    return this.navigate('seatingView', { classId });
  },

  toSeatingViewPeriod(classId, periodId) {
    return this.navigate('seatingViewPeriod', { classId, periodId });
  },

  toSeatingEdit(classId) {
    return this.navigate('seatingEdit', { classId });
  },

  toSeatingEditPeriod(classId, periodId) {
    return this.navigate('seatingEditPeriod', { classId, periodId });
  },

  toLayouts() {
    return this.navigate('layouts');
  },

  toLayoutEdit(layoutId) {
    return this.navigate('layoutEdit', { id: layoutId });
  },

  // Navigate back
  back() {
    window.history.back();
  },

  // Navigate forward
  forward() {
    window.history.forward();
  },

  // Replace current history entry
  replace(routeName, params = {}) {
    const route = window.Router.generate(routeName, params);
    if (route) {
      window.location.replace(`#${route}`);
      return true;
    }
    return false;
  },

  // Get current route information
  getCurrentRoute() {
    return window.Router ? window.Router.getCurrentRoute() : null;
  },

  // Check if currently on a specific route
  isCurrentRoute(routeName) {
    return window.Router ? window.Router.isCurrentRoute(routeName) : false;
  },

  // Enable/disable debug logging
  setDebug(enabled) {
    this._debug = enabled;
  },

  // Helper for external links
  openExternal(url, target = '_blank') {
    window.open(url, target);
  },

  // Helper for the layout editor (special case)
  toLayoutEditor() {
    window.open('/layout-editor/', '_blank');
  }
};

// Create a simpler API for backward compatibility
const Navigation = {
  go: (routeName, params) => NavigationService.navigate(routeName, params),
  back: () => NavigationService.back(),
  forward: () => NavigationService.forward(),
  init: (fn) => NavigationService.init(fn)
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.NavigationService = NavigationService;
  window.Navigation = Navigation;
  console.log('NavigationService loaded. Test with: NavigationService.toClassView(123)');
}