// classes.js - Updated to remove SeatingChart component (now in seating module)
console.log("Loading classes component - cleaned up version...");

const Classes = ({ data, navigateTo, currentParams }) => {
  console.log("Classes component rendering with data:", data);
  console.log("Current params:", currentParams);

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

  const handleViewChart = (classId) => {
    console.log("View chart clicked for class:", classId);
    // Navigate to seating module instead of classes with chart action
    navigateTo("seating", { action: "view", classId: classId });
  };

  const handleNewClass = () => {
    console.log("New class button clicked");
    // TODO: Implement new class creation modal or navigation
    alert("New class creation coming soon!");
  };

  const handleManageClass = (cls) => {
    console.log("Manage clicked for class:", cls.name);
    // TODO: Implement class management
    alert(`Manage class: ${cls.name}`);
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
          { key: cls.id, className: "classes-list-card" },
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
          ),
          
          // Card Footer with Actions
          React.createElement(
            "div",
            { className: "classes-list-card-footer" },
            React.createElement(
              "button",
              {
                className: "btn btn-primary btn-sm class-action-btn",
                onClick: () => handleViewChart(cls.id),
                title: "View seating chart",
              },
              React.createElement("i", { className: "fas fa-chair" }),
              " Seating"
            ),
            React.createElement(
              "button",
              {
                className: "btn btn-secondary btn-sm class-action-btn",
                onClick: () => handleManageClass(cls),
              },
              React.createElement("i", { className: "fas fa-cog" }),
              " Manage"
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
