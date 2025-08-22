// viewTransformations.js - Utility functions for transforming seating layout views

// Transform a table's position and rotation for student view
const transformTableForStudentView = (table, roomWidth, roomHeight) => {
  // Create a new table object to avoid mutating the original
  const transformed = { ...table };
  
  // Mirror the position (flip both x and y)
  // Account for table dimensions when flipping
  transformed.x_position = roomWidth - table.x_position - table.width;
  transformed.y_position = roomHeight - table.y_position - table.height;
  
  // Rotate 180 degrees
  transformed.rotation = (table.rotation + 180) % 360;
  
  return transformed;
};

// Transform an obstacle's position and rotation for student view
const transformObstacleForStudentView = (obstacle, roomWidth, roomHeight) => {
  // Create a new obstacle object to avoid mutating the original
  const transformed = { ...obstacle };
  
  // Mirror the position (flip both x and y)
  // Account for obstacle dimensions when flipping
  transformed.x_position = roomWidth - obstacle.x_position - obstacle.width;
  transformed.y_position = roomHeight - obstacle.y_position - obstacle.height;
  
  // Rotate 180 degrees if obstacle has rotation property
  if (obstacle.rotation !== undefined) {
    transformed.rotation = (obstacle.rotation + 180) % 360;
  }
  
  return transformed;
};

// Main transformation function for entire layout
const transformLayoutForView = (layout, viewMode) => {
  // If teacher view or no layout, return as-is
  if (viewMode === "teacher" || !layout) {
    return layout;
  }
  
  // For student view, transform all elements
  if (viewMode === "student") {
    // Create a deep copy of the layout to avoid mutations
    const transformedLayout = {
      ...layout,
      tables: [],
      obstacles: []
    };
    
    // Transform all tables
    if (layout.tables && Array.isArray(layout.tables)) {
      transformedLayout.tables = layout.tables.map(table => 
        transformTableForStudentView(table, layout.room_width, layout.room_height)
      );
    }
    
    // Transform all obstacles
    if (layout.obstacles && Array.isArray(layout.obstacles)) {
      transformedLayout.obstacles = layout.obstacles.map(obstacle =>
        transformObstacleForStudentView(obstacle, layout.room_width, layout.room_height)
      );
    }
    
    return transformedLayout;
  }
  
  // Default: return unchanged
  return layout;
};

// Export functions for use in SeatingViewer
if (typeof window !== "undefined") {
  window.ViewTransformations = {
    transformTableForStudentView,
    transformObstacleForStudentView,
    transformLayoutForView
  };
  console.log("ViewTransformations module loaded");
}