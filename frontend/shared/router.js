// Frontend Router Utility
// Central routing management for consistent URL generation and navigation

const Router = {
  // Base routes definition - single source of truth
  routes: {
    dashboard: 'dashboard',
    students: 'students',
    studentEdit: 'students/edit/:id',
    studentView: 'students/view/:id',
    classes: 'classes',
    classView: 'classes/view/:id',
    classEdit: 'classes/edit/:id',
    classAddStudents: 'classes/:id/add-students',
    seating: 'seating',
    seatingPeriod: 'seating/period/:id',
    layouts: 'layouts',
    layoutEdit: 'layouts/edit/:id',
  },

  // Generate a route URL with parameters
  generate(routeName, params = {}) {
    const template = this.routes[routeName];
    if (!template) {
      console.warn(`Route '${routeName}' not found`);
      return null;
    }

    let route = template;
    
    // Replace parameters in the template
    Object.keys(params).forEach(key => {
      route = route.replace(`:${key}`, params[key]);
    });

    // Check for any remaining unreplaced parameters
    if (route.includes(':')) {
      console.warn(`Missing parameters for route '${routeName}': ${route}`);
    }

    return route;
  },

  // Parse current hash to identify route and params
  parse(hash = window.location.hash) {
    // Remove # and any query strings
    const cleanHash = hash.replace('#', '').split('?')[0];
    
    // Special case: empty hash means dashboard
    if (!cleanHash) {
      return { route: 'dashboard', params: {} };
    }

    // Try to match against known patterns
    for (const [routeName, pattern] of Object.entries(this.routes)) {
      const regex = this.patternToRegex(pattern);
      const match = cleanHash.match(regex);
      
      if (match) {
        const params = this.extractParams(pattern, cleanHash);
        return { route: routeName, params };
      }
    }

    // Unknown route
    return { route: 'unknown', params: {}, original: cleanHash };
  },

  // Convert route pattern to regex
  patternToRegex(pattern) {
    // Escape special characters and replace :param with capture groups
    const regexPattern = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  // Escape special chars
      .replace(/:(\w+)/g, '([^/]+)');          // Replace :param with capture group
    
    return new RegExp(`^${regexPattern}$`);
  },

  // Extract parameters from a URL based on pattern
  extractParams(pattern, url) {
    const params = {};
    const patternParts = pattern.split('/');
    const urlParts = url.split('/');

    patternParts.forEach((part, index) => {
      if (part.startsWith(':')) {
        const paramName = part.substring(1);
        params[paramName] = urlParts[index];
      }
    });

    return params;
  },

  // Check if a route exists
  exists(routeName) {
    return this.routes.hasOwnProperty(routeName);
  },

  // Get all available routes (for debugging/documentation)
  getAllRoutes() {
    return Object.keys(this.routes);
  },

  // Validate that required params are provided for a route
  validateParams(routeName, params = {}) {
    const template = this.routes[routeName];
    if (!template) return false;

    // Extract required parameters from template
    const requiredParams = [];
    const paramRegex = /:(\w+)/g;
    let match;
    while ((match = paramRegex.exec(template)) !== null) {
      requiredParams.push(match[1]);
    }

    // Check all required params are provided
    for (const param of requiredParams) {
      if (!params[param]) {
        console.warn(`Missing required parameter '${param}' for route '${routeName}'`);
        return false;
      }
    }

    return true;
  },

  // Helper to get current route info
  getCurrentRoute() {
    return this.parse(window.location.hash);
  },

  // Helper to check if currently on a specific route
  isCurrentRoute(routeName) {
    const current = this.getCurrentRoute();
    return current.route === routeName;
  },

  // Build full hash URL
  buildHash(routeName, params = {}) {
    const route = this.generate(routeName, params);
    return route ? `#${route}` : null;
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.Router = Router;
  console.log('Router utility loaded. Test with: Router.generate("classView", {id: 123})');
}