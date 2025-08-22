// attendance.js - Main attendance list view showing class cards
console.log("Loading attendance component...");

const Attendance = ({ data, refreshData, navigateTo, currentParams }) => {
  // Use NavigationService if available, fallback to navigateTo prop
  const nav = window.NavigationService || null;
  
  console.log("Attendance component rendering with data:", data);
  console.log("Current params:", currentParams);

  const { classes } = data || {};
  console.log("Classes array for attendance:", classes);
  
  if (!classes || !Array.isArray(classes)) {
    return React.createElement(
      "div",
      null,
      React.createElement("h1", null, "Attendance - No Data"),
      React.createElement("p", null, "Classes data not available")
    );
  }

  const handleClassClick = (cls) => {
    console.log("Attendance card clicked for class:", cls.name);
    console.log("Navigating to attendance editor for class:", cls.id);
    
    // Navigate to attendance editor for this class
    if (navigateTo && typeof navigateTo === 'function') {
      navigateTo(`attendance/${cls.id}`);
    } else {
      // Fallback: use hash navigation directly
      window.location.hash = `#attendance/${cls.id}`;
    }
  };

  // Get today's date for display
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return React.createElement(
    "div",
    { className: "attendance-container" },
    // Page Header
    React.createElement(
      "div",
      { className: "attendance-header" },
      React.createElement(
        "div",
        { className: "attendance-header-content" },
        React.createElement("h1", { className: "page-title" }, "Attendance"),
        React.createElement(
          "p",
          { className: "page-subtitle" },
          `Take attendance for ${today}`
        )
      )
    ),

    // Classes Grid
    React.createElement(
      "div",
      { className: "attendance-grid" },
      classes.map((cls) => {
        return React.createElement(
          "div",
          { 
            key: cls.id, 
            className: "attendance-card",
            onClick: () => handleClassClick(cls),
            style: { cursor: "pointer" }
          },
          // Card Header
          React.createElement(
            "div",
            { className: "attendance-card-header" },
            React.createElement("h3", { className: "attendance-card-title" }, cls.name),
            React.createElement(
              "span",
              { className: `attendance-card-badge ${cls.subject ? cls.subject.toLowerCase().replace(/\s+/g, '-') : ''}` },
              cls.subject || "General"
            )
          ),
          
          // Card Body
          React.createElement(
            "div",
            { className: "attendance-card-body" },
            
            // Class Info
            React.createElement(
              "div",
              { className: "attendance-info-grid" },
              
              // Grade Level
              React.createElement(
                "div",
                { className: "attendance-info-item" },
                React.createElement("i", { className: "fas fa-graduation-cap" }),
                React.createElement(
                  "span",
                  null,
                  " Grade ",
                  cls.grade_level || "N/A"
                )
              ),
              
              // Enrollment Count
              React.createElement(
                "div",
                { className: "attendance-info-item" },
                React.createElement("i", { className: "fas fa-users" }),
                React.createElement(
                  "span",
                  null,
                  " ",
                  cls.current_enrollment || 0,
                  " Students"
                )
              )
            ),
            
            // Take Attendance Button/Indicator
            React.createElement(
              "div",
              { className: "attendance-card-footer" },
              React.createElement(
                "div",
                { className: "attendance-action" },
                React.createElement("i", { className: "fas fa-clipboard-check" }),
                React.createElement(
                  "span",
                  null,
                  " Take Attendance"
                )
              )
            )
          )
        );
      })
    ),

    // Empty State
    classes.length === 0 && React.createElement(
      "div",
      { className: "empty-state" },
      React.createElement("i", { className: "fas fa-clipboard-list fa-3x" }),
      React.createElement("h3", null, "No Classes Found"),
      React.createElement("p", null, "You don't have any classes assigned yet.")
    )
  );
};

// Export for use in other modules
window.Attendance = Attendance;
console.log("Attendance component loaded and exported to window.Attendance");