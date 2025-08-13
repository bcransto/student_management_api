// classes.js - Updated to remove SeatingChart component (now in seating module)
console.log("Loading classes component - cleaned up version...");

const Classes = ({ data, refreshData, navigateTo, currentParams }) => {
  console.log("Classes component rendering with data:", data);
  console.log("Current params:", currentParams);
  console.log("navigateTo prop:", navigateTo);

  const { classes } = data || {};
  console.log("Classes array:", classes);

  if (!classes || !Array.isArray(classes)) {
    return React.createElement(
      "div",
      null,
      React.createElement("h1", null, "Classes - No Data"),
      React.createElement("p", null, "Classes data not available")
    );
  }

  const handleClassClick = (cls) => {
    console.log("Class card clicked:", cls.name);
    
    // NOTE: The app.js file needs to be updated to pass navigateTo prop to Classes component
    // Line 248-251 in app.js should include: navigateTo: handleNavigate,
    // For now, we use a fallback to hash navigation
    
    if (navigateTo && typeof navigateTo === 'function') {
      // Use the provided navigation function if available
      navigateTo("classes", { action: "view", classId: cls.id });
    } else {
      // Fallback: use hash navigation directly to show class details
      // This will need to be handled by the app's routing logic
      window.location.hash = `#classes/view/${cls.id}`;
      console.log("Using fallback navigation to:", `#classes/view/${cls.id}`);
      
      // Alternative: Navigate to seating view for this class
      // window.location.hash = `#seating?classId=${cls.id}`;
    }
  };

  const handleNewClass = () => {
    console.log("New class button clicked");
    // TODO: Implement new class creation modal or navigation
    alert("New class creation coming soon!");
  };

  return React.createElement(
    "div",
    { className: "classes-container" },
    // Page Header with New Class button
    React.createElement(
      "div",
      { className: "classes-header" },
      React.createElement(
        "div",
        { className: "classes-header-content" },
        React.createElement("h1", { className: "page-title" }, "Classes"),
        React.createElement(
          "p",
          { className: "page-subtitle" },
          "Manage your classroom assignments and layouts"
        )
      ),
      React.createElement(
        "button",
        {
          className: "btn btn-primary btn-new-class",
          onClick: handleNewClass,
        },
        React.createElement("i", { className: "fas fa-plus" }),
        " New Class"
      )
    ),

    // Classes Grid
    React.createElement(
      "div",
      { className: "classes-grid" },
      classes.map((cls) => {
        const enrollmentPercent = cls.max_enrollment 
          ? Math.round((cls.current_enrollment / cls.max_enrollment) * 100)
          : 0;
        
        return React.createElement(
          "div",
          { 
            key: cls.id, 
            className: "classes-list-card",
            onClick: () => handleClassClick(cls),
            style: { cursor: "pointer" }
          },
          // Card Header
          React.createElement(
            "div",
            { className: "classes-list-card-header" },
            React.createElement("h3", { className: "classes-list-card-title" }, cls.name),
            React.createElement(
              "span",
              { className: `classes-list-card-badge ${cls.subject ? cls.subject.toLowerCase().replace(/\s+/g, '-') : ''}` },
              cls.subject || "General"
            )
          ),
          
          // Card Body
          React.createElement(
            "div",
            { className: "classes-list-card-body" },
            cls.description && React.createElement(
              "p",
              { className: "classes-list-card-description" },
              cls.description
            ),
            
            // Class Info Grid
            React.createElement(
              "div",
              { className: "class-info-grid" },
              // Grade Level
              React.createElement(
                "div",
                { className: "class-info-item" },
                React.createElement("i", { className: "fas fa-graduation-cap" }),
                React.createElement(
                  "div",
                  null,
                  React.createElement("span", { className: "class-info-label" }, "Grade"),
                  React.createElement("span", { className: "class-info-value" }, cls.grade_level || "N/A")
                )
              ),
              
              // Enrollment
              React.createElement(
                "div",
                { className: "class-info-item" },
                React.createElement("i", { className: "fas fa-users" }),
                React.createElement(
                  "div",
                  null,
                  React.createElement("span", { className: "class-info-label" }, "Students"),
                  React.createElement(
                    "span",
                    { className: "class-info-value" },
                    cls.current_enrollment || 0,
                    cls.max_enrollment && ` / ${cls.max_enrollment}`
                  )
                )
              ),
              
              // Layout Status
              React.createElement(
                "div",
                { className: "class-info-item" },
                React.createElement("i", { className: "fas fa-th" }),
                React.createElement(
                  "div",
                  null,
                  React.createElement("span", { className: "class-info-label" }, "Layout"),
                  React.createElement(
                    "span",
                    { className: `class-info-value ${cls.classroom_layout ? 'has-layout' : 'no-layout'}` },
                    cls.classroom_layout ? "Configured" : "Not Set"
                  )
                )
              )
            ),
            
            // Enrollment Progress Bar (if max_enrollment is set)
            cls.max_enrollment && React.createElement(
              "div",
              { className: "class-enrollment-progress" },
              React.createElement(
                "div",
                { className: "class-enrollment-bar" },
                React.createElement(
                  "div",
                  {
                    className: "class-enrollment-fill",
                    style: { width: `${enrollmentPercent}%` }
                  }
                )
              ),
              React.createElement(
                "span",
                { className: "class-enrollment-text" },
                `${enrollmentPercent}% Full`
              )
            )
          )
        );
      })
    )
  );
};

// Export the Classes component (SeatingChart component removed - now in seating module)
if (typeof window !== "undefined") {
  window.ClassesComponent = Classes;
  console.log("Classes component (cleaned up - no SeatingChart) loaded");
}
