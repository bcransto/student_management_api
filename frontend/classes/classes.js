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

  return React.createElement(
    "div",
    { className: "classes-container" },
    // Page Header
    React.createElement(
      "div",
      { className: "page-header" },
      React.createElement("h1", { className: "page-title" }, "Classes"),
      React.createElement(
        "p",
        { className: "page-subtitle" },
        "Manage your classroom assignments and layouts"
      )
    ),

    // Debug info
    React.createElement(
      "div",
      { className: "card" },
      React.createElement(
        "p",
        null,
        `Cleaned up: Rendering ${classes.length} classes - SeatingChart moved to seating module`
      )
    ),

    // Classes Table
    React.createElement(
      "div",
      { className: "table-container" },
      React.createElement(
        "table",
        { className: "table" },
        // Table Header
        React.createElement(
          "thead",
          null,
          React.createElement(
            "tr",
            null,
            React.createElement("th", null, "Class Name"),
            React.createElement("th", null, "Subject"),
            React.createElement("th", null, "Grade"),
            React.createElement("th", null, "Enrollment"),
            React.createElement("th", null, "Actions")
          )
        ),
        // Table Body
        React.createElement(
          "tbody",
          null,
          classes.map((cls) => {
            return React.createElement(
              "tr",
              { key: cls.id },
              React.createElement(
                "td",
                null,
                React.createElement("strong", null, cls.name),
                cls.description && React.createElement("br"),
                cls.description && React.createElement("small", { className: "text-muted" }, cls.description)
              ),
              React.createElement("td", null, cls.subject || "Not specified"),
              React.createElement("td", null, cls.grade_level || "N/A"),
              React.createElement("td", null, cls.current_enrollment || 0),
              React.createElement(
                "td",
                null,
                React.createElement(
                  "div",
                  { className: "btn-group", style: { gap: "8px" } },
                  React.createElement(
                    "button",
                    {
                      className: "btn btn-primary btn-sm",
                      onClick: () => handleViewChart(cls.id),
                      title: "View seating chart"
                    },
                    React.createElement("i", { className: "fas fa-chair" }),
                    " Seating"
                  ),
                  React.createElement(
                    "button",
                    {
                      className: "btn btn-secondary btn-sm",
                      onClick: () => console.log("Manage clicked for:", cls.name),
                    },
                    React.createElement("i", { className: "fas fa-cog" }),
                    " Manage"
                  )
                )
              )
            );
          })
        )
      )
    )
  );
};

// Export the Classes component (SeatingChart component removed - now in seating module)
if (typeof window !== "undefined") {
  window.ClassesComponent = Classes;
  console.log("Classes component (cleaned up - no SeatingChart) loaded");
}