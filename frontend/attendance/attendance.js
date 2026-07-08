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

  const handleVisualMode = (e, cls) => {
    e.stopPropagation(); // Prevent card click
    console.log("Visual mode clicked for class:", cls.name);
    console.log("Navigating to visual attendance for class:", cls.id);
    
    // Navigate to visual attendance editor for this class
    if (navigateTo && typeof navigateTo === 'function') {
      navigateTo(`attendance/visual/${cls.id}`);
    } else {
      // Fallback: use hash navigation directly
      window.location.hash = `#attendance/visual/${cls.id}`;
    }
  };

  const handleReportMode = (e, cls) => {
    e.stopPropagation(); // Prevent card click
    console.log("Report mode clicked for class:", cls.name);
    console.log("Navigating to attendance report for class:", cls.id);
    
    // Navigate to attendance report for this class
    if (navigateTo && typeof navigateTo === 'function') {
      navigateTo(`attendance/report/${cls.id}`);
    } else {
      // Fallback: use hash navigation directly
      window.location.hash = `#attendance/report/${cls.id}`;
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
      { className: "page-header" },
      React.createElement("h1", { className: "page-title" }, "Attendance"),
      React.createElement(
        "p",
        { className: "page-subtitle" },
        `Take attendance for ${today}`
      )
    ),

    // Classes Grid
    React.createElement(
      "div",
      { className: "list-grid" },
      classes.map((cls) => {
        return React.createElement(
          "div",
          {
            key: cls.id,
            className: "list-card",
            onClick: () => handleClassClick(cls),
            style: { cursor: "pointer" }
          },
          // Card Header
          React.createElement(
            "div",
            { className: "list-card-header" },
            React.createElement(
              "div",
              { className: "list-card-title" },
              React.createElement("i", { className: "fas fa-clipboard-check" }),
              cls.name
            ),
            React.createElement(
              "span",
              { className: "badge badge-info" },
              cls.subject || "General"
            )
          ),

          // Class Info
          React.createElement(
            "div",
            { className: "list-card-meta" },

            // Grade Level
            React.createElement(
              "div",
              null,
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
              null,
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

          // Attendance Action Buttons
          React.createElement(
            "div",
            { className: "list-card-actions" },
            // List Mode Button
            React.createElement(
              "button",
              {
                className: "btn btn-sm btn-primary",
                onClick: (e) => {
                  e.stopPropagation();
                  handleClassClick(cls);
                },
                title: "Take attendance (list view)"
              },
              React.createElement("i", { className: "fas fa-list" }),
              React.createElement(
                "span",
                null,
                " List Mode"
              )
            ),
            // Visual Mode Button
            React.createElement(
              "button",
              {
                className: "btn btn-sm btn-ghost",
                onClick: (e) => handleVisualMode(e, cls),
                title: "Take attendance (visual seating view)"
              },
              React.createElement("i", { className: "fas fa-th" }),
              React.createElement(
                "span",
                null,
                " Visual Mode"
              )
            ),
            // Report Button
            React.createElement(
              "button",
              {
                className: "btn btn-sm btn-ghost",
                onClick: (e) => handleReportMode(e, cls),
                title: "View attendance report"
              },
              React.createElement("i", { className: "fas fa-chart-bar" }),
              React.createElement(
                "span",
                null,
                " Report"
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